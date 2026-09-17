# View — Deployment and network

**SAD [§3.5](../../sad.md#35-deployment-and-network-view).** Answers **Q6** (what must the operator keep true after
publication), **Q11** (what does a validator run, and what does it cost),
**Q12** (can any single class outvote the rest).

**Primary readers:** R2 network operator, R4 prospective validator.
**Drivers that forced it:** QAS-1, QAS-3 (P1 integrity). **QAS-2 (rule
integrity) belongs here and is deliberately unanswered** — versioning is out of
scope ([ADR-004](../adr/004-versioning-out-of-scope.md)), and the cost of that exclusion is stated in [`sad.md` §7.1](../../sad.md#71-what-the-architecture-does-not-prevent) rather than
left implicit. Also carries **C6**,
the brief's mandate to justify blockchain over a centralised database.

**Status.** The network is *described, not stood up* (`00-brief.md` §3). This
view designs an argument, not a deployment.

---

## 1. Primary presentation

`figures.drawio` — page **Figure 5 — Deployment view**

**View type.** Allocation — what runs where, and under whose control.

**Notation.** UML 2.5.1 deployment diagram — nodes, an execution environment,
artifacts, `«deploy»` and `«instantiate»` dependencies, and communication paths
between nodes.

**Caption.** *Figure 5 — Deployment view: the validator set, and why this is not
a database with extra steps.*

**The convention.** Each validator node carries a stereotype saying what it is
to the record — `«independent»` of the parties being checked, `«subject»` a class
the record is *about*, or `«operator»`. The stereotype carries the meaning on its
own, so the argument survives a greyscale print and a colour-blind reader (C7).
The argument itself: if the `«independent»` nodes are absent, the design fails.

---

## 2. Element catalogue

### 2.1 Validator classes

| Class | Independent of the parties being checked? | Why they would run a node |
| --- | --- | --- |
| Government housing agency | No — operates the register | Statutory interest in the record |
| Insurers | Yes | They price building risk on maintenance history they currently take on trust |
| Banks and mortgage lenders | Yes | They lend against individual units; the body corporate's financial health is their collateral's health |
| Audit firms | Yes | Already engaged on these accounts; the ledger removes reconciliation work they currently do by hand |
| Management firms | **No — this is the class the record is about** | Direct operational interest |
| Large institutional owners | Partly | Own apartment stock at scale |

**Admission test, applied to every class:** an existing interest in this record
being true; the capacity to operate infrastructure; and independence from the
parties being checked.

### 2.2 The rule everything rests on

> **No single class may hold more than one third of consensus weight.**

One third is not a chosen figure. It is the Byzantine fault tolerance bound:
below it, a colluding class cannot finalise a false block. This is why QAS-1 and
QAS-3 have measures at all rather than aspirations.

### 2.3 What is deployed

One standard contract set, published once and audited once nationally, then
instantiated per building — approximately 14,952 developments in New Zealand as
at July 2021 (MHUD, 2022). Code trust is national and one-time; configuration
trust is local.

**Versioning is out of scope** ([ADR-004](../adr/004-versioning-out-of-scope.md)) and the diagram says so in red rather
than leaving a gap for a reviewer to find.

### 2.4 Not validators, deliberately

Universities and researchers. They need no special status: the chain is publicly
readable, so any researcher can run a verifying node and analyse the complete
national record. That such a housing dataset does not exist today is a real
secondary benefit of making the network public.

---

## 3. Context

This view holds the whole blockchain-versus-database argument. The [context](context-view.md), [functional](functional-view.md),
[behavioural](behavioural-view.md) and [information](information-view.md) views
describe a system that would work identically on a well-run government database
— **and that is the point**: everything those views claim is true only because
this one holds. If the rule in [`sad.md` §2.2](../../sad.md#22-drivers) fails, they describe a database with extra
steps.

---

## 4. Rationale

**R1. Permissioned proof of authority, not proof of stake.** ← QAS-1, and the
absence of a native asset. Recorded as **[ADR-007](../adr/007-proof-of-authority.md)**.

**R2. Publicly readable, not access-controlled.** ← P1, Q13. **This is a
decision, not a constraint** — an earlier draft listed it among the givens, which
was wrong: a given cannot also be argued for. Recorded as **[ADR-009](../adr/009-publicly-readable.md)**.
New Zealand apartments are owned by citizens, permanent residents, overseas
investors, companies and trusts alike, so a citizenship gate would exclude
people who compulsorily pay levies. `[ASSUMED]` that the excluded share is large
enough to matter — the composition of unit ownership by owner type is not
sourced, and if overseas and corporate ownership were negligible the argument
would rest on R2's second and third reasons alone, which still hold. Restricting access is access *control*, not
confidentiality — anything millions may read is not secret — so the narrower
claim would also be a less honest one. And narrowing who may verify narrows the
argument: journalists, researchers, auditors and overseas owners are excluded
from the verification that makes P1 real.

**R3. One audited standard set, instantiated per building.** ← P1, and cost.
Also a decision rather than a given, for the same reason. Recorded as
**[ADR-010](../adr/010-one-standard-set.md)**.
Publishing one heavily scrutinised artefact narrows the trusted base to a single
thing, makes genesis a configuration exercise owners can actually judge, and
makes every building's records comparable — which is what lets a firm's payment
history be read across the buildings it manages. **Comparability of records, not
of conduct:** the reputation claim was withdrawn ([ADR-012](../adr/012-no-built-in-accountability.md)), and this rationale
rests only on the records being in the same shape.

**R4. Validator diversity is stated as a requirement on the operator, not as an
assumption.** ← QAS-3.
The design cannot compel institutional participation. What it can do is refuse
to pretend otherwise: the minimum-composition rule is the operator's obligation,
and if the independent classes free-ride on public read access, the set skews to
management firms and P1 fails. That is recorded as an adoption risk, not as a
solved problem.

---

## 5. Alternatives considered

**A1. A government-operated relational database with published reports.**
*Rejected — and it is the alternative the brief specifically requires answering
(C6).* A database can be transparent, but its transparency is **granted**: the
operator decides what to publish, when and in what form, can correct history
without trace, and can be compelled to. An owner disputing a payment must ask
the holder of the record for the record. That is today's arrangement with better
software.

**A2. Proof of stake with a native token.** *Rejected.* Proof of stake exists to
secure networks whose validators are anonymous, substituting economic cost for
identity. Here validators are identified, legally accountable institutions.
Adopting it would mean inventing a tradeable asset for a public housing registry
and then defending why a government service has a speculative token attached.

**A3. Proof of stake denominated in the existing stablecoin.** *Not adopted, and
explicitly retained as the fallback position* — the distinction matters, because
it is the option this design would move to if the identity-based argument were
rejected. It avoids inventing an asset and would satisfy a reviewer who insists
on economic security. Not adopted because validator identity here is known and
legally accountable, which is what proof of stake exists to substitute for.
Recorded in [ADR-007](../adr/007-proof-of-authority.md) as the retained fallback.

**A4. A fully public permissionless chain.** *Rejected* on cost, throughput, and
the absence of any operator accountable for a public register — but it is the
option that would most strongly answer the "is this really a blockchain?"
objection, and the report should concede that rather than dismiss it.

**A5. Estonia's KSI model — integrity timestamping rather than smart contracts.**
*Rejected, and worth stating precisely.* KSI hashes each record, combines the
hashes into a Merkle tree and anchors the root, so anyone can verify a record's
integrity without private keys (European Commission, 2025). What follows is our
reading of that description rather than a claim the source makes: an integrity
timestamping service does not execute contracts, hold value, or reach consensus
over state transitions. So Estonia establishes that a
state can operate tamper-evident ledger infrastructure at national scale — it
does not establish that a state runs contracts holding money. **This project
proposes something materially further, and says so.**

---

## 6. Evaluation

**What it delivers.** The only defensible answer to C6, and the foundation every
other view stands on.

**What it costs, and this is the honest core of the whole document.**

- **The design depends on institutional participation it cannot compel.** R4 is
  an argument about incentives, not a mechanism. A reviewer is entitled to say
  the whole project rests on an assumption about behaviour.
- **The "is it really a blockchain?" objection lands squarely here.** An Estonian
  informant put it bluntly: *"We don't call it a blockchain, we call it a
  hash-chain. Because blockchain in its nature has no central controlled
  environment; but in Estonia there is always a responsible body which stores
  these hashes"* (Semenzin et al., 2022). The answer offered is not that the
  label applies, but that the property owners actually depend on — that no single
  party, including the state, can revise the record unnoticed — is delivered by
  validator diversity plus public verifiability. **If that diversity fails, the
  criticism is correct.**
- **Consensus secures the ledger, not the money.** It protects against forged
  blocks, rewritten history and double-signing. It is no remedy at all for a
  building's funds being misused, which the protocol sees as a valid
  transaction. A firm can validate impeccably and still mismanage a building.
- **None of it is demonstrated.** The prototype runs on a public test network.
  Every claim in this view is designed and argued; not one is tested.

---

## 7. Perspectives

**P1 — Integrity.** This view *is* P1. QAS-1 and QAS-3 both live here, and both
reduce to the one-third rule.

**P2 — Authority containment.** Consensus contains nothing at the application
layer. Stating that explicitly matters, because "it's on a blockchain" is
routinely offered as though it answered a question about misuse of funds. It
does not, and [`functional-view.md`](functional-view.md) is where that question is answered.

**P3 — Participation.** One contribution, and it is worth naming: public read
access means an owner who never votes can still verify. Verification and
governance are separate acts, and the design only depends on turnout for the
second.
