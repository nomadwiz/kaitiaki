# View — Behavioural (the loop, and where it refuses)

<!-- nav -->
> **Document** · [SAD](../sad.md) · [Decisions](../decision/index.md)
>
> **Method** · [Index](../index.md) · [Brief](../method/00-brief.md) · [Readers](../method/01-stakeholders.md) · [Outline](../method/02-outline.md) · [Drivers](../method/03-drivers.md) · [Scope](../method/04-poc-scope.md) · [Review](../method/05-cold-review.md)
>
> **Views** · [Context](context-view.md) · [Functional](functional-view.md) · **Behavioural** · [Information](information-view.md) · [Deployment](deployment-view.md)
<!-- /nav -->





**SAD [§3.3](../sad.md#3.3%20Behavioural%20view%20%E2%80%94%20the%20loop%2C%20and%20where%20it%20refuses).** Answers **Q7** (what happens to a building that starts from a bad
configuration) and shows the ordering the functional view cannot carry.

**Primary readers:** R1 build team, R3 contract auditor.
**Drivers that forced it:** QAS-10, QAS-11 (P3 participation); the refusal
branches of QAS-5, QAS-6, QAS-8 (P2).
**Scope:** the built prototype only, per [`@work/method/04-poc-scope.md`](../method/04-poc-scope.md).
Designed-only behaviour is marked where it appears.

---

## 1. Primary presentation

`@work/diagram/figures.drawio` — page **[Figure 3](../diagram/figures.drawio) — Sequence view**

**View type.** Behavioural — a sequence, because the design's guarantees depend
on *order* as much as on structure. The functional view says the payee must be
registered; only this view shows that the owners approved the payee at a
different time, in a different vote, from the work.

**Notation.** UML 2.5.1 sequence diagram — lifelines, execution
specifications, synchronous messages and combined fragments. Every refusal is a
`break` fragment: when its guard holds the fragment runs and the rest of the
interaction is abandoned, which is exactly what a reverting transaction does.
The guard in each fragment is the revert condition, stated in UML guard
notation.

**Caption.** *[Figure 3](../diagram/figures.drawio) — Sequence view: one sum of money from levy to
vendor, and every point where the system refuses.*

**The convention that carries the argument.** Every refusal on the diagram is
numbered — B1 to B6, B8, plus B2′, so **eight** in all — and every one of them is
a test in the suite. B7 was withdrawn with the objection window. The diagram and the
test file are two views of the same list, which is what stops the evaluation
section from being a separate act of faith.

---

## 2. Element catalogue

### 2.1 The four phases

| Phase | What happens | Who can start it |
| --- | --- | --- |
| 1 — Money in | Charges are issued once due; owners pay; the treasury splits the money across the two funds | Any caller can issue charges; owners pay |
| 2 — Admit the vendor | The firm proposes a vendor; owners vote affirmatively; after the timelock the vendor joins the approved list | Firm proposes, owners decide |
| 3 — Approve the work | The firm proposes work with a limit, a fund and an already-approved vendor; owners vote; the timelock runs | Firm proposes, owners decide |
| 4 — Assert it was done, and pay | The vendor works off-chain; the firm attests with an evidence hash; **the treasury checks four things and pays** | Firm attests; any caller may then execute |

**Four phases, not five.** An earlier design placed a 20-working-day objection
window between attestation and payment. It was removed: owners could not block a
payment that had to be released regardless, so the window delayed an outcome it
could not change ([ADR-011](../decision/011-payment-on-attestation.md)). Phases 4 and 5 collapsed into one.

### 2.2 The refusals

| # | Where | Condition | Proves |
| --- | --- | --- | --- |
| B1 | `LevyLedger.issueCharges` | Called before the due date | Permissionless triggering is safe — anyone may call, nobody may call early |
| B2 | `Governance.propose` | Vendor not on the approved list | **G2**, at proposal time |
| B2′ | `Treasury.release` | Payee is not on the approved list at payment time | **G2**, again at payment time — the check is not cached. *Exercised as a direct unit test on `Treasury`, calling `release` with an unregistered payee. The end-to-end version — a vendor removed between approval and payment — needs registry removal, which is designed, not built (FR14).* |
| B3 | `Treasury.release` | Caller is not the timelock | **G1** |
| B4 | `Treasury.release` | Amount exceeds the approved limit | **G3** |
| B5 | `Treasury.release` | Fund is not the approved fund | **G4** |
| B6 | `Governance.attest` | Proposal never passed | Attestation cannot manufacture an approval |
| B8 | `Governance.castVote` | Voter is not a bound owner wallet | Eligibility comes from the register, not from the interface |

