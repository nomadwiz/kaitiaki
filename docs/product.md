# Body Corporate Treasury — project proposal

**COMP842 Assignment 1 · Applied Blockchain and Cryptocurrency**
Status: agreed group direction. This document is the project's source of truth for
the problem, the design and the decisions — **except requirements and build scope,
which are owned by [`sad.md` §6.2](sad.md#62-requirements) and condensed for
building in [`spec.md` §8](spec.md#8-requirements).** Those files are not
summaries of this one; where they cover something, they are authoritative and
this document points at them rather than restating.

Nothing is described in two places. Two descriptions of the same thing drift.

`[CITE]` marks a claim whose source has not been read in full.
`[ASSUMED]` marks a value invented rather than sourced.

---

# 1. Executive summary

**A body corporate's money is collected compulsorily and spent by people the
contributors cannot effectively check.** Every owner of a unit in an apartment
development pays a levy they cannot decline; the pooled fund is spent on the
building they part-own; and the record that would let them verify that spending
arrives once a year, in summary, prepared by the party being checked.

This project proposes running a body corporate's finances on a **government-operated
national housing blockchain**. Each body corporate has its own instance on a
shared public network. Within it:

- the **management firm** raises proposals for work the building needs;
- the **unit owners** vote on what is done and which registered vendor does it;
- a **treasury contract** collects levies on schedule and releases payment only
  against an approved proposal, to an approved payee, within an approved cap;
- every levy, vote, attestation and payment is permanently and publicly visible.

**The claim is deliberately bounded.** Running the body corporate this way deletes
administration and discretion. It cannot delete judgement or physical
verification — the roof is still repaired by a person and somebody must still
assert that it was. Automation is not the goal; it is the mechanism. Oversight
becomes achievable because the administrative fog that made it unachievable is
gone.

**The distinguishing design choice** is what the system refuses to do. Five
accountability mechanisms were designed and rejected — a capital bond, vendor
retention, an owner objection window, owner completion approval, and fee withheld
pending audit — each because it made one party's money contingent on another
party's attention or good faith. What remains holds nothing back from anyone:

> The architecture controls what may be authorised and produces a record that
> cannot be revised. It does not adjudicate, withhold or enforce. Those are the
> law's job, and the law already does them — badly, but largely because the
> evidence it works from is poor. **The contribution is the evidence.**

Owners choose who may be paid and what work is approved, and no path moves money
outside that. Everything after payment — an audit the owners may commission,
adjudication, the courts — runs on a record no participant, including the
operator, can revise. Small firms face no barrier to entry because nothing is
required of them up front.

_(Full reasoning: [`decisions/adr/012-no-built-in-accountability.md`](decisions/adr/012-no-built-in-accountability.md).)_

**What will exist at the end:** a working prototype on a test network — membership,
treasury, payee registry and operation-governance contracts, with a web interface
where an owner can read a proposal, vote, watch the funds release against a
verified milestone, and inspect the fund's whole history; plus a test suite
demonstrating that the guarantees in [§5](#5-why-a-blockchain-and-not-a-centralised-database) hold under adversarial conditions.

---

# 2. Problem statement and motivation

## 2.1 The problem

> An elected body controls a pool of money contributed compulsorily by the people
> it is meant to serve, and those people cannot establish how it was spent until
> long after it is gone.

Four features make it the problem it is, and all four must survive into the design.

**Contribution is compulsory.** An owner cannot decline to pay, pay less, or take
their contribution elsewhere. Because unit titles involve collective ownership,
"owners cannot deal with their property unilaterally" (MHUD, 2022). Exit is not
available as a remedy.

**Control is delegated to a few.** A small group decides how the pool is spent.
The owners who funded it do not.

**Visibility is retrospective.** Owners learn how money was spent through periodic
reporting — after the decisions, after the money moved, and in summary.

**Administration swamps oversight.** The same small group carries invoicing,
reconciliation, arrears, meetings, vote counting, maintenance scheduling _and_ the
production of the reports by which it is judged. That load is why the decisions go
unreviewed. Nobody audits what nobody has time to produce.

## 2.2 Who has the problem

**Unit owners paying levies to a body corporate.** Not an abstraction: there were
**14,952 unit title developments in New Zealand as at July 2021**, 77% of them in
Auckland, Christchurch, Wellington, Hamilton and Tauranga, with Auckland alone
holding 45% (MHUD, 2022).

The population exposed is growing by policy design. **40% of residential building
consents in the year to June 2021** were townhouses, flats and units (13,529) or
apartments (4,165) — up from 21% of consents in 2016 (MHUD, 2022). National
policy directing local authorities to enable density means the share continues to
rise.

Concentration matters too: 1% of developments contain 101 or more units, but that
1% holds **24% of all unit titles** in New Zealand (MHUD, 2022, citing the
Australasian Strata Insights Report).

## 2.3 Why it is worth solving

The Crown's own diagnosis names the mechanism. **"One of the main problems is
information asymmetry, where the body corporate generally holds more information
than other parties"** — specifically "information held by the chairperson or BC
committee, of interest to unit owners" (MHUD, 2022). The stated consequence is
owners "feeling that decisions are being made improperly or that decisions are
being made without their input."

Two behavioural causes are identified alongside it. **Optimism bias** "may discount
the future likelihood and scale of future maintenance." **Group think** "may mean
BC committee members consider conflicts of interest are not a problem when making
decisions on behalf of the body corporate" (MHUD, 2022).

Redress is weak. Owners may avoid the Tenancy Tribunal "for fear of retaliatory
action or jeopardised relationships with other unit owners," and applications are
few "potentially because of the high application cost" (MHUD, 2022). Management
firms have historically had no status in the governing legislation and "no
boundaries or requirements on their behaviour," which "could lead to confusion,
mismanagement or, in rare cases, intentional misconduct."

> **The honest limit of this evidence.** The same document states twice that "the
> size of the problem is difficult to quantify" — its evidence is submissions,
> anecdote and a small number of Tribunal decisions. **This report does not claim
> that mismanagement is prevalent.** It claims that the Crown identified
> information asymmetry, optimism bias and conflicted decision-making as
> _structural_ features of the model, serious enough to legislate against. That is
> firmer ground than any individual case.

---

# 3. Objectives

`[DECIDED:31-08-2026]` **The two lists are split by who does the thing.** A
product objective is something the _system_ does, and the Conclusion answers yes
or no to each one. An assignment objective is something _this project_ does.
"State honestly what the system cannot prevent" was in the product list and is a
thing the report does, not the system, so it has moved to [§3.2](#32-assignment-objectives). Each product
objective is now worded so it can be answered rather than merely asserted.

`[DECIDED:31-08-2026]` **Objectives stay objectives; scope is not moved into the
Introduction.** Recasting the report's §1.7 as scope was considered and
rejected: the rubric marks objectives twice — once in the Introduction and again
in the Conclusion, which has to evaluate against them — while scope is marked in
the Requirements criterion instead. Scope therefore stays where it is owned,
[`spec.md` §8](spec.md#8-requirements), and is written up in report Section 4. What the
concern was really about is repetition: report §1.7 was restating §1.5 and §1.6
a third time, so its objectives are now one line each and cross-refer instead of
re-explaining.

## 3.1 Product objectives

1. Produce the financial record continuously and as a by-product of spending
   rather than of administration, so that no reconciliation step exists and
   oversight costs an owner nothing.
2. Move spending decisions from the managing party to the owners who fund them:
   no money leaves a building's fund without a proposal owners have approved.
3. Make specific, nameable classes of misuse structurally impossible rather than
   detectable after the fact — money reaching a party owners have not admitted,
   a payment exceeding its approved limit, and operating money spent on
   long-term maintenance or the reverse.
4. Make the record verifiable by any owner without trusting the party holding the
   money.
5. Give owners evidence strong enough to pursue a remedy against a management
   firm — a complete, attributable record of every payment and approval that no
   participant, including the operator, can revise.

## 3.2 Assignment objectives

1. Produce a report satisfying `overview.md` within 25 pages.
2. Deliver five design elements with what, why, how, trade-offs and alternatives
   considered — against a required minimum of three.
3. Build and demonstrate a working prototype of the loop in [§12.2](#122-build-strategy-one-complete-loop), and explain
   what was designed but not built, why, and how it would be completed.
4. Cite at least five academic or professional sources, every one verified.
5. State honestly what the system cannot prevent, in the report itself and not
   only in the project's own notes.

---

# 4. Background and related work

## 4.1 Multi-owned property governance

Unit title and strata schemes worldwide share the same structure: compulsory
contribution, collective ownership, delegated management, retrospective
reporting. New Zealand's regime requires a long-term maintenance plan covering at
least 10 years, reviewed at least every three; the Crown's preferred reform is a
30-year plan with detailed costings for the first 10 years and a high-level
projection for the remaining 20, on the reasoning that detailed estimates beyond a
decade "become quickly out of date" while inflation and labour-cost predictions
"remain fairly accurate" within one (MHUD, 2022).

That reform document also identifies the failure mode this design targets:
bodies corporate **"may defer maintenance by placing it in the longer-term section
of the LTM Plan in order to avoid immediate levy increases"** (MHUD, 2022).

## 4.2 On-chain governance

The dominant pattern is a governance contract holding proposals, a voting period,
a quorum and a timelock before execution, with the treasury owned by the timelock
so no individual can move funds. OpenZeppelin's Governor and TimelockController
are the audited reference implementation (OpenZeppelin, n.d.).

## 4.3 The empirical critique of on-chain governance

The literature is not flattering, and the design must answer it.

Across Aave, Compound, Lido and Uniswap, roughly **5% of token supply** is cast on
any given proposal — Aave 3.2%, Compound 7.7%, Lido 5.6%, Uniswap 4.6% — and the
"minimal quorum," the fewest voters who could swing a vote, is typically **three or
four**. Lido averaged **6.5 voters per proposal** (Falk et al., 2024).

Across 21 DAOs, fewer than ten addresses held a majority of voting power in **17 of
them**, and no more than three in half. Gini coefficients of voting power sat close
to 1.0. Token-holder participation was "particularly low for all DAOs"
(Feichtinger et al., 2023).

Two further findings shape this design directly. Most DAOs show **over 10–20% of
governance transactions that are "pointless"** — votes cast with no voting power,
self-delegations, zero-value transfers — evidence that on-chain governance defeats
ordinary users, which matters when the electorate is 40 apartment owners
(Feichtinger et al., 2023). And **almost all proposals pass by wide margins**,
because disagreement is resolved in off-chain discussion before the on-chain vote
(Falk et al., 2024) — a warning that an on-chain vote can become ratification
theatre.

## 4.4 Government-operated ledger infrastructure

Estonia is the closest existing precedent for a state operating ledger
infrastructure for public records. Following the 2007 cyberattack, the Estonian
Government and Guardtime began developing **Keyless Signature Infrastructure
(KSI)** in 2008. Its first governmental application was the Succession Registry,
digitised in 2012; it now covers health records, school management, e-ID,
taxation and property registries, and online voting. Each record is hashed,
hashes are combined into a Merkle tree, and the root is anchored into
infrastructure "that runs through a network of secure nodes." Each record carries
a KSI signature containing its hash, the path to the root and a timestamp, so
"anyone can publicly verify the record's integrity, without the need of private
keys" (European Commission, 2025). The same technology has been deployed by the
Dutch Judicial Information Service and US federal agencies.

**But the precedent must be used precisely, and it is narrower than it first
appears.** KSI is _integrity timestamping_. It proves a record has not been
altered. It does not execute contracts, hold value, or reach consensus over state
transitions. So Estonia establishes that **a state can operate tamper-evident
ledger infrastructure at national scale for public records** — it does not
establish that a state runs smart contracts holding money. This project proposes
something materially further, and says so.

The academic critique sharpens this. Semenzin et al. (2022) examine whether
Estonia's applications deliver blockchain's claimed affordances and find "clear
contrasting views between stakeholders and technical experts from inside and
outside the institutional sphere," with the conflict revolving around "two
different social imaginaries associated with permissioned vs. public blockchains."
One Estonian informant puts the objection bluntly:

> "We don't call it a blockchain, we call it a hash-chain. Because blockchain in
> its nature has no central controlled environment; but in Estonia there is always
> a responsible body which stores these hashes or timestamps."

**That objection applies to this project too, and [§5.1](#51-the-condition-the-argument-rests-on) is written to answer it.**
The proposed network is permissioned, so the question of whether a
government-operated chain is "really" a blockchain lands squarely on it. The answer
offered is not that the label applies, but that the _property owners depend
on_ — that no single party, including the state, can revise the record
unnoticed — is delivered by validator diversity plus public verifiability. If that
diversity fails, the criticism is correct.

## 4.5 The gap this project fills

Searching found no published work applying blockchain governance to body corporate
or strata financial management, and none applying it in New Zealand `[CITE — a
claimed gap requires a deliberate search, not an incidental one]`. Existing work
addresses either multi-owned property governance without the technology, or DAO
governance without a domain where contribution is compulsory, the electorate is
small and bounded, and the money funds physical maintenance.

---

# 5. Why a blockchain, and not a centralised database

The system is national infrastructure operated by government. A government could
simply run a database, so this section must be argued rather than assumed.

## 5.1 The condition the argument rests on

Owners do not have to trust the operator's word about the state of their fund.
Every participating institution runs a node that **independently verifies** the
chain, the ledger is **publicly readable**, and no operator — including the
state — can retroactively revise the record, because consensus rests on a
validator set whose members' interests diverge.

**That condition is load-bearing. If government operated every validator, this
would be a database with extra steps**, and the criticism levelled at other
government chains would be correct here too. Validator diversity is what makes the
blockchain claim true, so the architecture treats it as a requirement rather
than an accident ([`deployment-view.md`](decisions/views/deployment-view.md), and NFR-level in [§6.2](#62-the-lifecycle)).

## 5.2 What the database version cannot do

A conventional system can be transparent, but its transparency is _granted_. The
operator decides what to publish, when, and in what form; can correct history
without trace; and can be compelled to. An owner disputing a payment must ask the
holder of the record for the record. That is the status quo with better software.

## 5.3 What the blockchain adds

- **An append-only record** of every levy, vote, attestation and payment that no
  participant, including the operator, can revise.
- **Execution by contract**, so an approved proposal releases funds without
  anyone's permission and a rejected one cannot.
- **Verifiability without trust** — any owner, researcher or journalist can read
  the whole national record and check it themselves.
- **A comparable payment record** across every building a firm manages, which is
  only possible because the network is national rather than per-building. Note
  the limit: this shows _what was paid_, not whether anyone was satisfied. The
  design makes no reputation claim — see
  [`decisions/adr/012-no-built-in-accountability.md`](decisions/adr/012-no-built-in-accountability.md).

## 5.4 What the blockchain does not fix — stated plainly

It does not verify that physical work was done. It does not prevent a voting
majority approving bad work, a vendor overcharging within an approved cap, or a
firm steering work to an associate who then wins a legitimate vote. It cannot
delete a mistaken record. And it does not make the guarantees true if the contract
code is defective — the guarantees are only as good as the code enforcing them,
which is why the standard contract is published and audited once nationally
rather than written per building.

---

# 6. Solution overview

## 6.1 Actors

| Actor                     | Role                                                                                                                                                                       |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Unit owner**            | Pays levies. Votes on proposals and on admitting vendors. Reads the whole record. Collectively, the owners _are_ the body corporate.                                       |
| **Management firm**       | Raises proposals for work the building needs, recommends vendors, attests that work is complete, is paid from the treasury for its services. Holds no power to move funds. |
| **Vendor**                | Admitted to the payee registry by owner vote. Performs work. Receives payment directly.                                                                                    |
| **Schedule**              | A temporal trigger, not a person. Levy issuance and plan-scheduled proposals become callable when due.                                                                     |
| **Land title register**   | External authority for who owns which unit.                                                                                                                                |
| **Stablecoin settlement** | External NZD-pegged asset in which levies and payments are denominated.                                                                                                    |

**There is no committee.** The management firm acts for the body corporate in
raising and administering work; the owners hold every decision. Removing the
committee is a simplification of today's arrangement, and its consequences are
examined in [`decisions/adr/006-no-committee.md`](decisions/adr/006-no-committee.md).

## 6.2 The lifecycle

**Genesis.** The building's instance is created from the published national
standard contract. Its configuration — unit register, owner wallets, fund split,
caps, thresholds, opening balance, and the long-term maintenance plan — is
deliberated by owners, then checked by the contract's own invariants (every unit
bound to exactly one wallet, no wallet bound twice, plan items summing to the
stated total, caps within declared bounds). The treasury cannot spend and levies
cannot be charged until owners **ratify** the configuration at a high threshold
`[ASSUMED]`.

**Levy cycle.** Levies are derived from the plan and the operating budget rather
than negotiated, and become chargeable on schedule. Payment _is_ the record, so
nothing is reconciled. Arrears accrue by rule and are publicly visible
([`decisions/adr/005-arrears-published-per-unit.md`](decisions/adr/005-arrears-published-per-unit.md)).

**Operation cycle.** The firm raises a proposal — the work, a hard cap, and a
vendor from the registry. Owners vote. On passing, the proposal queues through a
timelock. The vendor performs the work. The firm attests completion, **and that
attestation releases payment** to that vendor, within that cap, from that fund.
There is no objection window: see
[`decisions/adr/011-payment-on-attestation.md`](decisions/adr/011-payment-on-attestation.md).

**Maintenance cycle.** Work already in the ratified plan becomes callable when
due. Any party may trigger it — the contract refuses before the due date — and it
proceeds unless owners actively object. Deferral therefore requires a recorded
veto rather than passive neglect.

**Accountability cycle.** Outside the chain. The firm is paid in full as earned;
owners may commission the annual audit the Unit Titles Act already provides for,
and grievances against the firm are pursued afterwards exactly as they are
against a vendor. The chain's role is evidentiary
([`decisions/adr/012-no-built-in-accountability.md`](decisions/adr/012-no-built-in-accountability.md)).

**Ownership churn.** A sale updates the unit's wallet binding from the land title
register. No participant inside the building can alter the electorate.

---

# 7–11. System design — superseded by the architecture description

**The design content of sections 7 to 11 has been cut.** It is now held in
[`sad.md`](sad.md), which supersedes it in full. It was removed rather than left in
place because two descriptions of one design drift apart, and this one already
had: it still described a fee-retention contract and an owner objection window,
neither of which the architecture has.

The report's System Design section is cut from the SAD, not from here.

| What you came for                                                  | Now in                                                                                                                                                                                                                               |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The national network, its validators, and why the ledger is public | [`deployment-view.md`](decisions/views/deployment-view.md), [`decisions/adr/007-proof-of-authority.md`](decisions/adr/007-proof-of-authority.md), [`decisions/adr/009-publicly-readable.md`](decisions/adr/009-publicly-readable.md) |
| The layering of a building instance, and one standard contract set | [`deployment-view.md`](decisions/views/deployment-view.md), [`decisions/adr/010-one-standard-set.md`](decisions/adr/010-one-standard-set.md)                                                                                         |
| The contract decomposition and where authority stops               | [`functional-view.md`](decisions/views/functional-view.md), [`decisions/adr/001-narrow-release-interface.md`](decisions/adr/001-narrow-release-interface.md)                                                                         |
| What is on the chain, what is hashed, and who it exposes           | [`information-view.md`](decisions/views/information-view.md)                                                                                                                                                                         |
| The loop, and the eight places it refuses                          | [`behavioural-view.md`](decisions/views/behavioural-view.md)                                                                                                                                                                         |
| The design decisions and their trade-offs                          | [`decisions/adr/index.md`](decisions/adr/index.md), and the records beside it                                                                                                                                                       |
| The parameter values, and the basis for each                       | [`spec.md` §5](spec.md#5-parameters--statutory-not-chosen)                                                                                                                                                                           |

**Why the objection window and fee retention are gone**, rather than deferred:
[`decisions/adr/011-payment-on-attestation.md`](decisions/adr/011-payment-on-attestation.md) and
[`decisions/adr/012-no-built-in-accountability.md`](decisions/adr/012-no-built-in-accountability.md). The reasoning that removed
them, including the five mechanisms designed and rejected, is in
`method/06-parameters.md`.

The headings below are kept as forwarding addresses. Work across this project
cites these sections by number, and a citation that resolves to nothing is worse
than one that resolves to a redirection.

## 7.3 Consensus and validators

Permissioned proof of authority with a known validator set, and the argument that
validator diversity is what makes the blockchain claim true. Now
[`deployment-view.md`](decisions/views/deployment-view.md) and [`decisions/adr/007-proof-of-authority.md`](decisions/adr/007-proof-of-authority.md).

## 9.1 The principle that shapes the decomposition

The guarantees are properties of what each contract is permitted to call, not of
what its code intends. Now [`functional-view.md`](decisions/views/functional-view.md) and
[`decisions/adr/001-narrow-release-interface.md`](decisions/adr/001-narrow-release-interface.md).

## 9.3 The guarantees

The four guarantees, G1–G4. Now [`spec.md` §2](spec.md#2-the-four-guarantees), which also records each
one's status after the accountability redesign.

## 9.5 Events are the audit trail

What each contract emits, and why the event log is the record rather than a
by-product of it. Now [`information-view.md`](decisions/views/information-view.md).

## 11.2 Owners vote; there is no committee

Now [`decisions/adr/006-no-committee.md`](decisions/adr/006-no-committee.md).

## 11.3 Accountability without a deposit

**The mechanism this section described no longer exists.** It combined portable
reputation, fee retention and owner claims. It was withdrawn along with four
other candidates because each made one party's money contingent on another
party's attention or good faith. See
[`decisions/adr/012-no-built-in-accountability.md`](decisions/adr/012-no-built-in-accountability.md) for the replacement position —
the architecture supplies evidence rather than sanctions — and
`method/06-parameters.md` for the five mechanisms and why each failed.

## 11.4 Completion attestation, and the objection window

**The objection window no longer exists.** The firm's attestation releases
payment directly, with nothing in between. See
[`decisions/adr/011-payment-on-attestation.md`](decisions/adr/011-payment-on-attestation.md). The attestation trust boundary is
unsolved and is named as such in [`sad.md` §7.1](sad.md#71-what-the-architecture-does-not-prevent).

## 11.5 Arrears are public

Arrears are published per unit rather than as a building total, with the
aggregate alternative recorded. Now
[`decisions/adr/005-arrears-published-per-unit.md`](decisions/adr/005-arrears-published-per-unit.md) and [`information-view.md`](decisions/views/information-view.md).

## 11.6 The maintenance plan is immutable for its term

Now [`decisions/adr/008-immutable-plan.md`](decisions/adr/008-immutable-plan.md).

---

# 12. Implementation plan

## 12.1 Stack

Smart contracts in Solidity, using audited components where they exist; a web
interface that reads emitted events and holds no authority of its own; deployment
to a public test network standing in for the national network. Tooling beyond that
is not settled and is deliberately not recorded here.

## 12.2 Build strategy: one complete loop

The prototype implements **one complete path through every subsystem, rather than
one subsystem completely**:

> An owner pays a levy → the treasury holds it → the firm raises a proposal naming
> work, a cap, a fund and a registered vendor → owners vote → it passes → the
> timelock delays it → the firm attests completion → the treasury releases to that
> vendor, within that cap, from that fund → the interface shows all of it from
> emitted events.

**Why a closed loop rather than breadth.** The architectural claim is about how the
parts constrain each other — that authority is restricted at the boundary, that the
contracts compose, that state is reconstructible from public data. A loop
demonstrates that; several thoroughly-built subsystems that never meet demonstrate
none of it. This is a design decision with a rationale, and the report states it in
those terms rather than as a shortfall.

The operation and maintenance flows share a spine — payee registry, treasury, cap
enforcement, attestation, release — differing only in how a proposal arises and how
it is authorised. The loop builds that spine, so the maintenance path remains a
described extension rather than a separate system.

**Scope detail lives in [`spec.md` §8](spec.md#8-requirements)**, which marks every
requirement `Slice` (built) or `Designed` (specified, not built) and records why,
what constrained it, and how it would be completed — as `overview.md` §2.3
requires.

---

# 13. Requirements

**The requirement set is maintained in [`spec.md` §8](spec.md#8-requirements)**, not
duplicated here. That file is the single source of requirement identifiers.

It holds **FR1–FR42** and **NFR1–NFR15**. Six functional requirements are struck
through, having been removed with the accountability redesign; their identifiers
are deliberately not reused. Nine of those remaining are designed rather than
built, and [§6.1](#61-actors) of that file names each one.

Each requirement carries what it traces to (a guarantee, a use case, or a feature
of the problem), whether it is in the built loop or designed only, and the test
that decides pass or fail. Every non-functional requirement carries a measure and
a method, because an unfalsifiable non-functional requirement is a wish rather
than a requirement.

**No summary table is kept here.** An earlier one used an `F`/`N` identifier
scheme belonging to a requirements plan that was deleted; it survived the plan by
several weeks and disagreed with the real set on both the scheme and the counts.
That is the failure the rule below exists to prevent.

**Do not restate requirements in this document.** Two lists of the same
requirements drift, and identifiers colliding across files is worse than having no
identifiers at all.

---

# 14. Testing and evaluation — superseded by the architecture description

**This section has been cut.** The test set is held in [`spec.md` §7](spec.md#7-the-eight-refusals--each-one-is-a-test), which
supersedes it. The version here still listed _an objection sustained_ among the
scenario tests, for a mechanism the design no longer has.

| What you came for                                | Now in                                                           |
| ------------------------------------------------ | ---------------------------------------------------------------- |
| The ten tests, and what each one decides         | [`spec.md` §7](spec.md#7-the-eight-refusals--each-one-is-a-test) |
| What cannot be tested, and why saying so matters | [`spec.md` §7](spec.md#7-the-eight-refusals--each-one-is-a-test) |
| How each requirement is evidenced                | [`spec.md` §8](spec.md#8-requirements)                           |

## 14.3 Adversarial tests — the headline evidence

Kept as a forwarding address. One test per guarantee, each expected to revert —
now [`spec.md` §7](spec.md#7-the-eight-refusals--each-one-is-a-test), which carries the full set of ten and marks which of
them the built prototype can actually run.

---

# 15. Risks, scope and future work

## 15.1 Scope boundary

**Out of scope.** Legal and statutory conformance — the system is designed against
the domain as described, not against the Unit Titles Act 2010, and a real
deployment would require a conformance pass. Fiat on-ramp. Identity verification
binding a person to a wallet. Enforcement against non-payers beyond disclosure and
vote suspension. Dispute arbitration. Vendor tendering. Consensus mechanism
implementation — the network is designed and described, not stood up.

## 15.2 Risks

| Risk                                                                                  | Impact                                                               | Mitigation                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Team new to Solidity                                                                  | High                                                                 | Audited OpenZeppelin components; P1–P4 kept small; start early; week 1 budgets for the learning cost and week 7 absorbs the overrun                                                               |
| Scope creep beyond the loop                                                           | High                                                                 | Every requirement is built or designed-only in [`spec.md` §8](spec.md#8-requirements); there is no middle category for work to drift into                                                         |
| "It's just a database" objection                                                      | High                                                                 | Met head-on in [§5.1](#51-the-condition-the-argument-rests-on) with validator diversity as a stated requirement                                                                                   |
| Independent validators do not participate, leaving the set skewed to management firms | High — [§5.1](#51-the-condition-the-argument-rests-on) fails with it | Motivations argued in [`deployment-view.md`](decisions/views/deployment-view.md); minimum-composition rule enforced by the operator; named as an adoption dependency rather than a solved problem |
| Attestation trust boundary attacked as unsolved                                       | Medium                                                               | It _is_ unsolved; named in [`sad.md` §7.1](sad.md#71-what-the-architecture-does-not-prevent) and [`decisions/adr/012-no-built-in-accountability.md`](decisions/adr/012-no-built-in-accountability.md) rather than hidden                              |
| Arrears publication attacked as disproportionate                                      | Medium                                                               | Trade-off and mitigation in [`decisions/adr/005-arrears-published-per-unit.md`](decisions/adr/005-arrears-published-per-unit.md), with the aggregate alternative recorded                         |
| Testnet instability before the demo                                                   | Medium                                                               | Local-chain fallback; capture screenshots early                                                                                                                                                   |

## 15.3 Future work

Zero-knowledge proof of good standing, allowing an owner to prove they are
current on levies without revealing which owner they are — Semaphore is the
standard primitive, and it would give arrears privacy and ballot privacy together.
Oracle-assisted verification of physical completion. The maintenance plan and
permissionless triggering. A dispute path for contested claims. The full list,
with what each would cost, is [§15.3](#153-future-work).

---

# 16. Team, timeline and open questions

## 16.1 Timeline

**A group of three. Seven weeks, ending 18 October 2026.** The assignment is due
**25 October**; the group works to the 18th and holds the last week back. The
brief itself states no deadline, so both dates come from the group.

| Week | Dates          | Focus                                                                                                                                                        |
| ---- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | 30 Aug – 5 Sep | Foundations and the first contracts. Expect little visible output — budgeting for the learning cost prevents panic in week 3.                                |
| 2    | 6 – 12 Sep     | Treasury with two funds and the narrow release interface; payee registry. **System Design drafted from the SAD this week**, not left for the end.            |
| 3    | 13 – 19 Sep    | Governance and timelock wiring; the proposal lifecycle end to end                                                                                            |
| 4    | 20 – 26 Sep    | Test suite, including all four adversarial tests. **Hard gate — if the contracts are not feature-complete, stop adding and start testing anyway.**           |
| 5    | 27 Sep – 3 Oct | Minimal interface; deployment to a test network; screenshots. **Nothing new is built after this week.**                                                      |
| 6    | 4 – 10 Oct     | Report only.                                                                                                                                                 |
| 7    | 11 – 17 Oct    | **Contingency.** Held empty on purpose. If weeks 1–6 hold, this is proofreading and the pre-submission checklist; if they slip, this is where the slip goes. |

**Why the seventh week is empty.** The alternative was to spend it building —
`MaintenancePlan`, or letting owners raise proposals. Both were considered and
declined: a team new to Solidity, with 80 of 100 marks resting on written work,
is better served by a week it can afford to lose than by one more contract. That
is a choice, and the report should say so rather than let it read as running out
of time.

**The schedule's real risk is the report, not the code.** Prototype
Implementation carries 20 marks; the remaining 80 are written. System Design is
cut from [`sad.md`](sad.md) and should be drafted in week 2 rather than treated as
week-6 work.

## 16.2 The stack, and why each piece is there

Chosen 1 September 2026, from the team the project actually has: three people,
comfortable with JavaScript and TypeScript and with Git, new to Solidity (C9).

| Piece             | Choice                                                                                                                                                    | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Contracts         | Solidity 0.8.36, fixed pragma; optimiser on, 200 runs; `prague` EVM target. OpenZeppelin Contracts 5.6.1 — `AccessControl`, `TimelockController`, `ERC20` | The timelock and the role machinery are the parts hardest to get right by hand, and the only parts where an audited component costs the argument nothing ([ADR-013](decisions/adr/013-own-voting-contract.md)). `[DECIDED:02-09-2026]` OpenZeppelin 5.6.1 sets the floor at `^0.8.20`; 0.8.36 is the current release. The version and the EVM target are pinned, and the pragma fixed rather than floating, because [`spec.md` §8](spec.md#8-requirements) requires gas per owner per levy cycle to be measured (NFR11) and the report publishes the number — a measurement is only meaningful if the bytecode behind it can be reproduced |
| Voting            | Written for this project                                                                                                                                  | [ADR-013](decisions/adr/013-own-voting-contract.md) — there is no general execution path to constrain because none is written                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Toolchain         | Hardhat 3.15 with `@nomicfoundation/hardhat-toolbox-mocha-ethers`. Node 22.13 or newer                                                                    | Keeps the JavaScript tooling the team knows for the interface and the deployment scripts, while allowing tests to be written in Solidity. Hardhat 3 refuses to start below Node 22.13, so the exact version is pinned in `.nvmrc` and three laptops and the CI runner agree                                                                                                                                                                                                                                                                                                                                                                |
| Testing           | **Solidity tests** (`.t.sol`, `npx hardhat test solidity`), with `forge-std` assertions and cheatcodes; built-in coverage and gas statistics              | See the note below. TypeScript is kept only where a claim is off-chain by definition                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Settlement        | `MockNZD`, a mock ERC-20 standing in for the NZD stablecoin, mintable only on the Hardhat network and Sepolia                                             | C13 names the real dependency; the prototype issues nothing ([`context-view.md`](decisions/views/context-view.md))                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Interface         | Vite and `ethers`, reading events                                                                                                                         | The interface holds no authority ([`functional-view.md`](decisions/views/functional-view.md)), so a thin one is faithful rather than a shortcut. It exists to produce legible screenshots (C7)                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Public deployment | A public test network, week 5                                                                                                                             | Not the permissioned chain the design assumes. FR42's readability claim is argued rather than demonstrated, and [`spec.md` §8](spec.md#8-requirements) already says so                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

`[DECIDED:02-09-2026]` **Tests are written in Solidity, not TypeScript.** The
earlier choice was TypeScript, on the reasoning that it is the one language the
team already has. That was reversed for precision: a Solidity test _is_ a
transaction, so `msg.sender`, reverts, storage and gas behave exactly as they
will in production, whereas a TypeScript test describes the EVM through a client
library whose own behaviour — how a custom error is decoded, how a revert
bubbles — becomes a source of failures that say nothing about the contract. It
is the less friendly option and the group has accepted that.

Three consequences follow. Hardhat 3's Solidity tests are Foundry-compatible, so
`vm.prank` and the rest of the cheatcodes are available and each of the eight
refusals is a short, direct test. **Fuzz and invariant tests come with them**,
which matters most for G3 and G4: instead of asserting that 5,001 against a
5,000 cap reverts, the test asserts that no amount above the cap ever succeeds.
And coverage and gas statistics are built into Hardhat 3, so
`hardhat-gas-reporter` and `solidity-coverage` are no longer needed.

**What stays in TypeScript, and why.** The QAS-4 replay test derives every
balance from the event log alone, on an independent node, without reading
contract storage — it is off-chain by definition, and writing it in Solidity
would defeat the claim it exists to prove. The week-5 interface is TypeScript for
the same reason it always was. Everything that runs against the contracts is
Solidity.

**Two things to do early because they bite late.** Test-network funds are
unreliable to obtain and are needed in week 5, so they are acquired in week 2 and
held. And coverage and gas statistics are exercised in week 1 rather than left
until they are needed, because retro-fitting measurement in week 4 produces
numbers nobody trusts. Both are built into Hardhat 3, so this costs a command,
not a dependency.

**How three people divide it.** `[DECIDED:02-09-2026]` The work is split into
three **verticals**, one owner each. Each owner designs their slice, builds it,
and writes the report material for it — their part of Section 3, their rows in
Section 4's requirements table, their rows in Section 5's test table. The person
who wrote a guard is the person who can explain what it refuses.

| Owner                 | Vertical                                                          | Also owns                                                                       |
| --------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Nicholas (`nomadwiz`) | **Money in** — `MembershipRegistry`, `LevyLedger`, the mock token | Sections 1, 2, 5 and 6; the week-6 consistency pass; reviews every pull request |
| `tutd-work`           | **Money out** — `Treasury`, `PayeeRegistry`                       | Test-network funds, the read interface, deployment; Section 3                   |
| `laysokhour-computer` | **Decisions** — `Governance`, `Timelock`                          | Repository, CI and the contract interfaces in week 1; README; Section 4         |

**Nobody writes the refusal tests for their own contracts.** Money out's four
guards — B2′, B3, B4 and B5, which are exactly G1 to G4 — are proved by
Nicholas, who does not build `Treasury`; Decisions' by `tutd-work`; Money in's by
`laysokhour-computer`. It is free peer review, and it catches the failure a
single author cannot: a test that encodes the same misunderstanding as the code.

**Why Nicholas takes the smallest vertical.** He reviews every pull request and
owns the report's argument, and Money in is both the lightest slice and the one
that finishes earliest — around week 3, as the other two peak. Taking the four
Money-out refusal tests means he still verifies the guarantees himself rather
than trusting a review to catch a subtle gap.

**The build order is still serial.** `MembershipRegistry` → `Treasury` +
`PayeeRegistry` → `Governance` + `Timelock` → `LevyLedger` ([`spec.md` §8](spec.md#8-requirements)).
Verticals give ownership, not independence: interfaces are written before
implementations so anyone blocked can work against a stub instead of waiting, and
week 1 is shared whatever the vertical map says.

**Report drafting starts in week 2**, in parallel with the code rather than after
it. [§16.1](#161-timeline) already names the report as the schedule's real risk. Three authors
writing one document is the cost of this split, so the week-6 consistency pass is
not optional — without it the seams show as different terms for the same thing
and identifiers that drift from [`spec.md` §8](spec.md#8-requirements).

**The task breakdown lives in `issues.md`**, one issue per unit of work,
each carrying the requirement and test identifiers it closes.

## 16.3 Open questions

1. ~~Confirm group size and the deadline.~~ **Closed, 30 Aug 2026.** Three
   members; due 25 October 2026, with the group working to 18 October. C8 in
   [`sad.md` §2.1](sad.md#21-constraints--fixed-and-not-ours-to-trade) is updated, and [§16.1](#161-timeline) carries the dated plan.
2. ~~Does the lecturer require topic approval, or is the topic the group's own
   call?~~ **Closed, 30 Aug 2026.** The lecturer has approved the topic.
3. ~~Voting window, passing threshold, timelock delay and objection window.~~
   **Closed.** All parameters are set with stated bases in [`spec.md` §5](spec.md#5-parameters--statutory-not-chosen);
   the objection window no longer exists. Derivation:
   `method/06-parameters.md`.
4. Which designed-only requirements to promote into the built loop if week 4
   goes well. **Provisionally none** — [§16.1](#161-timeline) spends the seventh week on
   contingency rather than scope, and the candidates were declined on that
   basis. Re-open it at the week-4 gate only if the test suite is complete and
   ahead of schedule; the candidates are named in [`spec.md` §8](spec.md#8-requirements), and
   FR23 (owners raising proposals, not only the firm) is the cheapest.

---

# References

Buddle Findlay. (n.d.). _A guide to the Unit Titles Act 2010_.
https://www.buddlefindlay.com/media/1372/a_guide_to_the_unit_titles_act_2010.pdf

Construction Contracts Act 2002 (N.Z.).
https://www.legislation.govt.nz/act/public/2002/46/en/latest/

Crockers. (n.d.). _Body corporate audits, and why Crockers goes further_.
https://www.crockers.co.nz/body-corporate/news/body-corporate-audits-and-why-crockers-goes-further/

European Commission. (2025). _The use of the National Blockchain Infrastructure to
support the E-Residency Initiative in Estonia_ (Public Sector Tech Watch case
PSTW-2142). Interoperable Europe Portal.
https://interoperable-europe.ec.europa.eu/collection/public-sector-tech-watch/use-national-blockchain-infrastructure-support-e-residency-initiative-estonia

Falk, B., Pathan, T., Rigas, A., & Tsoukalas, G. (2024). _Blockchain governance:
An empirical analysis of user engagement on DAOs_ (arXiv:2407.10945). arXiv.
https://arxiv.org/abs/2407.10945

Feichtinger, R., Fritsch, R., Vonlanthen, Y., & Wattenhofer, R. (2023). _The
hidden shortcomings of (D)AOs: An empirical study of on-chain governance_
(arXiv:2302.12125). arXiv. https://arxiv.org/abs/2302.12125

Immunefi. (2022, April 22). _Hack analysis: Beanstalk governance attack, April
2022_. Medium.
https://medium.com/immunefi/hack-analysis-beanstalk-governance-attack-april-2022-f42788fc821e

Lane Neave. (n.d.). _Payment claims and payment schedules under the Construction
Contracts Act_.
https://www.laneneave.co.nz/news-events/payment-claims-and-payment-schedules-under-the-construction-contracts-act/

Ministry of Housing and Urban Development. (2022). _Regulatory impact statement:
Unit Titles (Strengthening Body Corporate Governance and Other Matters) Amendment
Bill: Policy proposals_. New Zealand Government.
https://www.hud.govt.nz/assets/Uploads/Documents/Proactive-release-Regulatory-Impact-Statement-REDACTED.pdf

OpenZeppelin. (n.d.). _Governance_. Retrieved July 31, 2026, from
https://docs.openzeppelin.com/contracts/5.x/governance

Privacy & Scaling Explorations. (n.d.). _Minimal Anti-Collusion Infrastructure
(MACI)_. Retrieved July 31, 2026, from https://maci.pse.dev/

Semenzin, S., Rozas, D., & Hassan, S. (2022). Blockchain-based application at a
governmental level: Disruption or illusion? The case of Estonia. _Policy and
Society, 41_(3), 386–401. https://doi.org/10.1093/polsoc/puac014

Unit Titles Act 2010 (N.Z.).
https://www.legislation.govt.nz/act/public/2010/22/en/latest/

Unit Titles Regulations 2011 (N.Z.).
https://www.legislation.govt.nz/secondary-legislation/pco-drafted/2011/122/en/latest/

Unit Titles Services. (n.d.-a). _Body corporate meetings_. New Zealand
Government. https://www.unittitles.govt.nz/body-corporate-how-it-works/body-corporate-meetings/

Unit Titles Services. (n.d.-b). _How the body corporate makes decisions_. New
Zealand Government. https://www.unittitles.govt.nz/body-corporate-how-it-works/decision-making/

**Verification status.** MHUD (2022), Falk et al. (2024), Feichtinger et al.
(2023), European Commission (2025) and Semenzin et al. (2022) have been read and
every figure and quotation above is taken from the source text. Immunefi,
OpenZeppelin and MACI are inherited from earlier work and were recorded as
verified then.

**The statutory sources carry a provenance caveat that must be stated.** The
quorum, resolution thresholds, notice periods, adjournment rule, audit
obligation and payment-schedule period used to set this design's parameters
([`spec.md` §5](spec.md#5-parameters--statutory-not-chosen)) were taken from **secondary sources describing the
legislation** — the Crown's own guidance at unittitles.govt.nz, Buddle Findlay's
practitioner guide, and Lane Neave on the Construction Contracts Act.
**legislation.govt.nz refused automated access, so the primary text of Unit
Titles Act 2010 s95 and of the Regulations was not read directly.** The
secondary sources agree with one another on every figure used, and two of them
are government-published; but the Acts are cited above as the authority and the
report should either verify the sections directly before submission or cite the
guidance rather than the statute. **Do not let a parameter's provenance rest on a
source that was not opened.**

**Fifteen sources against a required minimum of five**, of which nine are
academic, governmental or statutory.

One `[CITE]` remains: the literature-gap claim in [§4.5](#45-the-gap-this-project-fills). A claimed absence in the
literature needs a deliberate, documented search behind it — not an incidental
one — so either run that search or soften the claim before submission.

---

# Appendix A — Coverage map

Proving the report can be built from this document, without letting the rubric
dictate its structure.

| Report section (`overview.md` §3)                                                                                        | Rubric row (marks)            | Source here                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------ | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Title page                                                                                                            | —                             | [§16](#16-team-timeline-and-open-questions)                                                                                                                                                               |
| 2. Introduction — problem, motivation, objectives, background, literature, blockchain justification                      | Introduction (5)              | §[§1](#1-executive-summary), 2, 3, 4, 5                                                                                                                                                                   |
| 3. System design — architecture, blockchain architecture, data flow, use cases, smart contract design, UI, justification | System Design (20)            | [§6](#6-solution-overview) for orientation; the design itself is [`sad.md`](sad.md) §2–§4                                                                                    |
| 4. Prototype implementation — technologies, algorithms, contracts, screenshots                                           | Prototype (20)                | [§12](#12-implementation-plan), screenshots from week 5                                                                                                                                                   |
| 5. Functional and non-functional requirements                                                                            | Requirements (20)             | [`spec.md` §8](spec.md#8-requirements), evidence from [`spec.md` §7](spec.md#7-the-eight-refusals--each-one-is-a-test)                                                                                    |
| 6. Testing and evaluation                                                                                                | Testing (20)                  | [`spec.md` §7](spec.md#7-the-eight-refusals--each-one-is-a-test), limitations from [§5.4](#54-what-the-blockchain-does-not-fix--stated-plainly), [§15](#15-risks-scope-and-future-work) and [`sad.md` §7.1](sad.md#71-what-the-architecture-does-not-prevent) |
| 7. Conclusion — achievements, objectives met, future work                                                                | Conclusion (5)                | [§3](#3-objectives) revisited; [§15.3](#153-future-work)                                                                                                                                                  |
| 8. References                                                                                                            | Reference & Presentation (10) | References above                                                                                                                                                                                          |
| 9. Appendix                                                                                                              | —                             | This appendix; full source in the GitHub repo                                                                                                                                                             |

**Design elements** — the brief requires at least three. The SAD supplies five,
each with what it is, why it was chosen, how it helps, its trade-offs and the
alternatives considered: the context view ([`context-view.md`](decisions/views/context-view.md)), the functional
view and contract decomposition ([§3.2](#32-assignment-objectives)), the behavioural view and data flow
(§3.3), the information view (§3.4), and the deployment and network view (§3.5).
The decision records in `decisions/adr/` carry the trade-offs in full.
