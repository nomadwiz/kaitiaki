// What the read interface shows (#72), derived from the replayed event log
// alone (FR41): no contract call and no storage read. The only other chain
// data is block timestamps, which a proposal's state and arrears depend on.
//
// NFR10 and information view R4 are decided here, not in the markup: a unit
// that is not the viewer's own carries a status and nothing else, so no
// amount or date for it ever reaches the renderer. A paid charge is never
// listed, so a resolved arrear stops being surfaced. This is presentation,
// not protection — anyone with a node reads the whole log.
import { arrearsAt, type replay } from "../../scripts/replay.js";

type Derived = Awaited<ReturnType<typeof replay>>;

// Governance's window and extension, copied like replay.ts's quorum constants.
const VOTING_PERIOD = 14n * 86_400n;
const EXTENSION = 7n * 86_400n;
const WORK = 1n; // Governance.ProposalKind.Work

export type ProposalState =
  "Open" | "Extended" | "Passed" | "Failed" | "Queued" | "Executed";

export type Status = "current" | "in arrears";

export type View = {
  viewer: string | undefined;
  funds: { operating: bigint; maintenance: bigint };
  proposals: {
    id: bigint;
    kind: "Admit" | "Work";
    payee: string;
    description: string;
    limit: bigint;
    fund: bigint;
    state: ProposalState;
    forVotes: bigint;
    againstVotes: bigint;
    // Voting is open and one of the viewer's units has not yet voted.
    canVote: boolean;
  }[];
  ownUnits: {
    unitId: bigint;
    status: Status;
    overdue: { chargeId: bigint; amount: bigint; dueDate: bigint }[];
  }[];
  // Status only, by construction.
  otherUnits: { unitId: bigint; status: Status }[];
};

/**
 * @param timeOf the timestamp of each block a transition sits in
 * @param now the latest block's timestamp
 * @param viewer the wallet viewing, if any; its bound units are its own
 */
export function buildView(
  derived: Derived,
  timeOf: (blockNumber: number) => bigint,
  now: bigint,
  viewer: string | undefined,
): View {
  type Created = {
    proposalId: bigint;
    kind: bigint;
    payee: string;
    limit: bigint;
    fund: bigint;
    description: string;
  };
  const created: (Created & { at: bigint })[] = [];
  const voteTimes = new Map<bigint, bigint[]>();
  const votedUnits = new Map<bigint, Set<bigint>>();
  const issued = new Map<bigint, { amount: bigint }>();
  for (const t of derived.transitions) {
    const a = t.args as Record<string, unknown>;
    if (t.name === "ProposalCreated") {
      created.push({ ...(a as Created), at: timeOf(t.blockNumber) });
    }
    if (t.name === "VoteCast") {
      const id = a.proposalId as bigint;
      voteTimes.set(id, [...(voteTimes.get(id) ?? []), timeOf(t.blockNumber)]);
      const units = votedUnits.get(id) ?? new Set<bigint>();
      // `replay` keeps args via toObject(true), which turns an array into an
      // object keyed by index.
      for (const unitId of Object.values(a.unitIds as object) as bigint[]) {
        units.add(unitId);
      }
      votedUnits.set(id, units);
    }
    if (t.name === "ChargeIssued") {
      issued.set(a.chargeId as bigint, { amount: a.amount as bigint });
    }
  }
  const admittedBy = new Set(derived.payees.values());

  // Governance.state, from the log.
  const stateOf = (p: Created & { at: bigint }): ProposalState => {
    const windowEnd = p.at + VOTING_PERIOD;
    if (now < windowEnd) return "Open";
    const votedInExtension = (voteTimes.get(p.proposalId) ?? []).some(
      (time) => time >= windowEnd,
    );
    const extended = votedInExtension || !derived.quorum.get(p.proposalId);
    if (extended && now < windowEnd + EXTENSION) return "Extended";
    const tally = derived.tallies.get(p.proposalId);
    if ((tally?.forVotes ?? 0n) <= (tally?.againstVotes ?? 0n)) return "Failed";
    const executed =
      p.kind === WORK
        ? derived.releasedByProposal.has(p.proposalId)
        : admittedBy.has(p.proposalId);
    if (executed) return "Executed";
    if (derived.queued.has(p.proposalId)) return "Queued";
    return "Passed";
  };

  const isViewer = (wallet: string) =>
    viewer !== undefined && wallet.toLowerCase() === viewer.toLowerCase();
  const statusOf = (unitId: bigint): Status =>
    arrearsAt(derived.charges, unitId, now) ? "in arrears" : "current";
  const units = [...derived.owners.keys()].sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  const viewerUnits = units.filter((unitId) =>
    isViewer(derived.owners.get(unitId)!),
  );

  return {
    viewer,
    funds: derived.funds,
    proposals: created.map((p) => {
      const state = stateOf(p);
      const voted = votedUnits.get(p.proposalId) ?? new Set<bigint>();
      return {
        id: p.proposalId,
        kind: p.kind === WORK ? "Work" : "Admit",
        payee: p.payee,
        description: p.description,
        limit: p.limit,
        fund: p.fund,
        state,
        forVotes: derived.tallies.get(p.proposalId)?.forVotes ?? 0n,
        againstVotes: derived.tallies.get(p.proposalId)?.againstVotes ?? 0n,
        canVote:
          (state === "Open" || state === "Extended") &&
          viewerUnits.some((unitId) => !voted.has(unitId)),
      };
    }),
    ownUnits: viewerUnits.map((unitId) => ({
      unitId,
      status: statusOf(unitId),
      // arrearsAt's predicate, per charge: issued, unpaid and overdue.
      overdue: [...derived.charges]
        .filter(
          ([, c]) =>
            c.unitId === unitId &&
            c.dueDate !== undefined &&
            !c.paid &&
            now > c.dueDate,
        )
        .map(([chargeId, c]) => ({
          chargeId,
          amount: issued.get(chargeId)!.amount,
          dueDate: c.dueDate!,
        })),
    })),
    otherUnits: units
      .filter((unitId) => !isViewer(derived.owners.get(unitId)!))
      .map((unitId) => ({ unitId, status: statusOf(unitId) })),
  };
}
