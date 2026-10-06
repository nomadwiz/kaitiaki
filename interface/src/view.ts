// What the read interface shows (#72), derived from the replayed event log
// alone (FR41): no contract call and no storage read. The only other chain
// data is block timestamps, which a proposal's state and arrears depend on.
//
// NFR10 and information view R4 are decided here, not in the markup: a unit
// that is not the viewer's own carries a status and nothing else, so no
// amount or date for it ever reaches the renderer. A paid charge is never
// listed, so a resolved arrear stops being surfaced. This is presentation,
// not protection — anyone with a node reads the whole log.
import { date, nzd, short, unitsLabel } from "./format.js";
import {
  arrearsAt,
  closesAt,
  extended,
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
    { name: "Proposed", step: "done", date: p.createdAt },
    {
      name: "Open",
      step: status(1),
      date: windowEnd,
      dateLabel: status(1) === "current" ? "Closes" : "Closed",
    },
  ];
  // Extended appears only when it happened.
  if (waived) {
    steps.push({
      name: "Extended",
      step: status(2),
      date: extensionEnd,
      dateLabel: status(2) === "current" ? "Closes" : "Closed",
    });
  }
  steps.push(
    {
      name: failed ? "Failed" : "Passed",
      step: status(3),
      date: at >= 3 ? (waived ? extensionEnd : windowEnd) : undefined,
    },
    {
      name: "Queued",
      step: status(4),
      date: eta,
      dateLabel: "7-day wait to",
    },
  );
  if (work) {
    const attestedAt = derived.attestedAt.get(id);
    steps.push({
      name: "Firm confirms work",
      step: status(5),
      // From the wait's end, until the firm has confirmed.
      date: attestedAt ?? eta,
      dateLabel: attestedAt ? "Confirmed" : "From",
    });
  }
  steps.push({
    name: "Executed",
    step: status(6),
    date: derived.executedAt.get(id),
  });
  return steps;
}

export type Status = "current" | "in arrears";

// One step of a proposal's lifecycle (LifecycleTimeline). `dateLabel` leads
// the date: "Closes", "7-day wait to" and the like.
export type Step = {
  name: string;
  step: "done" | "current" | "todo" | "skipped";
  date?: bigint;
  dateLabel?: string;
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
    // What the admitting proposal carried for `payee`, if one did.
    vendor?: { name: string; companyId: string };
    description: string;
    // The company identifier an Admit proposal carries; empty for Work.
    companyId: string;
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
    // The units in the building when it was proposed, which quorum counts.
    units: bigint;
    // When the 7-day wait ends, once it is Queued.
    eta?: bigint;
    // What may be done to it now, its date having arrived: anyone's Queue or
    // Carry out (FR22, NFR7), or the firm's Confirm work.
    act?: "queue" | "confirm" | "execute";
    steps: Step[];
  }[];
  ownUnits: {
    unitId: bigint;
    status: Status;
    // Every unpaid charge: collected or only scheduled (ADR-016), `due` once
    // its due date has arrived, overdue once collected and past due.
    charges: {
      chargeId: bigint;
      amount: bigint;
      dueDate: bigint;
      // When the firm's collection asked for it and took nothing (ADR-020).
      collected?: bigint;
      due: boolean;
      overdue: boolean;
    }[];
  }[];
  // The viewer's direct debit and NZD balance, rebuilt from MockNZD's
  // events (interface.md §3); absent until main.tsx has read them.
  ownWallet?: { approved: bigint; balance: bigint };
  // Status only, by construction.
  otherUnits: { unitId: bigint; status: Status }[];
  // Every event, newest first, as its plain sentence (Activity). A levy
  // event for another owner's unit is the anonymous sentence and nothing
  // more (NFR10).
  activity: { time: bigint; kind: string; text: string }[];
  // Every unpaid charge, for the firm to collect (Firm, ADR-020), listed
  // without its unit or amount, as Anyone's actions listed them: `due` once
  // its due date has arrived, `attempted` once a collection has issued it
  // and taken nothing.
  toCollect: {
    chargeId: bigint;
    dueDate: bigint;
    due: boolean;
    attempted: boolean;
  }[];
  // Queued Work proposals the firm has not yet confirmed (Firm), `due` once
  // the wait has ended.
  toConfirm: {
    id: bigint;
    title: string;
    vendor: string;
    limit: bigint;
    fund: bigint;
    eta: bigint;
    due: boolean;
  }[];
  // Approved vendors, in the order owners admitted them.
  vendors: {
    payee: string;
    name: string;
    companyId: string;
    proposalId: bigint;
    approvedAt: bigint;
  }[];
};

