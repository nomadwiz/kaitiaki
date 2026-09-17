# View — Context

**SAD [§3.1](../../sad.md#31-context-view).** Answers **Q13** (what does this record give an outside institution
that self-reported building condition does not) and **Q17** (what authority does
the firm keep, and what did it lose).

**Primary readers:** R4 prospective validator, R6 management firm.
**Drivers that forced it:** S2 interoperability — two external dependencies the
system needs but does not control; and the authority question underlying QAS-5
and QAS-6, seen at actor level rather than contract level.

*Not QAS-9.* An earlier draft claimed this view addressed the majority-owner
scenario. It does not, and [`functional-view.md`](functional-view.md) and [`behavioural-view.md`](behavioural-view.md) both say so plainly. The mapping was
removed rather than defended.

---

## 1. Primary presentation

`figures.drawio` — page **Figure 1 — Use case view** — **Figure 1**, and the first figure in the
report.

**View type.** Use case: the actors, the system boundary, and the use cases each
actor takes part in.

**Notation.** UML 2.5.1 use case diagram — actors, a subject boundary, use cases,
`«include»` dependencies and actor generalisation. Primary actors are drawn on
the left and supporting actors on the right, so an actor that never initiates is
visible as such without a special symbol.

**Caption.** *Figure 1 — Use case view: the actors, the use cases they take
part in, and the two external systems the design depends on.*

**Where the absences went.** An earlier version of this figure marked, with a ⛔,
each authority a party does *not* have. UML has no notation for a use case an
actor may not perform, so the absences are no longer drawn; they are stated in
the element catalogue's **Explicitly may not** column below, and the mapping is
one-to-one and complete:

| Absence, as it was drawn | Where it is now stated |
| --- | --- |
| The firm cannot move money | No association from Management firm to *Release payment*; catalogue row, and R1 |
| The firm cannot approve anything | *Cast a vote* is associated with Unit owner only |
| The firm cannot admit a vendor | UC2 is the Unit owner's use case; the firm participates only through *Propose* |
| The vendor cannot initiate anything | Vendor is drawn as a supporting actor on the right of UC7 |
| Owners cannot stop a payment once work is approved | UC4 is withdrawn and appears in no ellipse ([ADR-011](../adr/011-payment-on-attestation.md)) |
| Owners cannot recover money through the system | UC11 is named in the catalogue as a goal this system does not serve |
| Institutions do not participate in a building's decisions | Insurer, lender or auditor is associated with UC9 and nothing else |
| There is no committee | No actor and no use case corresponds to one ([ADR-006](../adr/006-no-committee.md)) |

Counting associations still verifies the claim: the owners' actor touches four
use cases and every decision runs through one of them.

---

## 2. Element catalogue

| Party | May start | Explicitly may not |
| --- | --- | --- |
| Unit owner | Pay a levy, cast a vote, read everything | Move money; act alone; **stop a payment once the work is approved** |
| Management firm | Propose work, recommend a vendor, attest completion — **which releases payment** | **Move money directly. Approve anything. Admit a vendor.** |
| Vendor | Nothing | Initiate any transaction; receive payment without a vote |
| Public caller | Trigger a due action; read and verify the whole record | Decide anything — every permissionless call is already fully determined |
| Insurers, lenders, auditors | Read; run a validating node | Participate in a building's decisions |

| Dependency | Nature | Status |
| --- | --- | --- |
| Land title register | External authority for who owns which unit | **Designed, not built** — bindings are fixed at deployment in the prototype |
| NZD-pegged stablecoin | External settlement asset; this project issues nothing | Mocked on the test network |
| National housing chain | Government-operated, permissioned, publicly readable | **Described, not stood up** (`00-brief.md` §3) |

### 2.1 Use cases

Actor, goal, and the flow that satisfies it. Every one is exercised by the built
loop unless marked.

