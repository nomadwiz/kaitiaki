// Rebuilds the building's state from the event log alone (QAS-4, FR40, NFR2;
// issue #69). No contract call and no storage read: the only things asked of
// the node are `eth_getLogs` and the headers of the blocks those logs sit in,
// and the `provider` parameter's type admits nothing else. A header carries
// the block's timestamp, which FR21's eta and a proposal's state depend on; it
// is neither a contract call nor a storage read, and any node serves it
// (project owner's decision on #138, 03-10-2026). So anyone running their own
// node — an insurer, a lender or an audit firm (deployment-view.md §2.1) —
// gets the same answer as the operator. A log that contradicts itself is
// refused, never replayed past.
//
// Usage, against any JSON-RPC endpoint:
//   node scripts/replay.ts <rpc-url> <treasury> <governance> <membership-registry> <levy-ledger> <payee-registry> [from-block]
// Node 22.18 or later strips the types by default; on an earlier Node, add
// --experimental-strip-types.
// test/replay.ts runs it against the in-process network and compares every
// derived value with the contracts' own view functions.
import { Interface, JsonRpcProvider, type Provider } from "ethers";

// The contracts' event signatures, copied from contracts/*.sol. A drifted
// signature decodes nothing, which the replay test catches as a mismatch.
const events = new Interface([
  "event UnitBound(uint256 indexed unitId, address indexed wallet)",
  "event Deposited(uint256 amount, uint256 operatingAmount, uint256 maintenanceAmount)",
  "event PaymentReleased(uint8 indexed fund, address indexed payee, uint256 amount, uint256 proposalId)",
  "event ProposalCreated(uint256 indexed proposalId, uint8 kind, address indexed payee, uint256 limit, uint8 fund, bytes32 quoteHash, string description, uint256 principalUnits, string companyId)",
  "event VoteCast(uint256 indexed proposalId, address indexed voter, bool inFavour, uint256 weight, uint256[] unitIds)",
  "event ChargeScheduled(uint256 indexed chargeId, uint256 indexed unitId, uint256 amount, uint256 dueDate)",
  "event ChargeIssued(uint256 indexed chargeId, uint256 indexed unitId, uint256 amount, uint256 dueDate)",
  "event LevyPaid(uint256 indexed chargeId, uint256 indexed unitId, address indexed payer, uint256 amount)",
  "event PayeeAdmitted(address indexed payee, uint256 indexed proposalId, string name, string companyId)",
  "event ProposalQueued(uint256 indexed proposalId, uint256 eta)",
  "event WorkAttested(uint256 indexed proposalId, address indexed attester, bytes32 evidenceHash)",
  // OpenZeppelin AccessControl, emitted by Treasury at construction.
  "event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)",
  "event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender)",
]);

const OPERATING = 0n;
const WORK = 1n; // Governance.ProposalKind.Work
// Governance's quorum and voting-window constants, copied like the signatures
// above.
const QUORUM_UNIT_DIVISOR = 4n;
const QUORUM_MIN_VOTERS = 2;
const VOTING_PERIOD = 14n * 86_400n;
const EXTENSION = 7n * 86_400n;

export type ProposalState =
  "Open" | "Extended" | "Passed" | "Failed" | "Queued" | "Executed";

export type QuorumParts = {
  unitsVoted: bigint;
  unitsNeeded: bigint;
  unitsMet: boolean;
  voters: number;
  votersNeeded: number;
  votersMet: boolean;
};