**B2 and B2′ are deliberately the same check in two places.** Checking only at
proposal time would leave a window in which a vendor is removed and the payment
still lands. **In the built prototype that window cannot actually open**, because
removal is not implemented — so B2′ is proved by calling `Treasury.release`
directly with an unregistered payee rather than by removing a vendor mid-flight.
The guard is real and tested; the scenario that would exercise it end to end is
designed only, and the report should say so in those words. Checking only at payment time would let an unregistered vendor sit
in a queued proposal, which reads badly to anyone inspecting the record.

### 2.3 What is not in this diagram, and why

| Absent | Reason |
| --- | --- |
| The scheduled-work path (a plan item falling due) | `MaintenancePlan` is designed, not built (`04-poc-scope.md` [§3](../sad.md#3.%20Views)) |
| Genesis ratification | Configuration is set at deployment in the prototype; see [§3](../sad.md#3.%20Views) below |
| Claims against retained fees | **Withdrawn from the design**, not deferred — no fee is retained and no claim can be voted ([ADR-012](../decision/012-no-built-in-accountability.md)) |
| Ownership changing hands mid-loop | Needs the land title integration, which is designed only |

---

## 3. Context

This view animates the structure in [§3.2](../sad.md#3.2%20Functional%20view%20%E2%80%94%20the%20permission%20structure). Every message here is one of the
arrows there, and every refusal is one of the guards in that view's element
catalogue — the two must be read together, and neither is complete alone.

**Q7 — what happens to a building that starts from a bad configuration.** In the
designed system, the treasury cannot spend and levies cannot be charged until
owners ratify the configuration at a high threshold, and the contract checks its
own invariants first: every unit bound to exactly one wallet, no wallet bound
twice, caps within declared bounds. **In the prototype, none of this runs** —
configuration is fixed at deployment. So the honest answer to Q7 is: *the design
answers it with a ratification gate; the prototype does not demonstrate that
gate, and a misconfigured deployment would simply operate incorrectly.* That is
worth stating plainly in the SAD rather than describing the designed behaviour
as though it were built.

---

## 4. Rationale

**R1. The payee vote and the work vote are separate events.** ← QAS-6, QAS-8.
This is the single most important thing the diagram shows, and it is invisible
in any structural view. The firm can start both and finish neither. It is
precisely why a stolen firm key reaches no new address — the attacker can raise
proposals indefinitely and still cannot add a vendor.

**R2. Attestation sits after the timelock, not before the vote.** ← QAS-11.
Owners vote on *whether to do the work*, then the work happens, then somebody
asserts it was done. Putting attestation before the vote would ask owners to
approve something already claimed as complete, which turns the vote into a
receipt.

**R3. Attestation releases payment directly — nothing sits between them.** ←
QAS-11, [ADR-011](../decision/011-payment-on-attestation.md), and the Construction Contracts Act 2002.
Three designs were tried in this gap: an owner objection window, owner completion
approval, and a plain delay. All three were removed. The objection window could
not change an outcome, because the money had to release regardless; completion
approval made a contractor's payment hostage to owner attention; and a delay that
cannot alter what happens is theatre.

**The domain settles it.** New Zealand construction payment runs on "pay now,
argue later": a contractor who has done the work is paid, and disputes are
resolved afterwards through adjudication rather than by withholding. A design
that let owners freeze a contractor's payment on suspicion would be *less*
aligned with the law of this domain, not more. **The cost is stated in [§6](../sad.md#6.%20Realisation%20and%20requirements) and it
is not small: a false attestation succeeds, immediately, with nothing in the
way.**

**R4. Execution is permissionless at every stage.** ← QAS-10, S3.
Queueing and executing can be called by anyone, because nothing on-chain wakes
itself up. If only the firm could execute, the firm could stall a payment it
disliked by simply not calling — a veto nobody voted to give it.

**R4a. Owners hold no control after the work vote.** ← [ADR-011](../decision/011-payment-on-attestation.md), and against P3's
instinct.
This is worth stating positively rather than as an absence: **owners control what
may be authorised and who may be paid; nobody controls whether approved work gets
paid.** That separation is clean, it keeps every guarantee intact, and it puts
the design's safeguards where owners can realistically exercise them — at a
scheduled vote, not at an unscheduled inspection.

**R5. The treasury re-checks the payee at payment time (B2′).** ← G2.
State can change between approval and execution; the waiting period guarantees
that it *can*. A check performed once at proposal time is a check performed
before the window in which it matters.

---

## 5. Alternatives considered

**A1. One vote covering both the vendor and the work.** *Rejected.* Fewer steps
and materially better for participation — one vote instead of two is exactly
what P3 wants. Rejected because it collapses the separation in R1, and with it
the answer to QAS-8: if approving work could also admit its payee, a stolen firm
key could reach a new address in a single passed proposal.

**A2. Owners approve completion actively, rather than the firm attesting alone.**
*Designed in full, then rejected.* Strictly safer, and it closes the circularity
in §11.4 — the firm could no longer certify its own work. Rejected because it
makes a contractor's payment hostage to owner attention: a vendor who has
finished the job waits on forty people to open an app. At the participation
levels P3 assumes, that is not a safeguard, it is an unpaid invoice.

**A3. A verification window with no owner veto.** *Rejected as theatre.* Owners
could approve early but not block, so payment always released — the window only
postponed it. A mechanism that cannot change an outcome does not belong in an
architecture, and a reviewer will say so.

**A6. Owners may object; a sustained objection blocks payment.** *Adopted, then
withdrawn.* It was the design's position for most of this project's life and it
is what §11.4 describes. Withdrawn because it sits against the domain's own
payment law, and because at observed participation it would almost never
fire — a safeguard calibrated so it cannot operate is worse than none, since it
reads as protection.

**A4. The firm executes the payment itself once conditions are met.**
*Rejected.* Simpler to build and matches how people expect the firm to behave.
Rejected because it hands the firm a silent veto (R4) and adds an authority it
does not need — the payment is already fully determined by that point, so
whoever calls it is arbitrary.

---

## 6. Evaluation

**What it delivers.**

- **P2, fully.** Eight refusals, each a test, each expected to fail its call.
  B3/B4/B5 are the four guarantees; B2 and B2′ close the payee path at both
  ends.
- **P3, partially.** R3 and R4 together mean the loop completes end to end with
  no owner acting after the two votes. The two votes remain a hard requirement.

**What it costs.**

- **It concedes QAS-11 completely, and immediately.** A false attestation
  releases the money with nothing in the way — no window, no approval, no veto.
  The architecture's whole contribution is the permanence and attributability of
  the record. **This is the design's central limitation and it is deliberate**,
  on the reasoning that the domain's law takes the same posture and that every
  alternative tried made someone else's money contingent on owner diligence.
- **It costs P3 two affirmative votes per new vendor.** A1 would have removed
  one of them, and was rejected for a P2 reason. **T1 is paid here as well as in
  the functional view**, and this is the sharper of the two payments.
- **It does nothing for QAS-9.** Every message in the diagram succeeds when the
  votes come from a majority owner voting their own interest.

**What the prototype demonstrates versus what the design claims.**

| Claim | Status in the built loop |
| --- | --- |
| All eight refusals — B1–B6, B8 and B2′ — refuse as drawn | **Demonstrated** — eight contract-level guard tests, B2′ as a direct unit test on `Treasury` |
| The loop completes with no owner acting after the votes | **Demonstrated** |
| A scheduled plan item executes at zero turnout | **Designed only** — needs `MaintenancePlan` |
| A false attestation releases payment | **Demonstrated** — and expected to *succeed*, as the honest statement of the limit |
| A bad genesis configuration is caught by ratification | **Designed only** — see [§3](../sad.md#3.%20Views) |

---

## 7. Perspectives

**P1 — Integrity.** Every message on the diagram emits an event, which is what
makes the whole sequence reconstructible after the fact (QAS-4). The ordering
itself is part of the record: an auditor can see that the payee vote preceded
the work vote, and that the attestation followed the waiting period, without
trusting anyone's account of it.

**P2 — Authority containment.** The walk is the eight refusals. The summary an
auditor can hold in their head: **the firm can start things and assert things; it
cannot approve anything and it cannot pay anything.**

**P3 — Participation.** Both directions again. *For:* two of the four phases need no
owner action at all — charges issue in phase 1, and in phase 4 the firm attests
and anyone executes. The
loop's default is completion, not stall. *Against:* phases 2 and 3 each need an
affirmative vote, and A1 shows the design knowingly refused the cheaper option.
The position taken is that **a building unable to muster two votes should not be
commissioning unplanned work**, which is a defensible answer but is an answer,
not a solution.
