# View — Information

<!-- nav -->
> **Document** · [SAD](../sad.md) · [Decisions](../decision/index.md)
>
> **Method** · [Index](../index.md) · [Brief](../method/00-brief.md) · [Readers](../method/01-stakeholders.md) · [Outline](../method/02-outline.md) · [Drivers](../method/03-drivers.md) · [Scope](../method/04-poc-scope.md) · [Review](../method/05-cold-review.md)
>
> **Views** · [Context](context-view.md) · [Functional](functional-view.md) · [Behavioural](behavioural-view.md) · **Information** · [Deployment](deployment-view.md)
<!-- /nav -->





**SAD [§3.4](../sad.md#3.4%20Information%20view).** Answers **Q3** (what must events carry), **Q14** (what can an owner
check unaided), **Q16** (is arrears status public, and forever), **Q19** (what
personal data lands on an immutable ledger).

**Primary readers:** R1 build team, R5 unit owner, R7 Privacy Commissioner.
**Drivers that forced it:** QAS-4 (P1 integrity — verifiability); S1
(confidentiality).

---

## 1. Primary presentation

`@work/diagram/figures.drawio` — page **[Figure 4](../diagram/figures.drawio) — Class view**

**View type.** Information — three zones: what the public chain holds, what
stays off it behind a hash, and what the interface chooses to show.

**Notation.** UML 2.5.1 class diagram — classes with typed attributes,
associations with multiplicities, enumerations, and one package per zone.
`«commit»` dependencies carry the hash from an on-chain class to the off-chain
document it commits.

**Caption.** *[Figure 4](../diagram/figures.drawio) — Class view: what goes on the public chain, what is
only committed by hash, and who that exposes.*

**The convention.** A class stereotyped `«PII»` holds or exposes information
about an identifiable person, permanently. The stereotype carries the meaning on
its own, so the diagram survives a greyscale print and a colour-blind reader
(C7). There are three such classes — `Unit`, `LevyCharge` and `Vote` — and
counting them is the fastest honest summary of this design's privacy cost.

---

## 2. Element catalogue

### 2.1 On the chain — permanent, world-readable

| Entity | Fields | Exposes a person? |
| --- | --- | --- |
| `Unit` | unit id, entitlement share, owner wallet | Indirectly — ownership is already public record |
| `LevyCharge` | unit, amount, due date, paid/unpaid | **Yes** — names a unit as being behind |
| `Proposal` | kind, description, limit, fund, payee, quote hash | No |
| `Vote` | proposal, wallet, for/against | **Yes** — how a named owner voted, permanently |
| `Attestation` | proposal, attester, evidence hash | Firm, not an owner |
| `Payment` | proposal, payee, amount, fund, block time | No |
| `PayeeRecord` | address, company identifier, admitting proposal | Vendor, as a business |
| Fund balances | operating, long-term maintenance | No |

### 2.2 Off the chain — a hash only

Vendor quotes and specifications; completion evidence such as photographs and
reports; the management contract document; correspondence.

**What a hash actually buys, stated precisely.** It proves the document has not
changed since it was committed. It does **not** prove the document is true, and
it does not preserve the document — if the holder loses or destroys it, the hash
becomes an unopenable receipt. That distinction matters to R3 and is routinely
glossed in blockchain write-ups.

### 2.3 The events

`ChargeIssued`, `LevyPaid`, `ProposalCreated`, `VoteCast`, `ProposalQueued`,
`PayeeAdmitted`, `WorkAttested`, `PaymentReleased`. **Eight, not nine** —
`ObjectionRaised` went with the objection window ([ADR-011](../decision/011-payment-on-attestation.md)).

**The requirement they must satisfy (Q3).** The fund balance and every state
transition must be derivable from the event log alone — no contract storage
reads, no off-chain data. That is not a stylistic preference. It is the whole
claim that the record is verifiable without trusting the party holding the
money, and QAS-4 is the test: replay the events on an independent node, derive
the balance, assert it equals the on-chain balance.

**A design consequence people miss.** It means an event must carry enough to
reconstruct, not merely enough to notify. `PaymentReleased` carrying only a
proposal id would force a reader back into contract storage to learn the amount
— and the claim would quietly become false.

---

## 3. Context