export async function replay(
  provider: Pick<Provider, "getLogs" | "getBlock">,
  addresses: {
    treasury: string;
    governance: string;
    membershipRegistry: string;
    levyLedger: string;
    payeeRegistry: string;
  },
  fromBlock: number,
) {
  // ponytail: one eth_getLogs over the whole range; page by block range if a
  // public endpoint caps it (most cap at 10,000 blocks).
  const logs = await provider.getLogs({
    address: Object.values(addresses),
    fromBlock,
  });
  logs.sort((a, b) => a.blockNumber - b.blockNumber || a.index - b.index);

  const funds = { operating: 0n, maintenance: 0n };
  const releasedByProposal = new Map<bigint, bigint>();
  const owners = new Map<bigint, string>();
  // createdAt is the ProposalCreated block's timestamp, as Governance stores
  // it; votedInExtension is set by a vote cast after the window closed.
  const proposals = new Map<
    bigint,
    { kind: bigint; createdAt: bigint; votedInExtension: boolean }
  >();
  const principalUnits = new Map<bigint, bigint>();
  const votes = new Map<bigint, Map<bigint, boolean>>();
  const voters = new Map<bigint, Set<string>>();
  // Payee to the proposal that admitted it.
  const payees = new Map<string, bigint>();
  // Payee to the name and company identifier its admitting proposal carried
  // (ADR-018), kept apart so `payees` keeps its shape.
  const payeeDetails = new Map<string, { name: string; companyId: string }>();
  // Proposal to the time its operation may run from, and to who attested its
  // work with what evidence.
  const queued = new Map<bigint, bigint>();
  const attested = new Map<
    bigint,
    { attester: string; evidenceHash: string }
  >();
  const attestedAt = new Map<bigint, bigint>();
  // Proposal to the block time its effect (payment or admission) landed.
  const executedAt = new Map<bigint, bigint>();
  // ponytail: roles are Treasury's alone; key them by contract address once a
  // second replayed contract uses AccessControl.
  const roles = new Map<string, Set<string>>();
  // Charges by id, created by ChargeScheduled. A charge may be paid before it
  // is issued (ADR-016), so either of the other two events may come first.
  type Charge = {
    unitId: bigint;
    amount: bigint;
    dueDate: bigint;
    issued: boolean;
    paid: boolean;
  };
  const charges = new Map<bigint, Charge>();
  const transitions = [];
  // The logs are in block order, so each header is fetched once.
  let blockNumber = -1;
  let time = 0n;

  for (const log of logs) {
    const refuse = (why: string) => {
      throw new Error(`log ${log.index} of block ${log.blockNumber}: ${why}`);
    };
    if (log.blockNumber !== blockNumber) {
      blockNumber = log.blockNumber;
      const block = await provider.getBlock(blockNumber);
      time = BigInt(block?.timestamp ?? refuse("no header for its block"));
    }
    // Every log from a replayed address must decode: a new event is never
    // skipped in silence.
    const event = events.parseLog(log) ?? refuse("unrecognised log");
    const a = event.args;
    transitions.push({
      name: event.name,
      blockNumber: log.blockNumber,
      time,
      args: a.toObject(true),
    });

    if (event.name === "RoleGranted" || event.name === "RoleRevoked") {
      const holders = roles.get(a.role) ?? new Set<string>();
      roles.set(a.role, holders);
      if (event.name === "RoleGranted") holders.add(a.account);
      else holders.delete(a.account);
    }
    if (event.name === "ProposalCreated") {
      proposals.set(a.proposalId, {
        kind: a.kind,
        createdAt: time,
        votedInExtension: false,
      });
      principalUnits.set(a.proposalId, a.principalUnits);
    }
    if (event.name === "PayeeAdmitted") {
      if (payees.has(a.payee)) refuse(`payee ${a.payee} admitted twice`);
      // FR21 (spec §6): an admission is the operation of a proposal queued
      // earlier, run at or after its eta. Governance.execute refuses one not
      // queued (NotQueued), and the Timelock one before its eta (NotReady).
      const eta = queued.get(a.proposalId);
      if (eta === undefined) {
        refuse(
          `proposal ${a.proposalId} admitted a payee before it was queued`,
        );
      } else if (time < eta) {
        refuse(
          `proposal ${a.proposalId} admitted a payee at ${time}, before its eta ${eta}`,
        );
      }
      payees.set(a.payee, a.proposalId);
      payeeDetails.set(a.payee, { name: a.name, companyId: a.companyId });
      executedAt.set(a.proposalId, time);
    }
    if (event.name === "ProposalQueued") {
      // Governance.queue refuses an unknown proposal (UnknownProposal) and
      // one already scheduled (AlreadyQueued).
      if (!proposals.has(a.proposalId)) {
        refuse(`queued unknown proposal ${a.proposalId}`);
      }
      if (queued.has(a.proposalId)) {
        refuse(`proposal ${a.proposalId} queued twice`);
      }
      queued.set(a.proposalId, a.eta);
    }
    if (event.name === "WorkAttested") {
      // Governance.attest refuses anything but a work proposal
      // (NotWorkProposal), a second attestation (AlreadyAttested), and a
      // proposal not queued (NotQueued, NotPassed).
      if (proposals.get(a.proposalId)?.kind !== WORK) {
        refuse(`attestation names no work proposal ${a.proposalId}`);
      }
      if (attested.has(a.proposalId)) {
        refuse(`proposal ${a.proposalId} attested twice`);
      }
      if (!queued.has(a.proposalId)) {
        refuse(`proposal ${a.proposalId} attested before it was queued`);
      }
      attested.set(a.proposalId, {
        attester: a.attester,
        evidenceHash: a.evidenceHash,
      });
      attestedAt.set(a.proposalId, time);
    }
    if (event.name === "UnitBound") owners.set(a.unitId, a.wallet);
    if (event.name === "ChargeScheduled") {
      if (charges.has(a.chargeId))
        refuse(`charge ${a.chargeId} scheduled twice`);
      charges.set(a.chargeId, {
        unitId: a.unitId,
        amount: a.amount,
        dueDate: a.dueDate,
        issued: false,
        paid: false,
      });
    }
    if (event.name === "ChargeIssued" || event.name === "LevyPaid") {
      // LevyLedger emits both only for a charge its constructor stored.
      const verb = event.name === "ChargeIssued" ? "issued" : "paid";
      const charge =
        charges.get(a.chargeId) ??
        refuse(`charge ${a.chargeId} ${verb} before it was scheduled`);
      if (charge.unitId !== a.unitId) {
        refuse(
          `charge ${a.chargeId} ${verb} for unit ${a.unitId}, scheduled for unit ${charge.unitId}`,
        );
      }
      if (event.name === "ChargeIssued") {
        if (charge.amount !== a.amount || charge.dueDate !== a.dueDate) {
          refuse(
            `charge ${a.chargeId} issued with amount ${a.amount} and due date ${a.dueDate}, scheduled with amount ${charge.amount} and due date ${charge.dueDate}`,
          );
        }
        if (charge.issued) refuse(`charge ${a.chargeId} issued twice`);
        charge.issued = true;
      } else {
        if (charge.paid) refuse(`charge ${a.chargeId} paid twice`);
        charge.paid = true;
      }
    }
    if (event.name === "Deposited") {
      funds.operating += a.operatingAmount;
      funds.maintenance += a.maintenanceAmount;
    }
    if (event.name === "PaymentReleased") {
      if (proposals.get(a.proposalId)?.kind !== WORK) {
        refuse(`release names no work proposal ${a.proposalId}`);
      }
      if (!payees.has(a.payee)) refuse(`release to unadmitted ${a.payee}`);
      // FR21, as for an admission above.
      const eta = queued.get(a.proposalId);
      if (eta === undefined) {
        refuse(`proposal ${a.proposalId} paid before it was queued`);
      } else if (time < eta) {
        refuse(
          `proposal ${a.proposalId} paid at ${time}, before its eta ${eta}`,
        );
      }
      if (a.fund === OPERATING) funds.operating -= a.amount;
      else funds.maintenance -= a.amount;
      executedAt.set(a.proposalId, time);
      releasedByProposal.set(
        a.proposalId,
        (releasedByProposal.get(a.proposalId) ?? 0n) + a.amount,
      );
    }
    if (event.name === "VoteCast") {
      const voted = proposals.get(a.proposalId);
      if (!voted) refuse(`vote on unknown proposal ${a.proposalId}`);
      // Governance accepts a vote after the window only in the extension,
      // and marks it so.
      else if (time >= voted.createdAt + VOTING_PERIOD) {
        voted.votedInExtension = true;
      }
      if (a.weight !== BigInt(a.unitIds.length)) {
        refuse(`weight ${a.weight} for ${a.unitIds.length} units`);
      }
      const ballot = votes.get(a.proposalId) ?? new Map<bigint, boolean>();
      votes.set(a.proposalId, ballot);
      const wallets = voters.get(a.proposalId) ?? new Set<string>();
      voters.set(a.proposalId, wallets.add(a.voter));
      for (const unitId of a.unitIds as bigint[]) {
        // Checked against the bindings replayed so far, never the registry.
        if (owners.get(unitId) !== a.voter) {
          refuse(`unit ${unitId} is not bound to ${a.voter}`);
        }
        if (ballot.has(unitId)) {
          refuse(`unit ${unitId} already voted on proposal ${a.proposalId}`);
        }
        ballot.set(unitId, a.inFavour);
      }
    }
  }

  // One unit, one vote: the tally counts units, whichever wallet cast them.
  const tallies = new Map<bigint, { forVotes: bigint; againstVotes: bigint }>();
  for (const [proposalId, ballot] of votes) {
    const inFavour = [...ballot.values()].filter(Boolean).length;
    tallies.set(proposalId, {
      forVotes: BigInt(inFavour),
      againstVotes: BigInt(ballot.size - inFavour),
    });
  }
  // Quorum as Governance.quorumReached decides it, for every proposal, one
  // condition at a time: units voted are at least a quarter of its principal
  // units, and at least two distinct wallets cast them. `unitsNeeded` is the
  // quarter rounded up, the most a meter's first bar can ask for.
  const quorumParts = new Map<bigint, QuorumParts>();
  const quorum = new Map<bigint, boolean>();
  for (const [proposalId, units] of principalUnits) {
    const unitsVoted = BigInt(votes.get(proposalId)?.size ?? 0);
    const distinct = voters.get(proposalId)?.size ?? 0;
    const parts = {
      unitsVoted,
      unitsNeeded: (units + QUORUM_UNIT_DIVISOR - 1n) / QUORUM_UNIT_DIVISOR,
      unitsMet: unitsVoted * QUORUM_UNIT_DIVISOR >= units,
      voters: distinct,
      votersNeeded: QUORUM_MIN_VOTERS,
      votersMet: distinct >= QUORUM_MIN_VOTERS,
    };
    quorumParts.set(proposalId, parts);
    quorum.set(proposalId, parts.unitsMet && parts.votersMet);
  }

  return {
    funds,
    releasedByProposal,
    tallies,
    quorum,
    quorumParts,
    proposals,
    owners,
    payees,
    payeeDetails,
    queued,
    attested,
    attestedAt,
    executedAt,
    roles,
    charges,
    transitions,
  };
}

