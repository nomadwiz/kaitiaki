# View — Functional (component-and-connector, permission structure)

**SAD [§3.2](../../sad.md#32-functional-view--the-permission-structure).** Answers **Q2** (where does authority stop), **Q8** (where is every
path that moves money, and what constrains each one), **Q10** (which invariants
hold by construction, which by convention), **Q18** (what the firm is exposed to).

**Primary readers:** R1 build team, R3 contract auditor.
**Drivers that forced it:** QAS-5, QAS-6, QAS-8 (P2 authority containment).

Seven parts, per the method. This is the first view built whole, and its cost is
the estimate for the other four.

---

## 1. Primary presentation

`figures.drawio` — page **Figure 2 — Component view**

**View type.** Component-and-connector, with the authority boundary drawn
explicitly rather than implied. Components are deployed contracts; connectors
are permitted calls, each carrying the guard the callee enforces.

**Notation.** UML 2.5.1 component diagram — components, `«interface»`
classifiers with realisation and `«use»` dependencies, grouped in a package for
the building instance. The guard on each dependency is written as a UML
constraint in braces, which is how the diagram says *who may call what, and what
refuses* in standard notation rather than in a private one.

**Caption.** *Figure 2 — Component view: the permission structure of one
building instance. Answers: where is every path that moves money, and what
constrains each one?*

**The convention that makes the diagram readable, stated once.** An unlabelled
call does not exist. Every arrow carries the guard its target enforces, so the
absence of an arrow between two boxes is a claim — that there is no such path —
and not an omission for tidiness.

---

## 2. Element catalogue

### 2.1 Contracts

| Element | Responsibility | Externally callable | Guard enforced |
| --- | --- | --- | --- |
| `MembershipRegistry` | Unit → wallet bindings; voting eligibility | `bindUnit` | Land-title adapter role only |
| | | `isOwner`, `unitsOf` | view |
| `LevyLedger` | Derives levies from plan and budget; issues charges; tracks arrears | `issueCharges` | permissionless; **reverts before the due date** |
| | | `payLevy` | any payer; credits the unit, not the payer |
| | | `arrearsOf` | view |
| `MaintenancePlan` **(designed, not built)** | The ratified plan: items, due dates, caps | `itemDue`, `capOf`, `fundOf` | view |
| | | **— no mutator —** | *the absence is the mechanism* |
| `Governance` | Proposals, voting windows, thresholds, queueing, attestation | `propose` | firm key only; **reverts if payee unregistered** |
| | | `triggerPlanItem` *(designed)* | permissionless; reverts before due date |
| | | `castVote` | wallets `MembershipRegistry.isOwner` recognises |
| | | `attest` | firm key only; requires the proposal to have passed |
| | | `queue`, `execute` | permissionless once the voting window and timelock have elapsed |
| `Timelock` | Delay between approval and execution | `schedule`, `execute` | `Governance` only |
| | | *holds `RELEASER_ROLE` on `Treasury`* | **sole holder** |
| `Treasury` | Custody; the single outward money path | `release(fund, payee, amount, proposalId)` | `RELEASER_ROLE` **and** payee registered **and** `amount ≤ proposal.cap` **and** `fund == proposal.fund` |
| | | *role administration* | **Renounced at deployment.** No address can grant `RELEASER_ROLE` after construction — see R8 |
| | | `deposit` | `LevyLedger` only |
| | | `balanceOf(fund)` | view |
| `PayeeRegistry` | Vendors admitted by affirmative owner vote | `admit` | reachable only through an executed affirmative proposal |
| | | `isRegistered` | view |

### 2.2 Actors and external elements

| Element | Nature | Authority held |
| --- | --- | --- |
| Unit owner wallet | Actor, bound to a unit | Vote and pay levies. Nothing else — and nothing at all after the work vote |
| Management firm key | Actor | Propose, attest. **No path to move funds** |
| Public caller | Actor, unauthenticated | Trigger due items, queue, execute — none of which chooses anything |
| Network operator | External | Publishes the standard set. **Holds no role inside a ratified instance** |
| Land title register | External authority | Writes unit bindings through a narrow adapter role |
| NZD stablecoin | External ERC-20 | Value transfer only |
| Registered vendor | External | Receives payment. Cannot initiate |
| Web interface | External | Reads events. **Holds no authority whatsoever** |

### 2.3 Relationships

Three paths move value, and every one passes through `Treasury`:

1. Owner → `LevyLedger` → `Treasury` — levies in, split by fund at deposit.
2. `Timelock` → `Treasury.release` → vendor — the only outward path for work.
3. `Timelock` → `Treasury.release` → firm — the management fee, paid in full.
Everything else in the diagram is a read, an eligibility check, or a state
transition that moves no value.

---

## 3. Context

This view is the **inside of the "building instance" box** in the context view
([`context-view.md`](context-view.md)). It says nothing about where these contracts run, who validates the
chain, or whether the operator can revise history — that is [`deployment-view.md`](deployment-view.md), and P1 is
addressed there, not here. It also draws no ordering: the sequence in which
these calls legitimately occur is [`behavioural-view.md`](behavioural-view.md)'s job, and the two must be read together
before the design is understood.

