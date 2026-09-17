# ADR-009 — The ledger is readable by anyone, not gated to citizens

**Status.** Accepted, 28 Aug 2026. Reclassified from a constraint to a decision,
28 Aug 2026 — an earlier draft listed public readability among the fixed givens
while also arguing for it, and a thing cannot be both.

## Context

An earlier version of this design restricted access to New Zealand citizens.
The system holds a building's finances: who owes what, who voted how, what was
paid to whom.

## Decision

Anyone may read the chain and run a verifying node. No citizenship gate, no
account, no permission.

## Consequences

**What we gain.** Three things, and the third is the one that matters most.

Apartments here are owned by citizens, permanent residents, overseas investors,
companies and trusts alike — a citizenship gate would shut out people who are
compulsorily paying levies into the very fund being reported on.

Restricting access is *access control*, not confidentiality. Anything millions of
people can read is not secret, so the narrower design would have claimed a
privacy protection it does not actually deliver.

And narrowing who may verify narrows the central argument. Journalists,
researchers, auditors and overseas owners are exactly the people whose ability to
check the record makes "verifiable without trusting the operator" mean something.
Restrict them and the claim shrinks to "verifiable by people we let in".

**What we pay.** Everything in the information view becomes world-readable
permanently, including arrears ([ADR-005](005-arrears-published-per-unit.md)) and how each owner voted. Unit ownership
is already public record here, so the marginal disclosure is smaller than it
first appears — but it is not nothing, and it is not reversible.

**A secondary benefit worth naming.** A complete national dataset on how
multi-owned buildings are actually funded and maintained does not exist today.
Making the network public creates one.
