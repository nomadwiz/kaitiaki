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
  closesAt,
  stateAt,
  type ProposalState,
  type QuorumParts,
  type replay,
} from "../../scripts/replay.js";

type Derived = Awaited<ReturnType<typeof replay>>;

const WORK = 1n; // Governance.ProposalKind.Work
const FUND_OPERATING = 0n; // Treasury.Fund.Operating

// The lifecycle's steps for a proposal in `state` at `now`, in the contract's
// order. Admit proposals have no "Firm confirms work" step.
function stepsOf(
  derived: Derived,
  id: bigint,
  state: ProposalState,
  now: bigint,
  work: boolean,
  waived: boolean,
): Step[] {
  const p = derived.proposals.get(id)!;
  const eta = derived.queued.get(id);
  // closesAt as of the creation and of the window's end gives both ends.
  const windowEnd = closesAt(derived, id, p.createdAt);
  const extensionEnd = closesAt(derived, id, windowEnd);
  const failed = state === "Failed";
  const ready = state === "Queued" && eta !== undefined && now >= eta;
  // The step each state is at.
  const at = {
    Open: 1,
    Extended: 2,
    Passed: 3,
    Failed: 3,
    Queued: !ready ? 4 : work && !derived.attested.has(id) ? 5 : 6,
    Executed: 7,
  }[state];
  const status = (i: number): Step["step"] =>
    i < at
      ? "done"
      : i === at
        ? "current"
        : failed && i > 3
          ? "skipped"
          : "todo";
  const steps: Step[] = [
    { name: "Proposed", step: "done", date: p.createdAt, note: "By the firm" },
    {
      name: "Open",
      step: status(1),
      date: windowEnd,
      dateLabel: status(1) === "current" ? "Closes" : "Closed",
      note: "14-day vote",
    },
    waived
      ? {
          name: "Extended",
          step: status(2),
          date: extensionEnd,
          dateLabel: status(2) === "current" ? "Closes" : "Closed",
          note:
            state === "Extended"
              ? "Quorum waived. One owner's vote can decide."
              : "7-day extension, quorum waived",
        }
      : {
          name: "Extended",
          step: "skipped",
          note:
            at > 2
              ? "Not needed: quorum was met"
              : "Only if too few owners vote",
        },
    {
      name: failed ? "Failed" : "Passed",
      step: status(3),
      date: at >= 3 ? (waived ? extensionEnd : windowEnd) : undefined,
      note: failed
        ? "Not more units for than against"
        : "More units for than against",
    },
    {
      name: "Queued",
      step: status(4),
      date: eta,
      dateLabel: "Wait ends",
      note: "Fixed 7-day wait",
    },
  ];
  if (work) {
    const attestedAt = derived.attestedAt.get(id);
    steps.push({
      name: "Firm confirms work",
      step: status(5),
      // From the wait's end, until the firm has confirmed.
      date: attestedAt ?? eta,
      dateLabel: attestedAt ? "Confirmed" : "From",
      note: "With an evidence hash",
    });
  }
  steps.push({
    name: "Executed",
    step: status(6),
    date: derived.executedAt.get(id),
    note: work ? "Vendor paid" : "Vendor admitted",
  });
  return steps;
}

export type Status = "current" | "in arrears";

// One step of a proposal's lifecycle (LifecycleTimeline). `dateLabel` leads
// the date: "Closes", "Wait ends" and the like.
export type Step = {
  name: string;
  step: "done" | "current" | "todo" | "skipped";
  date?: bigint;
  dateLabel?: string;
  note: string;
};

export type View = {
  viewer: string | undefined;
  funds: { operating: bigint; maintenance: bigint };
  // The most each fund could still pay out: the limits of its Queued proposals.
  queued: { operating: bigint; maintenance: bigint };
  proposals: {
    id: bigint;
    kind: "Admit" | "Work";
    payee: string;
    description: string;
    quoteHash: string;
    limit: bigint;
    fund: bigint;
    state: ProposalState;
    forVotes: bigint;
    againstVotes: bigint;
    // Voting is open and one of the viewer's units has not yet voted.
    canVote: boolean;
    // The viewer's units that have not voted on it, which vote together.
    unvoted: bigint[];
    // When voting closes, while it is Open or Extended.
    closes?: bigint;
    // When it was proposed.
    createdAt: bigint;
    // Both quorum conditions, each as Governance.quorumReached has them.
    quorum: QuorumParts;
    // Voting was extended, so quorum is waived.
    waived: boolean;
    steps: Step[];
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
    quoteHash: string;
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

  const queued = { operating: 0n, maintenance: 0n };
  const proposals: View["proposals"] = created.map((p) => {
    const state = stateAt(derived, p.proposalId, now);
    const voted = votedUnits.get(p.proposalId) ?? new Set<bigint>();
    const unvoted = viewerUnits.filter((unitId) => !voted.has(unitId));
    if (state === "Queued") {
      queued[p.fund === FUND_OPERATING ? "operating" : "maintenance"] +=
        p.limit;
    }
    const open = state === "Open" || state === "Extended";
    const quorum = derived.quorumParts.get(p.proposalId)!;
    const proposal = derived.proposals.get(p.proposalId)!;
    // Voting extends when quorum was missed at the window's close, or a vote
    // came after it.
    const waived =
      state === "Extended" ||
      (state !== "Open" &&
        (proposal.votedInExtension || !derived.quorum.get(p.proposalId)));
    return {
      id: p.proposalId,
      kind: p.kind === WORK ? "Work" : "Admit",
      payee: p.payee,
      description: p.description,
      quoteHash: p.quoteHash,
      limit: p.limit,
      fund: p.fund,
      state,
      forVotes: derived.tallies.get(p.proposalId)?.forVotes ?? 0n,
      againstVotes: derived.tallies.get(p.proposalId)?.againstVotes ?? 0n,
      canVote: open && unvoted.length > 0,
      unvoted,
      closes: open ? closesAt(derived, p.proposalId, now) : undefined,
      createdAt: proposal.createdAt,
      quorum,
      waived,
      steps: stepsOf(
        derived,
        p.proposalId,
        state,
        now,
        p.kind === WORK,
        waived,
      ),
    };
  });

  return {
    viewer,
    funds: derived.funds,
    queued,
    proposals,
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