// FR9, ADR-016: a unit is in arrears at `timestamp` while one of its charges
// is issued, unpaid and past its due date. The same predicate as
// LevyLedger.arrearsOf, computed from the replayed charges alone.
export function arrearsAt(
  charges: Awaited<ReturnType<typeof replay>>["charges"],
  unitId: bigint,
  timestamp: bigint,
) {
  return [...charges.values()].some(
    (c) => c.unitId === unitId && c.issued && !c.paid && timestamp > c.dueDate,
  );
}

// Whether voting extends past its window: quorum was missed at the window's
// close, or a vote came after it. Meaningful once the window has closed.
export function extended(
  derived: Awaited<ReturnType<typeof replay>>,
  proposalId: bigint,
) {
  return (
    derived.proposals.get(proposalId)!.votedInExtension ||
    !derived.quorum.get(proposalId)
  );
}

// FR20, #138: where a proposal stands at `timestamp`, decided as
// Governance.state decides it, from the replayed log and block times alone.
// A state moves with time even when no log does, so `timestamp` is an
// argument — the chain head's, say — but never earlier than the last
// replayed block, whose votes and executions the replay already counts.
export function stateAt(
  derived: Awaited<ReturnType<typeof replay>>,
  proposalId: bigint,
  timestamp: bigint,
): ProposalState {
  const p = derived.proposals.get(proposalId);
  if (!p) throw new Error(`unknown proposal ${proposalId}`);
  const windowEnd = p.createdAt + VOTING_PERIOD;
  if (timestamp < windowEnd) return "Open";
  // No vote can be cast between the window closing and the first vote in
  // the extension, so until then the tally is the tally at close.
  if (extended(derived, proposalId) && timestamp < windowEnd + EXTENSION)
    return "Extended";
  const tally = derived.tallies.get(proposalId);
  if ((tally?.forVotes ?? 0n) <= (tally?.againstVotes ?? 0n)) return "Failed";
  // The Timelock's operation has run once its effect is in the log.
  const executed =
    p.kind === WORK
      ? derived.releasedByProposal.has(proposalId)
      : [...derived.payees.values()].includes(proposalId);
  if (executed) return "Executed";
  if (derived.queued.has(proposalId)) return "Queued";
  return "Passed";
}