| UC | Actor | Goal | Flow |
| --- | --- | --- | --- |
| UC1 | Unit owner | Pay what I owe without an invoice arriving | Charges become issuable on their due date; owner calls `payLevy`; the treasury records receipt against the unit and splits it across the two funds |
| UC2 | Unit owner | Decide who is allowed to be paid from our money | Firm proposes a vendor; owner votes; on passing and after the waiting period the vendor joins the approved list |
| UC3 | Unit owner | Decide whether a piece of work happens, and at what limit | Firm proposes work naming a limit, a fund and an approved vendor; owner votes; the waiting period runs |
| ~~UC4~~ | ~~Unit owner~~ | ~~Stop a payment for work I can see was not done~~ | **Withdrawn.** There is no owner step after the work vote; attestation releases payment ([ADR-011](../adr/011-payment-on-attestation.md)). The identifier is kept struck rather than reused |
| UC5 | Unit owner | Check the fund's whole history without asking the firm | Owner runs an independent node, replays the event log, derives every balance and transition |
| UC6 | Management firm | Get the building's necessary work approved and done | Firm raises proposals and attests completion; it concludes nothing and moves no money |
| UC7 | Vendor | Be paid for approved work | Vendor is admitted by vote, performs the work, and is paid directly by the treasury within the approved limit |
| UC8 | Public caller | Make a due action happen when nobody else has | Any caller triggers a due charge, queues a passed proposal, or executes one whose conditions are met |
| UC9 | Insurer or lender | Assess a building on evidence rather than self-report | Read the public chain: maintenance spending, arrears, and the firm's **payment history** across every building it manages. *Not its conduct — the record shows what was paid, not whether anyone was satisfied ([`sad.md` §7.1](../../sad.md#71-what-the-architecture-does-not-prevent))* |
| UC10 *(designed)* | Unit owner | Have agreed maintenance happen without having to organise it | A ratified plan item becomes triggerable on its due date and proceeds unless owners record a veto — **the design's one surviving on-chain veto, and an exception explained in [`sad.md` §7.1](../../sad.md#71-what-the-architecture-does-not-prevent)** |
| UC11 | Unit owner | Get money back when a payment went to work that was not done | **Not a use case this system serves.** Recovery runs through audit and adjudication outside the chain; the system's contribution is the evidence they work from |

---

**There is no committee.** In the arrangement this project replaces, an elected
committee sits between the owners and the money. Here it does not exist. That
absence is the single largest change from the status quo, and it is recorded as
**[ADR-006](../adr/006-no-committee.md)** rather than left as prose.

---

## 3. Context

This view bounds everything else. [`functional-view.md`](functional-view.md) opens the middle box; [`deployment-view.md`](deployment-view.md) describes the
chain the box sits on. Anything not touching a line in this diagram is outside
the system's responsibility — including, deliberately: enforcement against
non-payers beyond disclosure, dispute arbitration, vendor tendering, and legal
conformance with the Unit Titles Act 2010.

---

## 4. Rationale

**R1. The firm keeps administration and loses every *decision*.** ← Q17, the
project's premise. The firm still does the work that makes a building run — it
knows the roof needs doing and which contractor can do it. What it loses is the
ability to decide *what happens and who is paid*: it cannot approve work, admit a
vendor, or direct money anywhere the owners have not already authorised.