This view says *what* is recorded. [§3.2](../sad.md#3.2%20Functional%20view%20%E2%80%94%20the%20permission%20structure) says which contract records it, [§3.3](../sad.md#3.3%20Behavioural%20view%20%E2%80%94%20the%20loop%2C%20and%20where%20it%20refuses)
says in what order. The three together are the description of the system; alone,
each is misleading.

Out of this view's scope: whether the chain itself can be revised — that is
[§3.5](../sad.md#3.5%20Deployment%20and%20network%20view) — and whether anyone reads what is published, which no architecture can
settle.

---

## 4. Rationale

**R1. Events are the audit trail, not a notification channel.** ← QAS-4 (P1).
The continuous record this project's whole argument rests on is the event log.
Treating event design as an afterthought would leave the central claim resting
on contract storage, which only a node operator can query conveniently.

**R2. Evidence stays off-chain, committed by hash.** ← S1, and cost.
Photographs of a repaired roof on a national public ledger would be permanent,
world-readable and expensive, and would add nothing a hash does not — the
dispute is about whether the roof was fixed, not about whether the photograph
changed.

**R3. Arrears status is on the chain and is public.** ← S1, [`@doc/product.md` §11.5](../../doc/product.md#11.5%20Arrears%20are%20public). Recorded as **[ADR-005](../decision/005-arrears-published-per-unit.md)**, because a competent engineer would reasonably
have chosen aggregate-only publication.

**R4. The interface shows status, not amounts or history, and stops surfacing a
resolved arrear.** ← S1.
This is mitigation at the presentation layer, and the view labels it as exactly
that: **presentation, not protection.** Anyone reading the chain directly sees
everything. Describing it as a privacy control would be dishonest, and the
diagram says so with the `«PII»` stereotype on the classes concerned.

**R5. Votes are attributable, not secret.** ← P1, against S1.
Ballot privacy would need a scheme such as MACI or Semaphore, which is out of
scope ([`@doc/product.md` §15.3](../../doc/product.md#15.3%20Future%20work)). The consequence — that how a named owner voted
on their neighbour's proposal is permanently public in a forty-person building —
is a real social cost and is not currently stated anywhere in the project. It
should be.

---

## 5. Alternatives considered

**A1. Aggregate-only arrears — publish the building's total, not per unit.**
*Genuinely viable and still recorded as such.* It preserves privacy and keeps the
fund's health visible. Rejected because it removes the social pressure that is
the only enforcement a small building actually has, and because suspending a
defaulter's vote discloses the default anyway — so the privacy gain is smaller
than it looks. Full record in [ADR-005](../decision/005-arrears-published-per-unit.md).

**A2. Store evidence documents on-chain.** *Rejected.* Removes the dependency on
a party keeping the file. Rejected on permanence, cost, and because it puts
photographs of private property on a world-readable ledger forever.

**A3. Encrypt personal fields on-chain, decryptable by owners.** *Rejected.*
Looks like the best of both. Rejected because encryption on a permanent public
ledger is a bet on the key management and the cipher outliving the record, and
the record is forever. It also breaks QAS-4: a reader who cannot decrypt cannot
verify, and verification by anyone is the point.

**A4. Anonymous ballots via a zero-knowledge scheme.** *Rejected for now, kept
as future work.* It would resolve R5's cost directly and is the single most
valuable extension identified. Out of scope against C8 and C9 — the team is new
to Solidity and has six weeks.

---

## 6. Evaluation

**What it delivers.** P1's verifiability claim becomes testable rather than
asserted (QAS-4). The on-chain/off-chain split keeps the ledger small and keeps
private documents private while still tying them to the record.

**What it costs.**

- **It concedes S1 substantially.** Three `«PII»` classes: `LevyCharge`, `Vote`
  and the `Unit` binding that makes the other two attributable. A temporary
  hardship becomes a permanent public fact, and a *wrongly* recorded arrear can
  only be appended over, never erased (Q20).
- **R4 is not a control.** The interface mitigation is reversible by anyone with
  a node, and the view says so rather than claiming a protection it does not
  have.
- **R5's social cost is unstated in the current proposal.** Public per-vote
  attribution in a forty-owner building is a chilling effect on dissent —
  which is uncomfortable, because those votes are the only owner-held control
  left in the design ([ADR-011](../decision/011-payment-on-attestation.md)).
- **It costs build effort in an unobvious place.** Getting events
  reconstruction-complete is more work than emitting notifications, and it is
  the thing most likely to be discovered late — after the interface is written
  against storage reads because they were easier.

**Built versus designed.** All eight events and every entity except
`PayeeRecord`'s company identifier are in the built loop. Arrears *enforcement*
is not built; arrears *disclosure* is.

---

## 7. Perspectives

**P1 — Integrity.** This view is where P1 becomes checkable by an ordinary
owner. QAS-4 is its test, and the design rule that makes it pass is R1's
reconstruction requirement.

**P2 — Authority containment.** Little to say, honestly: no information here
grants authority. The one relevant point is that `PayeeRecord` binds a payment
address to a company identifier, which is what lets a firm's **payment history**
be read across buildings — a record of what was paid, not of how well it went — and what makes shedding a bad record harder, though not
impossible ([`@doc/product.md` §11.3](../../doc/product.md#11.3%20Accountability%20without%20a%20deposit)).

**P3 — Participation.** Two contributions and both are negative, which is worth
saying out loud rather than reaching for a positive. Permanent public vote
attribution (R5) discourages dissent in a small building where everyone knows
everyone. And permanent public arrears may deter an owner in temporary
difficulty from participating at all. **The information design is the part of
this system most likely to suppress the participation the design depends on.**