// When voting on a proposal closes, as of `timestamp`: the end of the window
// while it is Open, the end of the extension once it has extended. Meaningful
// only for a proposal still Open or Extended at `timestamp` (see stateAt).
export function closesAt(
  derived: Awaited<ReturnType<typeof replay>>,
  proposalId: bigint,
  timestamp: bigint,
): bigint {
  const p = derived.proposals.get(proposalId);
  if (!p) throw new Error(`unknown proposal ${proposalId}`);
  const windowEnd = p.createdAt + VOTING_PERIOD;
  return timestamp < windowEnd ? windowEnd : windowEnd + EXTENSION;
}

// The read interface (#72) loads this module in a browser, where there is no
// `process` and no `node:url`, so both are reached only under Node.
if (
  globalThis.process?.argv[1] &&
  import.meta.url ===
    (await import("node:url")).pathToFileURL(process.argv[1]).href
) {
  const [
    url,
    treasury,
    governance,
    membershipRegistry,
    levyLedger,
    payeeRegistry,
    from = "0",
  ] = process.argv.slice(2);
  if (!payeeRegistry) {
    console.error(
      "usage: node scripts/replay.ts <rpc-url> <treasury> <governance> <membership-registry> <levy-ledger> <payee-registry> [from-block]",
    );
    process.exit(1);
  }
  const derived = await replay(
    new JsonRpcProvider(url),
    { treasury, governance, membershipRegistry, levyLedger, payeeRegistry },
    Number(from),
  );
  console.dir(derived, { depth: null });
}
