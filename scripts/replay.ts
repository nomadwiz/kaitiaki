// Rebuilds the building's state from the event log alone (QAS-4, FR40, NFR2;
// issue #69). No contract call and no storage read: the only thing asked of the
// node is `eth_getLogs`, and the `provider` parameter's type admits nothing
// else. So anyone running their own node — an insurer, a lender or an audit
// firm (deployment-view.md §2.1) — gets the same answer as the operator. A log
// that contradicts itself is refused, never replayed past.
//
// Usage, against any JSON-RPC endpoint:
//   node scripts/replay.ts <rpc-url> <treasury> <governance> <membership-registry> [from-block]
// Node 22.18 or later strips the types by default; on an earlier Node, add
// --experimental-strip-types.
// test/replay.ts runs it against the in-process network and compares every
// derived value with the contracts' own view functions.
//
// Not yet replayed, because the contracts that emit them are not built:
// ChargeIssued and LevyPaid (arrears, FR9), PayeeAdmitted, ProposalQueued and
// WorkAttested.
import { Interface, JsonRpcProvider, type Provider } from "ethers";
import { pathToFileURL } from "node:url";

// The contracts' event signatures, copied from contracts/*.sol. A drifted
// signature decodes nothing, which the replay test catches as a mismatch.
const events = new Interface([
  "event UnitBound(uint256 indexed unitId, address indexed wallet)",
  "event Deposited(uint256 amount, uint256 operatingAmount, uint256 maintenanceAmount)",
  "event PaymentReleased(uint8 indexed fund, address indexed payee, uint256 amount, uint256 proposalId)",
  "event ProposalCreated(uint256 indexed proposalId, uint8 kind, address indexed payee, uint256 limit, uint8 fund, bytes32 quoteHash, string description)",
  "event VoteCast(uint256 indexed proposalId, address indexed voter, bool inFavour, uint256 weight, uint256[] unitIds)",
  // OpenZeppelin AccessControl, emitted by Treasury at construction.
  "event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)",
  "event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender)",
]);

const OPERATING = 0n;
const WORK = 1n; // Governance.ProposalKind.Work

export async function replay(
  provider: Pick<Provider, "getLogs">,
  addresses: {
    treasury: string;
    governance: string;
    membershipRegistry: string;
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
  const proposalKinds = new Map<bigint, bigint>();
  const votes = new Map<bigint, Map<bigint, boolean>>();
  // ponytail: roles are Treasury's alone; key them by contract address once a
  // second replayed contract uses AccessControl.
  const roles = new Map<string, Set<string>>();
  const transitions = [];

  for (const log of logs) {
    const refuse = (why: string) => {
      throw new Error(`log ${log.index} of block ${log.blockNumber}: ${why}`);
    };
    // Every log from a replayed address must decode: a new event is never
    // skipped in silence.
    const event = events.parseLog(log) ?? refuse("unrecognised log");
    const a = event.args;
    transitions.push({
      name: event.name,
      blockNumber: log.blockNumber,
      args: a.toObject(true),
    });

    if (event.name === "RoleGranted" || event.name === "RoleRevoked") {
      const holders = roles.get(a.role) ?? new Set<string>();
      roles.set(a.role, holders);
      if (event.name === "RoleGranted") holders.add(a.account);
      else holders.delete(a.account);
    }
    if (event.name === "ProposalCreated") {
      proposalKinds.set(a.proposalId, a.kind);
    }
    if (event.name === "UnitBound") owners.set(a.unitId, a.wallet);
    if (event.name === "Deposited") {
      funds.operating += a.operatingAmount;
      funds.maintenance += a.maintenanceAmount;
    }
    if (event.name === "PaymentReleased") {
      if (proposalKinds.get(a.proposalId) !== WORK) {
        refuse(`release names no work proposal ${a.proposalId}`);
      }
      if (a.fund === OPERATING) funds.operating -= a.amount;
      else funds.maintenance -= a.amount;
      releasedByProposal.set(
        a.proposalId,
        (releasedByProposal.get(a.proposalId) ?? 0n) + a.amount,
      );
    }
    if (event.name === "VoteCast") {
      if (!proposalKinds.has(a.proposalId)) {
        refuse(`vote on unknown proposal ${a.proposalId}`);
      }
      if (a.weight !== BigInt(a.unitIds.length)) {
        refuse(`weight ${a.weight} for ${a.unitIds.length} units`);
      }
      const ballot = votes.get(a.proposalId) ?? new Map<bigint, boolean>();
      votes.set(a.proposalId, ballot);
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

  return { funds, releasedByProposal, tallies, owners, roles, transitions };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const [url, treasury, governance, membershipRegistry, from = "0"] =
    process.argv.slice(2);
  if (!membershipRegistry) {
    console.error(
      "usage: node scripts/replay.ts <rpc-url> <treasury> <governance> <membership-registry> [from-block]",
    );
    process.exit(1);
  }
  const derived = await replay(
    new JsonRpcProvider(url),
    { treasury, governance, membershipRegistry },
    Number(from),
  );
  console.dir(derived, { depth: null });
}
