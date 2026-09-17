# ADR-012 — Accountability is external; the architecture supplies evidence

**Status.** Accepted, 29 Aug 2026. Supersedes [ADR-002](002-fee-retention-separate.md) and [`product.md` §11.3](../../product.md#113-accountability-without-a-deposit).

## Context

The original proposal named its accountability mechanism as the project's
**distinguishing design choice**: a share of the management firm's fee withheld
on a rolling schedule, claimable by owner vote, backed by a portable public
reputation — and, importantly, requiring no capital deposit, so that small firms
faced no barrier to entry.

Working through the unset parameters put five mechanisms in front of the
architect. All five were rejected.

| Mechanism | Why it was refused |
| --- | --- |
| A capital bond posted when the firm wins the contract | A barrier to entry that excludes small firms and entrenches incumbents |
| Vendor retention held through a defects period | Unfair to a contractor who has completed the work |
| An owner objection window | Calibrated so it would almost never fire, and it delayed a payment that had to be made regardless |
| Owner completion approval | Made a contractor's payment hostage to owner attention |
| The firm's fee withheld pending a passing audit | Withholds a firm's earnings against a condition the owners control, and lets owners starve a firm by inaction |

**The reason is the same every time**, and that consistency is the finding: every
attempt to build accountability *into the contract* ended up making one party's
money contingent on another party's attention or good faith.

## Decision

**No accountability mechanism inside the contract set.** Nothing is withheld from
anyone, no claim can be voted, no payment can be frozen or reversed.

Every party is treated identically: work is authorised on-chain, payment follows,
and grievances are pursued afterwards through the mechanisms the law already
provides — an audit the owners may commission, adjudication, and the courts.

The audit remains, but entirely off-chain: annual, financial, and waivable by
special resolution, exactly as the Unit Titles Act already provides.

## Consequences

**What the design still claims, and can defend in full:**

> The architecture controls what may be authorised and produces a record that
> cannot be revised. It does not adjudicate, withhold or enforce. Those are the
> law's job, and the law already does them — badly, but largely because the
> evidence it works from is poor. **The contribution is the evidence.**

**This still requires a blockchain.** Three of the four claims in
[`product.md` §5.3](../../product.md#53-what-the-blockchain-adds) survive untouched: an append-only record no participant
including the operator can revise; execution by contract, so an approved proposal
pays and a rejected one cannot; and verification by anyone, without asking the
party holding the money.

**What is withdrawn, and it is substantial.** The fourth §5.3 claim — portable
reputation — goes with it. The record shows what was paid, to whom, for what. It
does not show whether the work was any good, and nothing distinguishes a
fraudulent vendor's history from an honest one's. Judging a firm is done on
external platforms, on evidence this system did not gather. [`product.md` §1](../../product.md#1-executive-summary),
§5.3 and §11.3 all overstate this today and must be rewritten.

**Where accountability actually sits.** `[DECIDED:31-08-2026]` Outside the
contract, deliberately, in the mechanisms that already govern this market and
would continue to whether or not this system existed: the annual audit the owners
may commission; adjudication and the courts; and the ordinary reputational
channels a management firm already lives with — client references, word of mouth
between bodies corporate, and public review platforms. The design does not
replace any of these, and removing the withheld fee does not leave a firm
unaccountable; it leaves the firm accountable in the same places it already was.

**But the architecture must not claim credit for those channels.** They are
unverified, gameable, and judge quality — which is exactly what this record does
not capture. What the architecture adds to them is narrower and worth stating
precisely: a factual payment history that is complete, attributable and
unrevisable, so a complaint that used to rest on one party's recollection can
point at a record neither party can edit. It makes the existing channels better
evidenced. It does not make them work, and it does not judge anyone.

**What is lost in substance.** There is now no financial consequence inside the
system for a management firm that behaves badly. The deterrents are an audit the
owners may waive, the prospect of legal action afterwards, and reputational
damage the system neither administers nor guarantees. For a firm prepared to risk
that, the architecture imposes nothing.

**What is gained.** A claim the design can defend completely, rather than a
clever mechanism that does not survive a reviewer asking who bears the cost when
it fires. Five rejected alternatives, each with a stated reason, are stronger
evidence of architectural reasoning than one asserted mechanism.
