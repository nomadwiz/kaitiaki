// What the read interface shows (#72), derived from the replayed event log
// alone (FR41): no contract call and no storage read. The only other chain
// data is block timestamps, which a proposal's state and arrears depend on.
//
// NFR10 and information view R4 are decided here, not in the markup: a unit
// that is not the viewer's own carries a status and nothing else, so no
// amount or date for it ever reaches the renderer. A paid charge is never
// listed, so a resolved arrear stops being surfaced. This is presentation,
// not protection — anyone with a node reads the whole log.
import {
  arrearsAt,
  stateAt,
  type ProposalState,
  type replay,
} from "../../scripts/replay.js";

type Derived = Awaited<ReturnType<typeof replay>>;

const WORK = 1n; // Governance.ProposalKind.Work

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
    // The viewer's units that have not voted on it, which vote together.
    unvoted: bigint[];
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
 * @param now the latest block's timestamp
 * @param viewer the wallet viewing, if any; its bound units are its own
 */
export function buildView(
  derived: Derived,
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
  const created: Created[] = [];
  const votedUnits = new Map<bigint, Set<bigint>>();
  for (const t of derived.transitions) {
    const a = t.args as Record<string, unknown>;
    if (t.name === "ProposalCreated") created.push(a as Created);
    if (t.name === "VoteCast") {
      const id = a.proposalId as bigint;
      const units = votedUnits.get(id) ?? new Set<bigint>();
      // `replay` keeps args via toObject(true), which turns an array into an
      // object keyed by index.
      for (const unitId of Object.values(a.unitIds as object) as bigint[]) {
        units.add(unitId);
      }
      votedUnits.set(id, units);
    }
  }
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
      const state = stateAt(derived, p.proposalId, now);
      const voted = votedUnits.get(p.proposalId) ?? new Set<bigint>();
      const unvoted = viewerUnits.filter((unitId) => !voted.has(unitId));
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
          (state === "Open" || state === "Extended") && unvoted.length > 0,
        unvoted,
      };
    }),
    ownUnits: viewerUnits.map((unitId) => ({
      unitId,
      status: statusOf(unitId),
      // arrearsAt's predicate, per charge: issued, unpaid and overdue.
      overdue: [...derived.charges]
        .filter(
          ([, c]) =>
            c.unitId === unitId && c.issued && !c.paid && now > c.dueDate,
        )
        .map(([chargeId, c]) => ({
          chargeId,
          amount: c.amount,
          dueDate: c.dueDate,
        })),
    })),
    otherUnits: units
      .filter((unitId) => !isViewer(derived.owners.get(unitId)!))
      .map((unitId) => ({ unitId, status: statusOf(unitId) })),
  };
}