**What it does retain, and the report must not blur this.** The firm's
attestation releases payment ([ADR-011](../adr/011-payment-on-attestation.md)). So while the firm cannot choose the
destination or the amount, it does choose *when* an approved payment completes,
and its word is the only condition on completion. That is a real authority and
[`sad.md` §7.1](../../sad.md#71-what-the-architecture-does-not-prevent) records it as the design's central limitation.

**R2. Vendors cannot initiate.** ← QAS-6.
A vendor with no ability to start anything cannot lobby the contract, only the
people. That keeps every path to payment running through a vote.

**R3. Institutions read but do not participate.** ← Q13, QAS-3.
Insurers, lenders and auditors get something they do not have today: a
maintenance and spending history they currently take on trust from the party
being assessed. That is the reason they would run a node, and [`deployment-view.md`](deployment-view.md) argues it.
They get no role inside a building, because a validator with governance power
over the record it validates is the problem this design exists to avoid.

**R4. Two external dependencies, both narrow.** ← S2.
The register is read-only into the system through one adapter role; the
stablecoin is a transfer primitive. Neither is a general integration surface.
Keeping them narrow is what makes "designed, not built" an honest status rather
than a hole — the prototype substitutes a fixed table and a mock token, and
nothing else changes.

---

## 5. Alternatives considered

**A1. Keep an elected committee, with the chain as its accounting system.**
*Rejected — and this is the most defensible alternative in the whole project.*
It is a far smaller change, it fits existing law without amendment, and it would
still deliver a tamper-evident record. Rejected because it leaves the structure
intact: a small group still decides, and the owners still cannot check them
except after the fact. The project would then be better bookkeeping, not a
different arrangement of power. Recorded as [ADR-006](../adr/006-no-committee.md).

**A2. Let owners raise proposals as well as the firm.** *Deferred rather than
rejected.* It removes the firm's monopoly on the agenda, which is a real
concentration ([`product.md` §11.2](../../product.md#112-owners-vote-there-is-no-committee)). Out of the built scope because it adds
a proposal path without exercising any new part of the payment loop
(`04-poc-scope.md`), but it is the cheapest strengthening available and belongs
in future work.

**Why it is the cheapest, stated concretely.** Nothing downstream of a proposal
changes: proposals, voting, quorum, the timelock and execution are all built
already. The change is to the guard on `Governance.propose` — from the firm key
alone to any wallet `MembershipRegistry.isOwner` recognises, which is the check
`castVote` already makes ([`functional-view.md`](functional-view.md)'s element catalogue). That is also exactly why it
was declined: a path that starts the loop without exercising any new part of it
buys the demonstration nothing.

**Declined for contingency, not for time.** [`product.md` §16.1](../../product.md#161-timeline) holds the final
week for problems rather than scope, and this was the candidate given up to
protect it. Holding a week back and running out of time produce the same
artefact and mean opposite things, so the report says which one happened
(`04-poc-scope.md`).

**A3. Admit vendors nationally rather than per building.** *Rejected.* A
national approved-vendor list would remove a vote from every building and make
the participation problem materially easier. Rejected because it moves the
decision to whoever curates the national list — recreating, at national scale,
exactly the delegation the design removes at building scale.

---

## 6. Evaluation

**What it delivers.** The clearest statement of the design's central claim: the
party doing the administering has no decision authority at all. Counting the
associations on each actor is enough to see it, which matters for R5 and R6, who
will not read the functional view.

**What it costs.**

- **Everything except voting belongs to the paid party.** The firm proposes,
  recommends, attests and is paid from the fund. Removing the committee removed
  a check as well as a bottleneck, and phases 2 and 4 of the loop exist to
  counterbalance a concentration the design itself created.
- **A2 is a known weakness left open.** Only the firm sets the agenda. A firm
  that simply never proposes necessary work cannot be compelled to by anything
  in the built system — the passive plan path would have answered this, and it
  is designed only.
- **Two dependencies are stubbed.** The report must not describe register
  integration as though it works.

---

## 7. Perspectives

**P1 — Integrity.** Public read access to institutions is not a courtesy: it is
what makes independent verification real, and it is the same property QAS-4
tests from the owner's side.

**P2 — Authority containment.** The **Explicitly may not** column of the element
catalogue is the perspective, in the shortest form it takes anywhere in the
document. It used to be drawn on the figure; it is now written, because UML has
no notation for an authority an actor lacks — see *Where the absences went*.

**P3 — Participation.** The context view is where the participation burden
becomes visible as a *structural* fact rather than a UI problem: with no
committee, every decision that used to be delegated now needs owners. That is
the design's intent and its greatest risk, in the same sentence.