Scope of this view is **one instance**. Multiply by 14,952 developments (MHUD,
2022) and the questions that arise — divergent versions, a defect in the
published standard — are [`deployment-view.md`](deployment-view.md)'s, not this view's.

---

## 4. Rationale

Each decision tied to a named driver.

**R1. The treasury exposes one narrow release interface, and the executing role
is granted nothing broader.** ← QAS-5, QAS-8 (P2).
This is the load-bearing move of the whole design. A conventional governance
contract executes whatever calldata a passed proposal carries; under that
design G3 (cap) and G4 (fund separation) cannot hold, because a proposal could
carry any call at all. Restricting authority *at the boundary* means proposal
text is never trusted to restrain anything. Recorded as **[ADR-001](../adr/001-narrow-release-interface.md)**.

**R2. `Timelock` is the sole holder of `RELEASER_ROLE`.** ← QAS-5 (P2).
Makes G1 checkable by reading access-control state rather than by reasoning
about code paths. An auditor's answer to *"who can move money"* becomes a
one-line query with a one-element answer.

**R3. Payee admission requires an affirmative vote; work may pass passively *(the passive half is designed only — in the built loop work needs a vote too)*.**
← QAS-6, QAS-8 (P2), and deliberately against P3.
The asymmetry is the architecture's answer to key compromise: an attacker
holding the firm's key can raise proposals all day and reach no new address.
[`product.md` §9.3](../../product.md#93-the-guarantees) states it as *"work may be approved passively; a payee
never is"*, and QAS-8 is what tests it.

**R4. Triggers are permissionless and refuse before their due date.** ← QAS-10
(P3), S3. *Built for levy charges; the plan-item trigger this rationale also
covers is designed only.*
Nothing on-chain wakes itself up. Making the trigger open to anyone preserves
the property that no privileged party decides *when* work comes up for
decision, and it is what lets a plan item execute at 0% turnout while an
unplanned proposal correctly stalls.

**R5. `MaintenancePlan` has no mutator** *(designed — the contract is not built,
so the absence of an edit function is an argument, not a test)*. ← T5,
[`product.md` §11.6](../../product.md#116-the-maintenance-plan-is-immutable-for-its-term).
Every attack on a mutable plan needs an amendment path to exist. Removing the
path removes the class by construction, which is stronger than any threshold.
The cost — a plan wrong at ratification stays wrong — is accepted knowingly.

**R6. There is no accountability mechanism inside the contract set.** ← Q18,
[ADR-012](../adr/012-no-built-in-accountability.md).
An earlier design withheld a share of the firm's fee in a separate contract. It
was removed: withholding a firm's earnings against a condition the owners control
makes its pay contingent on their diligence, which is the same defect that sank
four other mechanisms ([ADR-012](../adr/012-no-built-in-accountability.md)). The firm is paid in full as earned, and
grievances against it are pursued off-chain exactly as they are against a vendor.
**The contract set's contribution to accountability is the record, not a
sanction.**

**R8. Role administration is renounced at deployment.** ← QAS-1, and Q10.
Without this, whoever deployed the instance could re-grant the release
permission at any time, and G1 would hold only against parties who did not
deploy it. Since the operator publishes the standard set, that would leave the
operator able to reach a building's funds — the exact party P1 exists to
constrain. Renouncing turns R2's claim from *"one address currently holds this"*
into *"one address can ever hold this"*, which is the version an auditor can
verify once instead of continuously.

**R7. The interface holds no authority.** ← Q3, P1.
Every rule the UI appears to enforce is enforced in a contract. This is what
makes QAS-4 meaningful: an owner can discard the project's interface entirely
and still reconstruct the record.

---

## 5. Alternatives considered

**A1. OpenZeppelin `Governor` + `TimelockController` executing arbitrary
proposal calldata — the standard pattern (OpenZeppelin, n.d.).**
*Rejected.* It is the audited reference implementation and using it wholesale
would have been the defensible-looking choice. But its execution model is
maximally permissive: a passed proposal executes whatever call it carries.
Under it, G3 and G4 are properties of *proposal text*, which owners would have
to read and understand, rather than properties of *what the treasury will
accept*. The compromise adopted: keep the audited voting, counting and timelock
machinery, and refuse the arbitrary-calldata execution path.

**A2. Whitelist of permitted function selectors on the executor.**
*Rejected.* Preserves generality and looks safer than A1. But a whitelist is a
list that drifts — every new feature is a pressure to add a selector, and the
guarantee degrades one entry at a time with no single moment where it visibly
breaks. Exposing one function is narrower than permitting a list of them.

**A3. A single monolithic `BodyCorporate` contract.**
*Rejected.* Cheapest to build, and genuinely attractive against C9 (team new to
Solidity). Rejected because there is then **no permission boundary to audit**:
every guarantee becomes an internal convention, and QAS-8's answer degrades
from *"the attacker reaches nothing"* to *"the attacker reaches whatever the
internal checks missed."*

**A4. Treasury as an owner-controlled multisig.**
*Rejected.* Simple, well understood, no governance contract needed. It
reinstates a small group holding the money — the exact structure
[`product.md` §2.1](../../product.md#21-the-problem) identifies as the problem. Rejecting it is the design
being consistent with its own premise.

**A5. Any in-contract accountability mechanism — a bond, a retention, a claim.**
*All rejected, and this is the view's most consequential set of alternatives.*
Five were designed in full and each was refused for the same reason: every one
made some party's money contingent on another party's attention or good faith.
The full record is [ADR-012](../adr/012-no-built-in-accountability.md). What remains is a contract set that controls
authorisation and emits evidence, and holds nothing back from anyone.

**A6. Roles assigned to the management firm through a role-admin hierarchy.**
*Rejected.* Conventional access-control practice, and it would let the firm
delegate cleanly. But any role-admin the firm holds is a path to granting
itself more — and G1 has to be true against a *compromised* firm key (QAS-8),
not merely an honest one.

---

## 6. Evaluation — including what this view costs

**What it delivers.**

- **P2, strongly.** QAS-5 reverts; QAS-6 has no path; QAS-8 bounds the loss with
  a total key compromise to *zero at any new address*. All three are testable
  and all three tests exist in [`spec.md` §7](../../spec.md#7-the-eight-refusals--each-one-is-a-test).
- **P3, partially.** R4's permissionless triggers are what let QAS-10 pass at
  zero turnout — *demonstrated for levy charges, designed for plan items*.
- **P1, only indirectly** — every state transition emits an event ([`information-view.md`](information-view.md)), but
  record integrity itself is [`deployment-view.md`](deployment-view.md)'s business.

**What it costs, and to which driver.**

- **It hurts P3.** Seven contracts, an affirmative payee vote, and a two-stage
  approve-then-attest flow are all steps that need owner attention the
  literature says will not arrive (Falk et al., 2024). **T1 is paid here, in
  this view, and the passive path only softens it.**
- **It hurts modifiability, deliberately** (T5). R5 guarantees a plan wrong at
  ratification stays wrong for its term.
- **It does nothing at all for QAS-9.** A majority unit holder passes every
  guard in the catalogue above. The permission structure constrains *the firm*;
  it does not constrain *the owners*, and by design it cannot.
- **It costs build time against C8 and C9.** The designed system is seven
  contracts; **six are built** and one — `MaintenancePlan` — is designed only ([`spec.md` §8](../../spec.md#8-requirements), and `method/04-poc-scope.md`). The
  build order falls out of this view: `MembershipRegistry` → `Treasury` +
  `PayeeRegistry` → `Governance` + `Timelock` → `LevyLedger`. Even trimmed, six
  contracts is a lot for a team new to Solidity in six weeks; the mitigation is
  that the loop exercises few functions in each.

**Which invariants hold by construction, and which by convention (Q10).**

| Holds by construction — enforced in code, testable | Holds by convention — outside this view's reach |
| --- | --- |
| Only `Timelock` may call `release`, and role administration is renounced so nothing can change that | The operator deploys the *published* standard set, unmodified — checkable by code hash, but by the reader, not the contract |
| Payee must be in the registry at release | The land-title adapter reports ownership honestly |
| `amount ≤ proposal.cap`; `fund == proposal.fund` | The firm's key is not shared or stolen — QAS-8 exists precisely because this one cannot be relied on |
| No mutator on `MaintenancePlan` — *compile-time, the strongest form* | Owners read what they vote on |

That table is the honest answer to Q10, and the right-hand column is the part a
reviewer will look for.

---

## 7. Perspectives

The three primary drivers walked across this view.

**P1 — Integrity.** This view's contribution is that every element in [`sad.md` §2.1](../../sad.md#21-constraints--fixed-and-not-ours-to-trade)
emits a structured event on every state transition, so the record this design
depends on is a by-product of operating rather than a reporting step. Its
*limit* is that nothing here prevents the operator revising history; that
argument lives in [`deployment-view.md`](deployment-view.md) and rests on validator diversity. **Rule integrity
(QAS-2) is unaddressed by this view and unaddressed anywhere in the project so
far** — the catalogue above says what each contract does, and nothing says what
happens when the operator publishes v2. Carried to [`deployment-view.md`](deployment-view.md) as [ADR-004](../adr/004-versioning-out-of-scope.md).

**P2 — Authority containment.** The view *is* this perspective; this view's own
Rationale and Evaluation parts are its walk. The one-line summary an auditor can check: **the set of addresses
holding `RELEASER_ROLE` on `Treasury` has exactly one member, and that member is
a contract that only acts on an executed proposal.**

**P3 — Participation.** Two opposing contributions, and both must be stated.
*For:* permissionless triggering (R4) means planned work needs no turnout at
all. *Against:* R3's affirmative payee vote is a hard participation requirement
with no passive fallback — admitting a vendor when only a handful of owners vote is
exactly the case that fails. The design accepts that a building which cannot muster a vote
to admit a vendor cannot commission unplanned work, and treats that as correct
rather than as a defect: **unplanned spending by a body that cannot assemble a
quorum is the failure mode this project exists to prevent.**