/**
 * @param now the latest block's timestamp
 * @param viewer the wallet viewing, if any; its bound units are its own
 * @param ownWallet the viewer's approval and balance, from the token's events
 * @param firm the firm's address, from the deployment file
 */
export function buildView(
  derived: Derived,
  now: bigint,
  viewer: string | undefined,
  ownWallet?: View["ownWallet"],
  firm?: string,
): View {
  type Created = {
    proposalId: bigint;
    kind: bigint;
    payee: string;
    limit: bigint;
    fund: bigint;
    description: string;
    quoteHash: string;
    companyId: string;
    principalUnits: bigint;
  };
  const created: Created[] = [];
  const votedUnits = new Map<bigint, Set<bigint>>();
  const collectedAt = new Map<bigint, bigint>();
  for (const t of derived.transitions) {
    const a = t.args as Record<string, unknown>;
    if (t.name === "ProposalCreated") created.push(a as Created);
    if (t.name === "ChargeIssued") collectedAt.set(a.chargeId as bigint, t.time);
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

  const ownUnitIds = new Set(viewerUnits);
  const fundName = (fund: unknown) =>
    fund === FUND_OPERATING ? "Operating" : "Long-term maintenance";
  // A vendor by the name its Admit proposal carried, else its address: never
  // a guessed name.
  const vendorName = (payee: string) =>
    derived.payeeDetails.get(payee)?.name ?? short(payee);
  // One sentence per event, EventRow's (the design system's README), and
  // interface.md §4's for ChargeScheduled. The viewer's own levy events name
  // the unit, charge and amount; another owner's name none of them. The
  // firm's name the charge and never a unit or an amount, even of a unit its
  // address holds (interface.md §4.2, the FirmActivity mock-up).
  const firmViews = firm !== undefined && isViewer(firm);
  const sentence = (name: string, a: Record<string, any>): string => {
    const own = ownUnitIds.has(a.unitId);
    if (firmViews) {
      if (name === "ChargeScheduled") return `Charge #${a.chargeId} was scheduled.`;
      if (name === "ChargeIssued") return `The firm asked for payment of Charge #${a.chargeId}.`;
      if (name === "LevyPaid") return `Charge #${a.chargeId} was paid.`;
    }
    switch (name) {
      case "ProposalCreated":
        return a.kind === WORK
          ? `The firm proposed #${a.proposalId}: ${a.description}, up to ${nzd(a.limit)}, from ${fundName(a.fund)}, to ${vendorName(a.payee)}.`
          : `The firm proposed #${a.proposalId}: admit ${vendorName(a.payee)} as a vendor.`;
      case "VoteCast": {
        const side = a.inFavour ? "for" : "against";
        // Another owner's vote names no unit and no count (NFR10, the design
        // system's hard rule 1); the firm sees every vote so.
        if (firmViews || !isViewer(a.voter)) {
          return `An owner voted ${side} Proposal #${a.proposalId}.`;
        }
        const votes = Object.values(a.unitIds as object) as bigint[];
        return `${unitsLabel(votes)} voted ${side} Proposal #${a.proposalId} (${votes.length} unit${votes.length === 1 ? "" : "s"}).`;
      }
      case "ProposalQueued":
        return `Proposal #${a.proposalId} queued. Payment possible from ${date(a.eta)}.`;
      case "WorkAttested":
        return `The firm confirmed the work on Proposal #${a.proposalId} is done (evidence ${short(a.evidenceHash)}).`;
      case "PaymentReleased":
        return `${nzd(a.amount)} paid to ${vendorName(a.payee)} from ${fundName(a.fund)} for Proposal #${a.proposalId}.`;
      case "Deposited":
        return `${nzd(a.amount)} deposited: ${nzd(a.operatingAmount)} to Operating, ${nzd(a.maintenanceAmount)} to Long-term maintenance.`;
      case "ChargeScheduled":
        return own
          ? `Charge #${a.chargeId} scheduled for your Unit ${a.unitId}: ${nzd(a.amount)}, due ${date(a.dueDate)}.`
          : "A levy charge was scheduled for another owner's unit.";
      // The firm collected: it asked for payment, whether or not the
      // wallet covered it (ADR-020). A LevyPaid follows if it did.
      case "ChargeIssued":
        return own
          ? `The firm asked for payment of Charge #${a.chargeId} for your Unit ${a.unitId}: ${nzd(a.amount)}, due ${date(a.dueDate)}.`
          : "The firm asked for payment of a levy charge for another owner's unit.";
      case "LevyPaid":
        return own
          ? `Your Unit ${a.unitId}'s levy of ${nzd(a.amount)} was paid.`
          : "A levy was paid for another owner's unit.";
      case "PayeeAdmitted":
        return `Proposal #${a.proposalId} executed. ${a.name} is now an approved vendor.`;
      case "UnitBound":
        return isViewer(a.wallet)
          ? `Unit ${a.unitId} linked to your wallet.`
          : `Unit ${a.unitId} linked to an owner's wallet.`;
      case "RoleGranted":
      case "RoleRevoked":
        return "Contract permission set at deployment.";
      default:
        // An event with no sentence fails the tests rather than reading as a
        // permission.
        throw new Error(`no sentence for event ${name}`);
    }
  };
  const activity = derived.transitions
    .map((t) => ({
      time: t.time,
      kind: t.name,
      text: sentence(t.name, t.args as Record<string, any>),
    }))
    .reverse();

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
    const waived =
      state === "Extended" ||
      (state !== "Open" && extended(derived, p.proposalId));
    const eta = derived.queued.get(p.proposalId);
    const waitOver = eta !== undefined && now >= eta;
    const work = p.kind === WORK;
    const attested = derived.attested.has(p.proposalId);
    return {
      id: p.proposalId,
      kind: p.kind === WORK ? "Work" : "Admit",
      payee: p.payee,
      vendor: derived.payeeDetails.get(p.payee),
      description: p.description,
      companyId: p.companyId,
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
      units: p.principalUnits,
      eta,
      act:
        state === "Passed"
          ? "queue"
          : state !== "Queued" || !waitOver
            ? undefined
            : work && !attested
              ? "confirm"
              : "execute",
      steps: stepsOf(derived, p.proposalId, state, now, work, waived),
    };
  });

  return {
    viewer,
    ownWallet,
    funds: derived.funds,
    queued,
    proposals,
    ownUnits: viewerUnits.map((unitId) => ({
      unitId,
      status: statusOf(unitId),
      charges: [...derived.charges]
        .filter(([, c]) => c.unitId === unitId && !c.paid)
        .map(([chargeId, c]) => ({
          chargeId,
          amount: c.amount,
          dueDate: c.dueDate,
          collected: collectedAt.get(chargeId),
          due: now >= c.dueDate,
          // arrearsAt's predicate, per charge.
          overdue: c.issued && now > c.dueDate,
        })),
    })),
    activity,
    toCollect: [...derived.charges]
      .filter(([, c]) => !c.paid)
      .map(([chargeId, c]) => ({
        chargeId,
        dueDate: c.dueDate,
        due: now >= c.dueDate,
        attempted: c.issued,
      })),
    toConfirm: proposals
      .filter(
        (p) =>
          p.kind === "Work" && p.state === "Queued" && !derived.attested.has(p.id),
      )
      .map((p) => {
        const eta = derived.queued.get(p.id)!;
        return {
          id: p.id,
          title: p.description,
          vendor: p.vendor?.name ?? short(p.payee),
          limit: p.limit,
          fund: p.fund,
          eta,
          due: now >= eta,
        };
      }),
    otherUnits: units
      .filter((unitId) => !isViewer(derived.owners.get(unitId)!))
      .map((unitId) => ({ unitId, status: statusOf(unitId) })),
    vendors: [...derived.payees]
      .map(([payee, proposalId]) => ({
        payee,
        ...derived.payeeDetails.get(payee)!,
        proposalId,
        approvedAt: derived.executedAt.get(proposalId)!,
      }))
      .sort((a, b) => Number(a.approvedAt - b.approvedAt)),
  };
}
