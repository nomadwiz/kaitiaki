# Software Architecture Description
## Body Corporate Treasury — a body corporate run on a government-operated national housing chain

**COMP842 Assignment 1 · Blockchain and Cryptocurrency**

This document owns the architecture: the requirements that shaped it, the views,
the perspectives, the decisions and the evaluation. It does **not** own the
problem, the evidence, the literature or the build plan — those are
[`product.md`](product.md), and this document points at them rather than restating.

The derivation behind every conclusion here — how a driver was ranked, why a
view exists, how each parameter was closed — is held with the report drafting
outside this repository. This document is the architecture itself, and nothing
in the repository depends on the derivation.

`[ASSUMED]` marks a value invented rather than sourced, **at the point it is
used**. Every marker is also collected in [§7.3](#73-assumptions--things-a-decision-rests-on).

---

## 1. Purpose, readers and how to read this

**Purpose.** To describe the architecture of a system that lets the owners of a
multi-unit building control how their pooled levy money is spent, with a record
none of the parties — including the government operating the network — can
quietly revise.

**Seven readers, and where each should go.**

| Reader | Read this |
| --- | --- |
| The build team | [§3.2](#32-functional-view--the-permission-structure) functional, [§3.3](#33-behavioural-view--the-loop-and-where-it-refuses) behavioural, [§6](#6-realisation-and-requirements) realisation |
| The network operator | [§3.5](#35-deployment-and-network-view) deployment, [§2.4](#24-the-guarantees) guarantees, [§7](#7-limits-gaps-and-assumptions) limits |
| A contract auditor | [§3.2](#32-functional-view--the-permission-structure), [§3.3](#33-behavioural-view--the-loop-and-where-it-refuses), [§5](#5-evaluation) evaluation |
| A prospective validator | [§3.1](#31-context-view) context, [§3.5](#35-deployment-and-network-view) deployment |
| A unit owner | [§3.1](#31-context-view) context, [§3.4](#34-information-view) information, [§7](#7-limits-gaps-and-assumptions) limits |
| A management firm | [§3.1](#31-context-view) context, [§3.2](#32-functional-view--the-permission-structure) functional |
| The Privacy Commissioner | [§3.4](#34-information-view) information, [§7](#7-limits-gaps-and-assumptions) limits |

**How the views fit together.** [§3.1](#31-context-view) bounds the system. [§3.2](#32-functional-view--the-permission-structure) opens it and shows
where authority stops. [§3.3](#33-behavioural-view--the-loop-and-where-it-refuses) puts those parts in order and shows where they
refuse. [§3.4](#34-information-view) says what is recorded and who that exposes. [§3.5](#35-deployment-and-network-view) says what the whole
thing runs on — and holds the argument that everything else depends on.

**Where everything else is.** [`index.md`](index.md) maps every document in
this repository: the five views as standalone files, the thirteen decision
records, the build specification and who owns what.

**The identifiers used throughout, and where each is defined.**

| Prefix | Means | Defined in |
| --- | --- | --- |
| **FR**, **NFR** | A requirement | [§6.2](#62-requirements) |
| **G1–G4** | A guarantee the architecture makes | [§2.4](#24-the-guarantees) |
| **QAS-n** | A quality attribute scenario | `method/03-drivers.md` §2 |
| **P1–P3**, **S1–S4** | A primary or secondary driver | [§2.2](#22-drivers) |
| **T1–T5** | A trade-off between drivers | `method/03-drivers.md` §3 |
| **C1–C15** | A constraint | [§2.1](#21-constraints--fixed-and-not-ours-to-trade) |
| **B1–B8, B2′** | A refusal in the loop | [§3.3](#33-behavioural-view--the-loop-and-where-it-refuses) |
| **UC1–UC11** | A use case | [§3.1](#31-context-view) |
| **Q0–Q21** | A reader's concern | `method/01-stakeholders.md` §2 |
| **R1–R7** | A reader of this description | `method/01-stakeholders.md` §1.2 |
| **ADR-nnn** | A decision record | [§8](#8-decisions) |
| **`[ASSUMED]`** | A value invented rather than sourced | [§7.3](#73-assumptions--things-a-decision-rests-on) |

**Two conventions worth knowing before you start.**

- **Built versus designed.** The prototype builds one complete loop and nothing
  else ([§6](#6-realisation-and-requirements)). Anything described but not built is marked *(designed)* at the point
  it appears, not disclaimed at the end.
- **What a view's absences mean.** In [§3.2](#32-functional-view--the-permission-structure), an unlabelled call does not exist; in
  [§3.3](#33-behavioural-view--the-loop-and-where-it-refuses), every refusal is numbered and is a test. A gap in those diagrams is a
  claim, not tidiness.

---

## 2. Architecturally significant requirements

The enumerated requirement set — FR1–FR42, NFR1–NFR15 — is **[§6.2](#62-requirements)**. This section
is what shaped them.

### 2.1 Constraints — fixed, and not ours to trade

Full derivation in `method/01-stakeholders.md` §3.

**From the assignment brief.** One PDF, maximum 25 pages (C1). Source in a public
repository, report carries key snippets only (C2). At least three design
elements, each with what, why, how, trade-offs and alternatives (C3). Unbuilt
requirements named with a reason and a route to completion (C4). At least five
academic or professional sources, APA 7th (C5). The blockchain choice justified
against a centralised database (C6). Every figure legible and individually
explained (C7).

**From the project's situation.** Seven weeks to the group's target of 18 October
2026, with week six writing only and week seven held as contingency; the
assignment's own deadline is 25 October (C8). A team of three, new to Solidity
(C9). Eighty of one hundred marks are for written work (C10).

**From the agreed direction.** The network is government-operated and
permissioned, one national chain, one instance per building (C11). Settlement is
an external NZD-pegged stablecoin (C13). The land title register is the external
authority for ownership (C14).

**Two former constraints, reclassified as decisions.** An earlier draft listed
*public readability* and *one nationally published contract set* among the fixed
givens — and then argued for both at length in [§3.5](#35-deployment-and-network-view), with rejected alternatives.
A thing cannot be both a given and a choice. They are now [ADR-009](decisions/adr/009-publicly-readable.md) and [ADR-010](decisions/adr/010-one-standard-set.md),
and the constraint numbering skips C12 and C15 rather than being renumbered, so
that references elsewhere stay valid.

### 2.2 Drivers

**Three primaries, deliberately unordered.** P1, P2 and P3 are co-equal: each is
walked across every view as a perspective ([§4](#4-perspectives--the-traceability-matrix)), and no decision anywhere in this
document is settled by one outranking another. T1 resolves by asymmetry, T4 by
refusing the trade rather than splitting it. Presenting them as a ranking would
imply a tie-breaker that was never used.

| | Driver | Authority stakeholder | Why it is primary |
| --- | --- | --- | --- |
| **P1** | **Integrity of the record** | The network operator | [`product.md` §5.1](product.md#51-the-condition-the-argument-rests-on) rests the entire blockchain argument on one condition: that no operator, including the state, can revise the record. If P1 fails the design is a database with extra steps |
| **P2** | **Authority containment** | A contract auditor | The four guarantees are worth nothing unless every path that moves money is constrained in code rather than in prose |
| **P3** | **Participation** | A unit owner | The empirical literature is hostile to the premise, and the architecture has to answer it rather than hope |

**On P3's evidence, stated carefully because it is easy to overstate.** Across
Aave, Compound, Lido and Uniswap roughly **5% of token supply** votes on any
given proposal, and Lido averaged **6.5 voters per proposal** (Falk et al.,
2024). Across 21 DAOs fewer than ten addresses held a majority of voting power in
17 of them (Feichtinger et al., 2023).

**And the redesign sharpened this driver rather than weakening it.** P3 once
rested partly on an objection window that no longer exists, so on the original
argument it would now be weaker. [§2.5](#25-configured-parameters-and-where-each-value-comes-from) supplies a better one pointing the other
way: with the quorum waiver, low participation no longer produces a stalled
repaint — **it produces capture**, one owner deciding for forty. That is the case
P3 should be read on.

Token-weighted turnout is **not** turnout by headcount, and a body corporate is
one-unit-one-vote — so the percentage does not transfer. What does transfer is
the **absolute voter count**: a major DAO with an enormous holder base attracts
six or seven voters per proposal. A forty-owner building needing more engaged
voters than that is the real shape of the problem, and it is a stronger claim
than any percentage arithmetic. `[ASSUMED]` that absolute participation in a
small building resembles absolute participation in a large DAO — plausible,
unproven, and P3 rests on it.

**Secondary, and scoped to named views.** Confidentiality — personal data and
arrears on an immutable public ledger ([§3.4](#34-information-view), [§7](#7-limits-gaps-and-assumptions)). Interoperability with the
register and the stablecoin ([§3.1](#31-context-view)). Operability — nothing on-chain wakes itself
up ([§3.3](#33-behavioural-view--the-loop-and-where-it-refuses)). Usability of governance ([§3.4](#34-information-view), [§7](#7-limits-gaps-and-assumptions)).

**Ranked out, with reasons, because silence reads as oversight.**

- **Performance and latency.** Nothing here is time-sensitive; a levy cycle is
  monthly and a proposal is *deliberately* delayed. Optimising latency would work
  against P1.
- **Availability.** An hour of unavailability harms nobody in this domain — in
  deliberate contrast to a payments system, where it would rank first.
- **Scalability.** Single national market; the prototype is one instance.
- **Modifiability, by inversion.** The maintenance plan is immutable by design
  ([ADR-008](decisions/adr/008-immutable-plan.md)) because every attack on it needs an edit path to exist. Choosing to
  be hard to change is a trade-off, and it is named as one.
- **Gas cost.** Measured and reported ([§5](#5-evaluation)), not designed for: on a
  government-operated permissioned chain the fee model is the operator's choice.

### 2.3 Quality attribute scenarios

Ten scenarios sit behind the drivers, each stated in six parts with its measure
and that measure's provenance, in `method/03-drivers.md` §2. The four
carrying the most weight:

- **QAS-1 — record revision.** The operator attempts to alter a settled payment.
  *Measure:* with the operator class holding no more than one third of consensus
  weight, no altered block finalises, and an independent full node synchronised
  at that height rejects it on receipt. *Provenance:* one third is the Byzantine
  fault tolerance safety bound for n ≥ 3f + 1 — **that provenance covers the
  threshold, and nothing else in the sentence.** *And the condition:* this holds
  only while QAS-3 holds, and QAS-3 is adoption behaviour the design cannot
  enforce ([§7.1](#71-what-the-architecture-does-not-prevent)). QAS-1 is a **conditional** guarantee and is stated as one.
- **QAS-4 — independent verifiability.** An owner reconstructs the building's
  whole financial history using their own node and the event log alone.
  *Measure:* the derived balance equals the on-chain balance exactly, with no
  contract storage read and no off-chain data.
- **QAS-8 — compromised firm key.** An attacker holds the management firm's key
  and does everything the firm may legitimately do. *Measure, in the built
  system:* funds reachable at any new address = **zero**, because admitting a
  payee needs an affirmative owner vote the key cannot cast. *In the designed
  system, which adds the passive plan path:* the bound rises to one approved
  limit paid to a vendor the owners already admitted. **The built number is the
  stronger one, and the difference is stated rather than blurred.**
- **QAS-11 — attestation without verification.** The firm attests that work is
  complete when it is not. *Environment:* normal — no owner action is required or
  expected. *Response:* **payment releases.** No contract can verify physical
  work, and after the accountability redesign ([§2.5](#25-configured-parameters-and-where-each-value-comes-from)) the architecture makes no
  attempt to. *Measure, placed on the record rather than the outcome:* 100% of
  released payments carry an on-chain attestation bearing an evidence hash and an
  identified attester, and the proposal, vote, payee, amount and fund are
  permanently public. **The system does not prevent this and does not detect it.
  It makes it provable once suspected**, which is what a later adjudication works
  from.
- **QAS-10 — participation collapse.** A ratified plan item falls due at very low
  engagement. *Measure:* it executes with **zero** votes cast unless owners
  record a veto — while an *unplanned* proposal correctly fails to pass.
  *(Designed — the plan path is not built; see [§6](#6-realisation-and-requirements).)* **Note the veto:** this is
  the design's one surviving on-chain veto, an exception to [ADR-011](decisions/adr/011-payment-on-attestation.md), which
  removed every other. It is deliberate — deferral should require an act rather
  than neglect — and [§7.1](#71-what-the-architecture-does-not-prevent) sets out why it is defensible.

**The asymmetry in QAS-10 is the design's answer to the participation critique.**
Low turnout degrades the system toward *"the agreed plan happens"* rather than
toward *"nothing happens"*. Deferral requires a recorded veto; it cannot happen
by neglect — the one place in this design where owners can stop something.

### 2.4 The guarantees

Four claims, each a property of what the treasury will *accept* rather than of
what a proposal *says* ([ADR-001](decisions/adr/001-narrow-release-interface.md)). The status column matters: **one of these is
stronger in the prototype than in the full design**, and the difference is worth
stating rather than blurring.

| | Guarantee | Status |
| --- | --- | --- |
| **G1** | **No unilateral spending.** No firm or administrator can move funds outside an approved proposal | **Built**, and tested |
| **G2** | **No payment redirection.** Funds reach only a payee the owners affirmatively admitted *and* named in the approved proposal | **Built.** The payee half is absolute: no path admits a payee without an affirmative owner vote. Approving the *work* may happen passively on the designed plan path, which is not built — so in the prototype both halves need a vote, and G2 is *stronger* here than in the full design |
| **G3** | **No spending beyond approval.** Every proposal carries a hard limit; an overrun needs a fresh proposal, not an adjustment | **Built**, and tested |
| **G4** | **No fund re-purposing.** Operating money cannot be spent on long-term maintenance, or the reverse, even by a passing vote | **Built**, and tested |

### 2.5 Configured parameters, and where each value comes from

Seven parameters governed this design and none had a value. All are now set, and
**six of the seven carry statutory provenance** — they are the rules these
buildings already operate under, not numbers this project invented. The
derivation is in `method/06-parameters.md`.

**How that provenance was established, stated because it limits the claim.** legislation.govt.nz refused automated access, so the primary text of the Unit Titles Act 2010 and its Regulations was **not read directly.** Every figure below comes from secondary sources describing the legislation — the Crown's guidance at unittitles.govt.nz, Buddle Findlay's practitioner guide, and Lane Neave on the Construction Contracts Act. They agree with one another on every figure used and two are government-published, but the basis column below attributes each value to the statutory scheme as those sources describe it, not to a section number this project verified. The note under [`product.md`'s references](product.md#references) records the same limit and the rule it follows: a parameter's provenance never rests on a source that was not opened.

| Parameter | Value | Basis |
| --- | --- | --- |
| Quorum | 25% of eligible voters, minimum 2 — **10 of 40** at the reference building | The statutory quorum for a body corporate general meeting, per the Crown's guidance at unittitles.govt.nz |
| Passing threshold | **Ordinary:** more than 50% of votes cast. **Special (75%):** genesis ratification, plan re-ratification, waiving the audit | Ordinary and special resolution under the Unit Titles Act 2010, as that guidance describes it |
| Voting window | **14 days**; failing quorum it extends **7 days**, after which quorum is waived | Notice period and adjournment rule, Unit Titles Regulations 2011 |
| Timelock | **7 days** between a proposal passing and the treasury being able to pay | The statutory adjournment period, adopted for coherence |
| Completion to payment | **None.** Payment releases on the firm's attestation | Construction Contracts Act 2002 — a contractor who has done the work is paid, and disputes run afterwards |
| Fee retention | **None.** The firm is paid in full as earned | See below |
| Audit | Annual, financial, **owner-commissioned and waivable** by special resolution | Unit Titles Act 2010 — audit is the default, opt-out needs 75% |

**One consequence of the timing parameters deserves its own statement**, because
it is the sharpest thing this analysis produced. Quorum is 25%; an ordinary
resolution is a majority of votes *cast*; and quorum is waived after the
extension. Compose the three and **after 21 days a payment can be approved by a
majority of whoever voted, even if that is one owner in forty.**

That is not a defect in the mapping — it is what the statutory scheme permits,
faithfully implemented. In a physical meeting the rule is restrained by frictions
the Act never states: somebody must convene a meeting, attend it, minute it, and
be seen by their neighbours doing so. **Mechanising the rule removes them.** A
quorum that constrained a room becomes an advisory delay on a chain, because the
adjournment is automatic and no human effort is needed to reach the point where
quorum stops applying.

**Porting a governance rule onto a blockchain does not port the informal
safeguards it depended on.** The code is not wrong; the code is faithful, and
faithfulness is what exposes the rule.

---

## 3. Views

Each view is a file of its own in [`decisions/views/`](decisions/views/), which
is where it is edited and where the report's figures are described. This section
says what each one answers and points at it; the views themselves are not
repeated here, so there is one copy of every sentence and no chance of the two
drifting apart.

Every view has the same seven parts: primary presentation, element catalogue,
context, rationale, alternatives considered, evaluation, and perspectives.

### 3.1 Context view

Who may start what, and the two external systems the design depends on but does
not control: the land title register and the settlement stablecoin. Answers Q13
and Q17.

**Read it:** [`context-view.md`](decisions/views/context-view.md)

### 3.2 Functional view — the permission structure

Where authority stops, and every path that moves money. The four guarantees
([§2.4](#24-the-guarantees)) are enforced in this view, and it is the one to read
before writing any contract.

**Read it:** [`functional-view.md`](decisions/views/functional-view.md)

### 3.3 Behavioural view — the loop, and where it refuses

The loop from proposal to payment, and the eight places it refuses. Each refusal
is a named test, B1 to B8, listed in
[`spec.md` §7](spec.md#7-the-eight-refusals--each-one-is-a-test).

**Read it:** [`behavioural-view.md`](decisions/views/behavioural-view.md)

### 3.4 Information view

What is written to the chain, what is only hashed, and who each record exposes.
The eight events, and the rule that they must be sufficient on their own, come
from here.

**Read it:** [`information-view.md`](decisions/views/information-view.md)

### 3.5 Deployment and network view

What the system runs on, whether any one party can control it, and the argument
for a blockchain over a centralised database.

**Read it:** [`deployment-view.md`](decisions/views/deployment-view.md)

---

## 4. Perspectives — the traceability matrix

Each view above ends with its own perspectives walk, where the argument is made.
**This section does not repeat those arguments; it indexes them**, so a reader
checking that all three drivers were carried everywhere can do it on one page.
Where a cell says nothing useful, it says so.

| | [§3.1](#31-context-view) Context | [§3.2](#32-functional-view--the-permission-structure) Functional | [§3.3](#33-behavioural-view--the-loop-and-where-it-refuses) Behavioural | [§3.4](#34-information-view) Information | [§3.5](#35-deployment-and-network-view) Deployment |
| --- | --- | --- | --- | --- | --- |
| **P1 Integrity** | Public read access makes independent verification real | Events emitted on every transition; does not address revision | Ordering is itself part of the record | **Where P1 becomes checkable by an owner** — QAS-4 | **This view is P1** — both scenarios reduce to the one-third rule |
| **P2 Containment** | The catalogue's list of what the firm may not do | **This view is P2** — one address may ever trigger a payment | Eight refusals, each a test | Nothing here grants authority | Consensus contains nothing at the application layer |
| **P3 Participation** | Negative: no committee means every decision now needs owners | Mixed: permissionless triggers help; the payee vote does not | Mixed: two of the four phases need no owner at all | **Most negative**: permanent public vote attribution chills dissent in a small building | Positive: verifying and governing are separate acts |

**What the redesign did to P3, and it strengthened it.** P3 used to rest on three
legs: the two authorisation votes, the objection window, and passive plan
execution. The objection window is gone, so on the original argument P3 got
weaker. [§2.5](#25-configured-parameters-and-where-each-value-comes-from) replaces that argument with a better one pointing the other way:
with the quorum waiver, **low participation no longer produces stall — it
produces capture.** One owner deciding for forty is a sharper case for taking
participation seriously than a stalled repaint ever was.

**The honest summary of P3 across the whole design:** two views help it, two hurt
it, and the one that hurts it most is the information design — because the
mechanism that makes the record trustworthy is the same mechanism that makes
voting against a neighbour's proposal socially costly.

---

## 5. Evaluation

### 5.1 What the prototype demonstrates

Ten headline tests, each with a pass or fail outcome, none depending on a
screenshot looking convincing.

**Two different counts, kept apart deliberately.** [§3.3](#33-behavioural-view--the-loop-and-where-it-refuses) numbers **eight refusal
branches** — B1 to B6, B8, and B2′ — which are contract-level guard tests, one
per way the system says no. The ten below are the **headline claims** the report
leads with; some are refusals, some are not, and the eligibility refusal appears
in the scenario list rather than here because it is a behaviour rather than a
guarantee. Neither list is a subset of the other, and NFR9's measure refers to
[§3.3](#33-behavioural-view--the-loop-and-where-it-refuses)'s eight.

| Claim | Test | Requirement |
| --- | --- | --- |
| G1 | The firm calls release directly → reverts | NFR9, FR31 |
| G2 at proposal time | A work proposal naming an unapproved vendor → reverts | FR18 |
| G2 at payment time | `Treasury.release` called directly with an unregistered payee → reverts | FR34 |
| G3 | Release above the approved limit → reverts | FR32 |
| G4 | Operating proposal drawing on the maintenance fund → reverts | FR33 |
| **QAS-8** | Full attacker path holding the firm's key → reaches no new address | NFR3 |
| **QAS-4** | Replay events on an independent node → derived balance equals on-chain balance | NFR2 |
| Attestation integrity | Attest on a proposal that never passed → reverts | FR26 |
| **Payment follows attestation** | A valid attestation releases payment with no further approval and no waiting period | FR25 |
| Permissionless triggering | Charges issued before the due date → reverts; on or after, any caller succeeds | FR5, NFR7 |

Plus scenario tests: a full levy cycle; a proposal from draft to payment; a
rejected proposal; a vote from an unbound wallet; and **a proposal passing on the
votes of a single owner after the quorum extension** — expected to *succeed*,
because it demonstrates [§2.5](#25-configured-parameters-and-where-each-value-comes-from)'s finding rather than a guard.

**A limit on the G2-at-payment-time test, stated rather than glossed.** In the
full design, that guard catches a vendor removed between approval and payment. In
the prototype, removal is not built (FR14), so the window cannot open in normal
operation and the guard is proved by calling `Treasury.release` directly with an
unregistered payee. The guard is real and tested; the end-to-end scenario that
would exercise it is designed only.

### 5.2 What is measured and reported, with its basis

Reported alongside the tests, and each carries the basis of its baseline — an
unfalsifiable improvement statistic would undo the work the table above does.

| Measure | Basis, and its limit |
| --- | --- |
| Gas cost per owner per levy cycle | Measured directly on the test network. Sound |
| Time from proposal creation to payment | Measured directly; determined by the configured windows, so it reports a design parameter, not a discovery |
| Contract call count for one full loop | Measured directly. A proxy for administrative effort, and only a proxy |
| Administrative steps eliminated | **Not measured.** The "before" is an existing body corporate's manual process, which a test-network prototype cannot observe. Argued from the design in [`product.md` §2.1](product.md#21-the-problem), and labelled an argument |
| Parties able to verify independently | **Not a measurement.** On a network that is described rather than stood up, this is a property of the design — anyone may run a node — not a count of anybody |

The last two were listed as metrics in an earlier draft. They are claims, and
they are now labelled as claims.

### 5.3 What cannot be demonstrated at all

- **Whether validator diversity would hold** (QAS-3). Adoption, not
  architecture. The one-third rule is a stated requirement on the operator.
- **Whether owners actually participate**, whether attestations are honest,
  whether the design would reduce mismanagement in practice. A prototype cannot
  show any of these, and claiming otherwise would be the unfalsifiable assertion
  this document exists to avoid.
- **Whether the contract code is free of defects.** Bounded by auditing one
  published standard rather than 15,000 bespoke sets ([ADR-010](decisions/adr/010-one-standard-set.md)) — an argument, not
  a test.
- **The passive plan path at zero turnout** and the plan's immutability — both
  designed, not built. *(Fee retention is not on this list: it was removed from
  the design, not deferred.)*

---

## 6. Realisation and requirements

### 6.1 What is built, what is described

Full scope rule in `method/04-poc-scope.md`: build the smallest set of
features that lets one sum of money travel from an owner's levy to a vendor's
account under owner control, and nothing else.

**Built — six contracts**, each trimmed to what the loop needs:
`MembershipRegistry` (bindings fixed at deployment), `LevyLedger` (charge, pay,
arrears flag), `PayeeRegistry`, `Governance` (two proposal kinds),
`Timelock` (off-the-shelf), and `Treasury` **in full** — it is the only place
money leaves, so it is the only place the guarantees can be proved.

**Designed, not built — one contract and its behaviour:** `MaintenancePlan` with
scheduled work (FR11, FR24). Plus land title integration (FR3), ownership
transfer, genesis ratification (FR4), arrears enforcement (FR10), payee removal
(FR14), durable company identifiers on payee records (FR15), owners raising
proposals rather than only the firm (FR23), and permissionless public readability
of a national chain that is described rather than stood up (FR42). Nine
functional requirements in all, and [§6.2](#62-requirements) marks each one.

**`FeeRetention` no longer exists.** The accountability redesign removed fee
withholding entirely ([§7.1](#71-what-the-architecture-does-not-prevent), [ADR-012](decisions/adr/012-no-built-in-accountability.md)), so the contract set is **seven designed,
six built** rather than eight and six.

**Build order**, which falls out of [§3.2](#32-functional-view--the-permission-structure): `MembershipRegistry` → `Treasury` +
`PayeeRegistry` → `Governance` + `Timelock` → `LevyLedger`.

**What that costs the argument.** Two claims become designed rather than
demonstrated: the strongest form of the participation answer (a plan item
executing at zero turnout), and the plan's immutability, for which the strongest
available evidence is the absence of an edit function in a designed interface.

A third is not designed-but-unbuilt — it is **gone**. The proposal's
accountability mechanism, which [§1](#1-purpose-readers-and-how-to-read-this) of [`product.md`](product.md) called the distinguishing
design choice, was removed rather than deferred ([ADR-012](decisions/adr/012-no-built-in-accountability.md)). Nothing in the
prototype stands in for it because nothing in the design does.

### 6.2 Requirements

**This section is the single owning file for requirement identifiers.** Nothing
else in the project numbers requirements; where another file appears to, it is
describing scope, not requirements.

Each requirement carries what it traces to, whether it is **B**uilt or
**D**esigned, and the test or evidence that decides it. A non-functional
requirement with no measure is a wish, so every NFR below has one — with one
declared exception, NFR14, whose measure is a property of a consensus layer this
project places out of scope and could never falsify. It is marked as an inherited
claim rather than dressed up as evidence.

**What the report carries, and what stays here.** These tables are roughly two
pages at this density and the report has twenty-five in total (C1). The report
carries the tables **with the trace and evidence columns intact** — those columns
are the reason the requirements earn their marks, and a bare list of requirement
statements would satisfy nothing. What the report drops instead is this section's
prose, and it groups the nine designed requirements into a single block with
one shared completion note rather than nine separate rows.

#### Functional — membership and configuration

| ID | Requirement | Traces to | | Evidence |
| --- | --- | --- | --- | --- |
| FR1 | Each unit is bound to exactly one wallet | UC1–UC3 | **B** | Deployment-time invariant check; unit test on duplicate binding |
| FR2 | Only bound wallets may vote | [ADR-003](decisions/adr/003-one-unit-one-vote.md), UC3 | **B** | Test B8 — a vote from an unbound wallet reverts |
| FR3 | A unit's binding updates from the land title register on sale | S2 | **D** | Needs the adapter role; not built |
| FR4 | The treasury cannot spend until owners ratify the configuration | Q7 | **D** | Configuration is fixed at deployment in the prototype |

#### Functional — levies and arrears

| ID | Requirement | Traces to | | Evidence |
| --- | --- | --- | --- | --- |
| FR5 | A levy charge becomes issuable on its due date and not before | QAS-10, S3 | **B** | Test B1 — issuing early reverts |
| FR6 | Any caller may issue a due charge | QAS-10, NFR7 | **B** | Test — a non-owner, non-firm address succeeds after the due date |
| FR7 | An owner may pay a levy; payment credits the unit, not the payer | UC1 | **B** | Test — third-party payment credits the correct unit |
| FR8 | Receipts are split across the operating and maintenance funds | G4 | **B** | Test — fund balances after a cycle match the configured split |
| FR9 | A charge that is unpaid past its due date counts as arrears | S1, [ADR-005](decisions/adr/005-arrears-published-per-unit.md) | **B** | **Arrears is a derived predicate, not stored state**: `ChargeIssued` gives the amount and due date, `LevyPaid` gives settlement, and block time gives the rest. Test — replay the two events plus a timestamp and derive the same flag the contract reports. This is what keeps FR40 true for arrears; a stored-only flag would have broken it |
| FR10 | An owner in arrears has their vote suspended | [ADR-005](decisions/adr/005-arrears-published-per-unit.md) | **D** | Disclosure is built; consequences are not |
| FR11 | Levy amounts derive from the plan and the operating budget | [ADR-008](decisions/adr/008-immutable-plan.md) | **D** | Needs `MaintenancePlan` |

#### Functional — the approved vendor list

| ID | Requirement | Traces to | | Evidence |
| --- | --- | --- | --- | --- |
| FR12 | A vendor joins the approved list only through a passed affirmative owner vote | **G2**, QAS-8 | **B** | Test — direct `admit` call reverts; admission via executed proposal succeeds |
| FR13 | The list is readable by any caller | QAS-4 | **B** | View function; event `PayeeAdmitted` |
| FR14 | A vendor may be removed from the list by owner vote | G2 | **D** | Not built — see [§5.1](#51-what-the-prototype-demonstrates)'s note on the B2′ test |
| FR15 | A payee record binds an address to a durable company identifier | [ADR-003](decisions/adr/003-one-unit-one-vote.md) | **D** | Needs an external company register |

#### Functional — proposals and voting

| ID | Requirement | Traces to | | Evidence |
| --- | --- | --- | --- | --- |
| FR16 | The firm may propose admitting a vendor | UC2 | **B** | Test — non-firm caller reverts |
| FR17 | The firm may propose work naming description, limit, fund and an approved vendor | UC3 | **B** | Test — proposal state after creation |
| FR18 | A work proposal naming an unapproved vendor is refused at creation | **G2** | **B** | Test B2 |
| FR19 | Voting weight is the **number of units** a wallet holds — one unit, one vote. The entitlement share is recorded on the unit but is **not** used as voting weight | [ADR-003](decisions/adr/003-one-unit-one-vote.md) | **B** | Test — a wallet holding three units casts three votes; a wallet holding one casts one, regardless of entitlement share |
| FR20 | A proposal reaching its threshold within its window passes; failing quorum the window extends 7 days and quorum is then waived | UC3, [§2.5](#25-configured-parameters-and-where-each-value-comes-from) | **B** | Test — pass, fail, and pass-after-extension-on-one-vote |
| FR21 | A passed proposal cannot execute before the 7-day timelock elapses | [ADR-001](decisions/adr/001-narrow-release-interface.md), [§2.5](#25-configured-parameters-and-where-each-value-comes-from) | **B** | Test — early execute reverts |
| FR22 | Any caller may queue or execute a proposal whose conditions are met | NFR7 | **B** | Test — third-party execution succeeds |
| FR23 | Owners may raise proposals, not only the firm | [§3.1](#31-context-view) A2 | **D** | Named as the cheapest strengthening available ([§7.4](#74-parameters--all-settled)) |
| FR24 | A ratified plan item becomes triggerable on its due date by any caller | **QAS-10** | **D** | Needs `MaintenancePlan` |

#### Functional — attestation and payment

| ID | Requirement | Traces to | | Evidence |
| --- | --- | --- | --- | --- |
| FR25 | The firm attests completion with an evidence hash, **and that attestation releases payment** — no waiting period, no owner approval step | QAS-11, [ADR-011](decisions/adr/011-payment-on-attestation.md) | **B** | Event `WorkAttested` carries attester and hash; release follows in the same transaction path |
| FR26 | Attestation on a proposal that did not pass is refused | QAS-11 | **B** | Test B6 |
| ~~FR27~~ | ~~Owners may object during an objection window~~ | — | **Withdrawn** | The objection window was removed: it could not change an outcome, because payment had to release regardless ([ADR-011](decisions/adr/011-payment-on-attestation.md)) |
| ~~FR28~~ | ~~A sustained objection prevents release~~ | — | **Withdrawn** | With no objection there is nothing to sustain |
| ~~FR29~~ | ~~Absent objection the window expires and release proceeds~~ | — | **Withdrawn** | Superseded by FR25: release follows attestation directly |
| FR30 | The treasury holds two segregated fund balances | **G4** | **B** | Test — cross-fund draw reverts |
| FR31 | Only the timelock may trigger a release, and no path can regrant that | **G1** | **B** | Test B3; role administration renounced at deployment |
| FR32 | A release above the proposal's limit is refused | **G3** | **B** | Test B4 |
| FR33 | A release drawing on a fund other than the approved one is refused | **G4** | **B** | Test B5 |
| FR34 | A release to an address not on the approved list is refused | **G2** | **B** | Test B2′ — direct call with an unregistered payee |
| FR35 | Payment is made in the settlement asset directly to the payee | UC7 | **B** | Event `PaymentReleased`; token balance assertion |

#### Functional — accountability and transparency

| ID | Requirement | Traces to | | Evidence |
| --- | --- | --- | --- | --- |
| ~~FR36~~ | ~~A share of each management fee is withheld~~ | — | **Withdrawn** | No fee is withheld; the firm is paid in full as earned ([ADR-012](decisions/adr/012-no-built-in-accountability.md)) |
| ~~FR37~~ | ~~Withheld fees release on a rolling schedule~~ | — | **Withdrawn** | Nothing is withheld |
| ~~FR38~~ | ~~Owners may claim against withheld fees by vote~~ | — | **Withdrawn** | Grievances against the firm are pursued off-chain, as they are against a vendor ([ADR-012](decisions/adr/012-no-built-in-accountability.md)) |
| FR39 | Every state change emits a structured event | **QAS-4**, P1 | **B** | Eight event types; emission asserted per transition |
| FR40 | Fund balance and every transition are derivable from events alone | **QAS-4** | **B** | Replay test on an independent node |
| FR41 | The interface reads events only and holds no authority | P1, R7 | **B** | Interface holds no key and no role |
| FR42 | The ledger is readable without permission | [ADR-009](decisions/adr/009-publicly-readable.md) | **D** | The public test network is readable, but that is a property of the test network, not evidence about a national permissioned chain that is described rather than stood up ([§3.5](#35-deployment-and-network-view)). Argued, not demonstrated |

**On the withdrawn requirements.** Identifiers are **not reused or renumbered** —
FR27, FR28, FR29 and FR36–FR38 are struck through and left in place so that every
reference elsewhere in the project still resolves. Six withdrawn requirements is
a large number, and the reason is a single design change worth reading in full:
[§7.1](#71-what-the-architecture-does-not-prevent) and [ADR-012](decisions/adr/012-no-built-in-accountability.md).

**No requirement is calibrated by an unset value.** An earlier draft marked four
requirements `B*` — built, but tested against thresholds and windows that had no
agreed value. All seven parameters now have values with stated bases ([§2.5](#25-configured-parameters-and-where-each-value-comes-from)), and
two of the four requirements that carried the marking have since been withdrawn
with the mechanisms they described. The notation is retired.

**Forty-two functional requirement identifiers: twenty-seven built, nine
designed, six withdrawn.**

#### Non-functional

| ID | Requirement | Measure | Method | |
| --- | --- | --- | --- | --- |
| NFR1 | A finalised record cannot be revised by any participant | No altered block finalises while no class holds > 1/3 of consensus weight | QAS-1; argued, not tested — the network is described, not stood up | **D** |
| NFR2 | The record is verifiable without trusting its holder | Derived balance from events alone equals on-chain balance, exactly | QAS-4 replay test on an independent node | **B** |
| NFR3 | Loss is bounded under total compromise of the firm's key | Funds reachable at any new address = 0 | QAS-8 adversarial path | **B** |
| NFR4 | No validator class can control consensus | No class > 1/3 of consensus weight, checkable at any block by any observer | Operator admission rule; **not enforceable by this design** ([§7.1](#71-what-the-architecture-does-not-prevent)) | **D** |
| NFR5 | The loop completes without owner action after the two votes | Zero owner transactions between the second vote and payment | Full-loop test | **B** |
| NFR6 | Ratified work proceeds at zero turnout | A plan item executes with 0 votes cast unless owners record a veto | QAS-10; needs `MaintenancePlan`. **The plan-item veto is the one remaining on-chain veto in the design** and sits on the designed path only — see [§7.1](#71-what-the-architecture-does-not-prevent) | **D** |
| NFR7 | No privileged party decides when a due action happens | Every time-gated entry point accepts any caller and refuses before its date | Tests on FR5, FR22 | **B** |
| NFR8 | Authority is auditable by inspection, not by reasoning | The set of addresses that may trigger a payment has exactly one member, and is immutable | Access-control state read + renunciation test | **B** |
| NFR9 | Refusal is deterministic and named | 100% of guard violations revert with a distinct named error | The eight refusal tests of [§3.3](#33-behavioural-view--the-loop-and-where-it-refuses) | **B** |
| NFR10 | The interface discloses status, not amounts or history | For a unit other than the viewer's own, the interface renders exactly one of {current, in arrears} and **no numeric value and no dated entry** | Automated check over the rendered output for any digit in an arrears context. **A presentation property, not a protection** ([§3.4](#34-information-view) R4) — anyone with a node sees everything | **B** |
| NFR11 | Operating cost per owner is knowable | Gas per owner per levy cycle, measured on the test network | Instrumented test run | **B** |
| NFR12 | A firm's **payment history** is comparable across the buildings it manages | Identical event schema and contract code hash across instances, so records from different buildings can be read together | Follows from [ADR-010](decisions/adr/010-one-standard-set.md); one instance built, so argued. **Note the narrowed claim:** the record shows what was paid, not whether anyone was satisfied — reputation is out of scope ([§7.1](#71-what-the-architecture-does-not-prevent)) | **D** |
| NFR13 | The trusted code base is one artefact, not thousands | One published set; instance code hash matches the published hash | Hash comparison; argued at national scale | **D** |
| NFR14 | Payment transactions are deterministically final | No reorganisation can unwind a settled payment | **Not falsifiable by anything this project can do** — it is a property of a consensus layer that [§7.2](#72-deliberately-out-of-scope) places out of scope and [§3.5](#35-deployment-and-network-view) says is not stood up. Stated as an inherited property of BFT finality ([ADR-007](decisions/adr/007-proof-of-authority.md)) and marked as an inherited claim, not as evidence | **D** |
| NFR15 | The system issues no speculative asset | No token contract in the standard set confers governance rights, consensus weight, or a claim on the fund | Inspection of the seven-contract set. The prototype deploys a **mock** NZD stablecoin to stand in for the external settlement asset; it is not part of the standard set and confers none of the above | **B** |

**Fifteen non-functional requirements: nine built, six designed.** Each of the
six designed ones is designed because the thing it measures is not built, not
because the measure was avoided.

---

## 7. Limits, gaps and assumptions

### 7.1 What the architecture does not prevent

Collected here in one place for a reader who needs them together. **Each is
argued in the view that discovered it**; this list is the index, not a second
argument.

- **Capture does not require a majority of units — at low turnout it requires
  very few owners indeed.** Quorum is 25%; an ordinary resolution is a majority
  of votes *cast*; and quorum is waived after the 7-day extension ([§2.5](#25-configured-parameters-and-where-each-value-comes-from)).
  Composed, that means **a payment can be approved after 21 days by a majority of
  whoever voted, even if that is one owner in forty.** The original statement of
  this limit — that a *majority unit owner* can direct the fund (QAS-9, [ADR-003](decisions/adr/003-one-unit-one-vote.md))
  — understates it by an order of magnitude. Every guarantee is satisfied while
  it happens, and **it is not mitigated.**

  The parameters are faithful to the statutory scheme, and that is the point: in
  a physical meeting the rule is restrained by frictions the Act never states —
  convening, attending, minuting, being seen by neighbours. Mechanising the rule
  removes them, so a quorum that constrained a room becomes an advisory delay on
  a chain. **Porting a governance rule onto a blockchain does not port the
  informal safeguards it depended on.**
- **A false completion attestation releases the money, immediately and with
  nothing in the way** (QAS-11, [§3.3](#33-behavioural-view--the-loop-and-where-it-refuses), [ADR-011](decisions/adr/011-payment-on-attestation.md)). No contract can verify that a
  roof was repaired, and the architecture no longer attempts to interpose
  anything between the firm's assertion and the payment. **Every safeguard in
  this design sits at authorisation; every remedy sits after payment.** That is
  the same posture the Construction Contracts Act takes — a contractor who has
  done the work is paid, and disputes run afterwards — and it is adopted
  deliberately rather than conceded.
- **There is no accountability mechanism inside the contract at all.** No fee is
  withheld, no claim can be voted, no payment can be frozen or reversed
  ([ADR-012](decisions/adr/012-no-built-in-accountability.md)). Five mechanisms were designed and rejected, each because it made
  one party's money contingent on another party's diligence. What the
  architecture contributes to accountability is **evidence**: a complete,
  attributable, unrevisable record for an audit or an adjudication to work from.
  Accountability itself is left where it already sits — the audit, adjudication
  and the courts, and the ordinary reputational channels a firm lives with, from
  client references to public review platforms. Removing the withheld fee does
  not leave a firm unaccountable; it leaves the firm accountable in the same
  places it already was, better evidenced than before. Whether that record is
  ever used is outside the system.
- **Reputation is not a claim this design makes.** The record shows what was paid,
  to whom, for what. It does not show whether the work was any good, and nothing
  distinguishes a fraudulent vendor's history from an honest one's. Judging a
  firm or a vendor is done on external platforms, on evidence this system did not
  gather — and those platforms are unverified and gameable, so the architecture
  improves what they can point at without improving what they conclude.
- **Only the firm sets the agenda** ([§3.1](#31-context-view)). A firm that never proposes necessary
  work cannot be compelled to by anything in the built system.
- **The audit can be waived, and waiving it composes with owner capture into the
  design's cleanest attack.** The annual audit is the last remaining check on the
  management firm, and owners may waive it by special resolution. [ADR-003](decisions/adr/003-one-unit-one-vote.md) already
  records that voting weight follows units. Therefore: *a developer holding
  three-quarters of the units can appoint a management firm, waive the audit, and
  approve payments to a vendor they control — every guarantee satisfied, nothing
  withheld, and nothing on the record distinguishing it from a well-run
  building.* Stated here in full because a reviewer will assemble it from the
  parts otherwise.
- **A financial audit cannot see the physical world.** Even when it happens, an
  audit checks money against records. A payment to a properly registered vendor,
  against a valid proposal and a genuine invoice, for work never done, produces
  records that are entirely consistent. The audit is a check on the books, not on
  the building, and the report should not let it stand for more.
- **One veto survives, on a path that is not built.** The redesign removed every
  on-chain veto — except that a ratified maintenance plan item *"proceeds unless
  owners record an objection"* ([ADR-008](decisions/adr/008-immutable-plan.md), NFR6). That is deliberate there: it is
  what makes deferral require an act rather than neglect, which the Crown
  identifies as the sector's characteristic failure. But it is inconsistent with
  the posture everywhere else in this design, it exists only on the designed
  path, and **a reviewer is entitled to ask why work already ratified can be
  vetoed when a payment already approved cannot.** The answer — that the plan
  veto stops something starting, not something owed — is defensible and should be
  written rather than left to be inferred.
- **There is no fast path for urgent work.** An unplanned repair runs 14 days of
  voting — 21 if it needs the extension — then a 7-day timelock. An emergency
  override was considered and refused: it would be an authority someone holds
  unilaterally, which is exactly what G1 exists to prevent.
- **A wrongly recorded arrear cannot be erased**, only appended over ([§3.4](#34-information-view)). The
  interface mitigation is presentation, not protection.
- **Permanent public vote attribution** chills dissent in a small building, on
  the votes that are now the design's *only* owner-held control ([§3.4](#34-information-view)).
- **Consensus secures the ledger, not the money** ([§3.5](#35-deployment-and-network-view)). A firm can validate
  impeccably and still mismanage a building.
- **The design depends on institutional participation it cannot compel** ([§3.5](#35-deployment-and-network-view)).
  If independent validator classes free-ride on public read access, the set skews
  to the class the record is about, and P1 fails with it. **QAS-1's guarantee is
  conditional on this** and is stated as conditional in [§2.3](#23-quality-attribute-scenarios).
- **A defect in the published contract set has no forced-fix path.** Versioning
  is out of scope ([ADR-004](decisions/adr/004-versioning-out-of-scope.md)), so the claim in [`product.md` §5.1](product.md#51-the-condition-the-argument-rests-on) — that owners
  cannot have the rules changed underneath them — is complete for a building's
  *running* life and **silent across versions**. A building that never migrates stays on a
  vulnerable version indefinitely. [ADR-010](decisions/adr/010-one-standard-set.md) makes this sharper, not softer: one
  published set means one defect is national.
- **The design very likely requires legislative amendment.** [§3.1](#31-context-view) A1 concedes
  that keeping the elected committee "fits existing law without amendment" — the
  implication being that removing it does not. A design for a body whose powers
  are set by statute, which needs the statute changed, has that as a first-order
  feasibility risk rather than a scope-list line. `[ASSUMED]` that amendment
  would be required: the Unit Titles Act 2010 has not been read against this
  design, and [§7.2](#72-deliberately-out-of-scope) places conformance out of scope.

### 7.2 Deliberately out of scope

Legal and statutory conformance with the Unit Titles Act 2010 — designed against
the domain as described. Consensus implementation. Fiat on-ramp. Identity
verification binding a person to a wallet. Enforcement beyond disclosure and vote
suspension. Dispute arbitration. Vendor tendering. **Versioning of the published
contract set** ([ADR-004](decisions/adr/004-versioning-out-of-scope.md)) — recorded as a decision so the gap is visible rather
than accidental, with its cost stated in [§7.1](#71-what-the-architecture-does-not-prevent).

### 7.3 Assumptions — things a decision rests on

An assumption earns a marker only if a driver, a measure, a scope boundary or a
view would have to change were it false.

| `[ASSUMED]` | Rests on | What changes if it is wrong |
| --- | --- | --- |
| The reference building is ~40 units | [`product.md` §4.3](product.md#43-the-empirical-critique-of-on-chain-governance) reasons about "40 apartment owners". The alternative tier is real and sourced: 1% of developments hold 101 or more units, and that 1% holds 24% of all unit titles (MHUD, 2022) | The whole governance design. At the larger tier the premise that owners can see for themselves what is happening to their building weakens, and with it the argument that publishing the record is sufficient |
| Absolute participation in a 40-owner building resembles absolute participation in a large DAO | Falk et al. (2024) report 6.5 voters per proposal at Lido. The transfer is by voter *count*, not by percentage — see [§2.2](#22-drivers) | P3's status as a primary driver. If small-building turnout is structurally better than DAO turnout, the passive-execution asymmetry is solving a problem that does not exist |
| Amendment to the Unit Titles Act 2010 would be required | [§3.1](#31-context-view) A1's concession about the committee-preserving alternative; the Act has not been read against this design | [§7.1](#71-what-the-architecture-does-not-prevent)'s feasibility risk. If no amendment is needed, the strongest practical objection to the design disappears |
| The excluded share under a citizenship gate is large enough to matter | Ownership by overseas investors, companies and trusts is not sourced by owner type | [ADR-009](decisions/adr/009-publicly-readable.md)'s first reason. Its second and third reasons stand regardless, so the decision survives |

**Four assumptions.** Each one changes something if it is false.

### 7.4 Parameters — all settled

**There are no open parameters.** The seven values this design left unset are now
set, with their bases, in [§2.5](#25-configured-parameters-and-where-each-value-comes-from); the working through of each is in
`method/06-parameters.md`.

Two of the seven closed by **removing the mechanism** rather than by choosing a
number — the objection window and its threshold — and one closed by removing fee
retention entirely. Those are recorded as decisions ([ADR-011](decisions/adr/011-payment-on-attestation.md), [ADR-012](decisions/adr/012-no-built-in-accountability.md)), not as
parameters, because a parameter that was deleted is not a parameter that was set.

[`product.md` §16.3](product.md#163-open-questions) has carried four of these unresolved since the proposal.
They are closed.

### 7.5 Future work

Collected here because an earlier draft scattered it across three views and the
conclusion criterion asks for it in one place.

- **Owners raising proposals, not only the firm** ([§3.1](#31-context-view) A2). The cheapest
  strengthening available, and it closes the agenda-monopoly limit in [§7.1](#71-what-the-architecture-does-not-prevent).
- **Anonymous ballots** via a zero-knowledge scheme such as Semaphore or MACI
  ([§3.4](#34-information-view) A4). Directly resolves the chilling effect on dissent, and would give
  arrears privacy and ballot privacy together. The single most valuable
  extension identified.
- **The maintenance plan and permissionless triggering** (FR24) — completes the
  participation argument by making QAS-10 demonstrable rather than designed.
- **An on-chain sanction of some kind.** Five were designed and refused
  ([ADR-012](decisions/adr/012-no-built-in-accountability.md)), each because it made one party's money contingent on another's
  diligence. That does not mean none can exist — it means none of the five
  obvious ones survives the fairness constraint, and a sixth would have to clear
  that bar explicitly.
- **Oracle-assisted verification of physical completion** — the only line of
  attack on the trust boundary in [§7.1](#71-what-the-architecture-does-not-prevent), and a hard one.
- **Versioning and a designed exit path** ([ADR-004](decisions/adr/004-versioning-out-of-scope.md)). Out of scope here; the first
  thing a real deployment would have to answer.
- **A dispute path for contested payments**, and enforcement against non-payers
  beyond disclosure.
- **An on-chain record of audit outcomes.** The audit is currently entirely
  off-chain and leaves no trace on the ledger. Recording the outcome would extend
  the evidentiary claim — which is now the design's central contribution — to the
  one check that remains on the management firm. It was not adopted because with
  no fee withheld there is nothing on-chain for an audit result to release, so
  the mechanism would have no forcing function; as evidence rather than as a
  trigger, it is worth revisiting.
- **The five rejected accountability mechanisms** — a capital bond, vendor
  retention through a defects period, an owner objection window, owner completion
  approval, and fee withheld pending audit — are not future work but they are
  the record of what was tried. They are set out in [ADR-012](decisions/adr/012-no-built-in-accountability.md), and each was
  rejected for a stated reason rather than dropped.

---

## 8. Decisions

Records live in `decisions/adr/`. A decision earns a record when a competent
engineer could reasonably have chosen otherwise; descriptions of how the system
*is* stay in the views.

| ADR | Title |
| --- | --- |
| 001 | The treasury has only one way to pay money out |
| ~~002~~ | ~~The firm's withheld fees are kept in their own contract~~ — **superseded by 012** |
| 003 | One unit, one vote — and capture needs far fewer than a majority |
| 004 | New versions of the contracts are out of scope |
| 005 | Arrears are published per unit, not just as a building total |
| 006 | There is no elected committee |
| 007 | Permissioned proof of authority, not proof of stake |
| 008 | The maintenance plan cannot be edited once ratified |
| 009 | The ledger is readable by anyone, not gated to citizens |
| 010 | One standard contract set, published once, instantiated per building |
| **011** | **Payment is released by the firm's attestation, with nothing in between** |
| **012** | **Accountability is external; the architecture supplies evidence** |

---

## 9. Coverage map

The document above is organised around its readers. This table is how an assessor
finds each mandated item. **Rows say what is actually there**, including where
the answer is "not offered" — a coverage map that overstates is worse than one
with a gap, because the gap is what gets checked.

### 9.1 Design elements (`overview.md` §2.1 — at least three required)

| Element | Offered? | Where |
| --- | --- | --- |
| System architecture diagrams | **Yes** | [§3.1](#31-context-view) Figure 1 (context), [§3.2](#32-functional-view--the-permission-structure) Figure 2 (contracts and permissions), [§3.5](#35-deployment-and-network-view) Figure 5 (network and validators) |
| Blockchain architecture | **Yes** | [§3.5](#35-deployment-and-network-view) — consensus, validator classes, the one-third rule, public read |
| Smart contract design | **Yes** | [§3.2](#32-functional-view--the-permission-structure) — seven contracts, their functions, and the guard each enforces |
| Data flow | **Yes, as a sequence and a zone diagram** | [§3.3](#33-behavioural-view--the-loop-and-where-it-refuses) Figure 3 traces one payment end to end with its refusals; [§3.4](#34-information-view) Figure 4 shows what flows on-chain versus off-chain. Neither is a classical Gane–Sarson DFD, and the report should call them what they are |
| User stories / use cases | **Yes** | [§3.1](#31-context-view), element catalogue — UC1–UC11, each with actor, goal and flow |
| Database design | **Yes, as the information view** | [§3.4](#34-information-view) — entities, fields, and which expose an identifiable person |
| UI design | **No** | Not offered as a design element. The interface is deliberately authority-free ([§3.2](#32-functional-view--the-permission-structure) R7) and appears only as a lens over events ([§3.4](#34-information-view)). Prototype screenshots evidence it in the report's implementation section; there is no wireframe or screen design, and this map does not claim one |

**Six design elements offered against a required minimum of three.**

**One further gap, recorded in the same spirit as the UI row.** The brief also
asks for technologies, frameworks, tools and key algorithms (`overview.md` §2.2). This document does not carry them — [§6.1](#61-what-is-built-what-is-described) stops at the built/designed split
and the build order. They belong in the report's implementation section, written
from the repository, and [§9.2](#92-marking-criteria-rubricmd) says so rather than pointing an assessor here.

Each carries what it is, why it was chosen, how it contributes, its trade-offs
and its rejected alternatives — in that view's *Rationale*, *Alternatives
considered* and *Evaluation* parts. (Those are the parts named inside each view;
they are not this document's [§4](#4-perspectives--the-traceability-matrix), [§5](#5-evaluation) and [§6](#6-realisation-and-requirements).)

### 9.2 Marking criteria (`rubric.md`)

| Criterion | Marks | Where the report draws from |
| --- | --- | --- |
| Introduction | 5 | [`product.md`](product.md) §[§1](#1-purpose-readers-and-how-to-read-this)–5 |
| System Design | 20 | **This document, §[§2](#2-architecturally-significant-requirements)–4, [§8](#8-decisions)** |
| Prototype Implementation | 20 | **Not carried by this document.** [§6.1](#61-what-is-built-what-is-described) gives the built/designed split and the build order only. The technologies, frameworks, tools, key algorithms and contract snippets the criterion names are written directly into the report's implementation section from the repository, alongside the screenshots. **This is a gap in the SAD, recorded rather than papered over** — the same defect as the requirements row, and it is only half-fixed |
| Functional and Non-Functional Requirements | 20 | **[§6.2](#62-requirements)** — FR1–FR42 and NFR1–NFR15, each traced, marked built or designed, each with its evidence; incomplete ones and their completion routes in [§6.1](#61-what-is-built-what-is-described) and [§7.5](#75-future-work) |
| Testing and Evaluation | 20 | [§5.1](#51-what-the-prototype-demonstrates) tests, [§5.2](#52-what-is-measured-and-reported-with-its-basis) measures with their basis, [§5.3](#53-what-cannot-be-demonstrated-at-all) what cannot be shown, limitations from [§7.1](#71-what-the-architecture-does-not-prevent) |
| Conclusion | 5 | [`product.md` §3](product.md#3-objectives) revisited; **[§7.5](#75-future-work) future work** |
| Reference and Presentation | 10 | [`product.md`](product.md) references |

---

## 10. Tailoring note

What was taken from the method, and what was dropped. Saying so is itself
architectural work.

**Kept.** Stakeholders and concerns before structure (ISO/IEC/IEEE 42010). A
utility tree scored by business impact and technical risk, with scenarios only
for the high/high leaves (ATAM). Views with seven parts each, spanning more than
one view type (Views & Beyond). The viewpoint/perspective split, so that
integrity, containment and participation are walked across every view rather than
given views of their own (Rozanski & Woods). One design iteration per driver —
driver, tactic, elements, responsibilities, analysis (ADD).

**Dropped, with reasons.**

- **No process view.** Consensus serialises every transaction, so there is no
  concurrency to reason about. Maintaining a wrong process view would be worse
  than having none.
- **No variability guide.** Per-building configuration is data, not variation in
  the architecture.
- **No governance material** — no architecture review board, waivers or estate
  constraints. The scenario posits a government operator but not an organisation
  with those processes, and inventing one would be padding.
- **The ADR hand-off was declined.** The method says to hand decision-record
  format to a dedicated skill where one exists. It was kept in-house because the
  records are read by non-specialists and plain language mattered more than
  format consistency with an external convention.
- **The view count was set by the prototype, not by a framework.** Five views
  because the loop crosses five concerns. Three would have satisfied C3 and would
  have dropped [§3.5](#35-deployment-and-network-view) — where the blockchain-versus-database argument lives, which
  C6 mandates.
- **Drivers are presented unordered.** The method offers a ranking; this document
  found three co-equal primaries and says so, because a rank never used as a
  tie-breaker is a rank a reviewer will test with one question.

**Changed after cold review.** A reviewer who had not seen the drafting read the
document against the brief and found 24 defects (`method/05-cold-review.md`).
The structural consequences: [§6.2](#62-requirements) was added because no enumerated requirement set
existed; [§4](#4-perspectives--the-traceability-matrix) became an index rather than a second telling of each view's
perspectives; [§7.3](#73-assumptions--things-a-decision-rests-on) was split from [§7.4](#74-parameters--all-settled) because unset parameters had been filed as
assumptions; two items moved from the constraint list to decision records
([ADR-009](decisions/adr/009-publicly-readable.md), [ADR-010](decisions/adr/010-one-standard-set.md)) because they had been argued for while being called givens;
and the coverage map was rewritten to record what is *not* offered.

**Changed after the parameters were closed.** Setting the seven open parameters
([§2.5](#25-configured-parameters-and-where-each-value-comes-from)) turned into a redesign of the accountability layer. Five mechanisms were
tried and rejected, all for the same reason — each held some party's money
contingent on another party's attention or good faith — and the design arrived at
a narrower claim: **the architecture controls what may be authorised and produces
a record that cannot be revised; it does not adjudicate, withhold or enforce.**
Six functional requirements were withdrawn, one contract left the design, and
three of [`product.md`](product.md)'s headline claims no longer hold. The rejected
mechanisms are in [ADR-012](decisions/adr/012-no-built-in-accountability.md) and are the clearest evidence in this document that the
design was reasoned rather than assumed.

**A note on mode.** This is assignment work. The stakeholders are named and
hypothetical, written to as though real; the assessor is not among them. Numbers
are derived from the sources where they exist and marked `[ASSUMED]` where they
do not.
