# ADR-005 — Arrears are published per unit, not just as a building total

**Status.** Accepted, 28 Aug 2026.

## Context

When an owner falls behind on their levy, the other owners in the building carry
the shortfall. There are two ways the system could report that.

- **Per unit.** Anyone can see which unit is behind.
- **Aggregate only.** Anyone can see the building is short by a total amount, but
  not who.

Ownership of units in New Zealand is already a matter of public record. So
publishing per unit effectively names a person as being behind on payments — on
a ledger that keeps it forever and cannot delete anything.

## Decision

Publish per unit.

The interface softens the presentation: it shows a status rather than amounts and
payment history, and it stops displaying an arrear once it is resolved.

## Consequences

**What we gain.** In a forty-owner building, the enforcement that actually works
is the neighbours knowing. That is the mechanism, and aggregate reporting removes
it. There is also a consistency argument: an owner in arrears has their vote
suspended, and a suspended vote is visible on the chain — so the default is
disclosed anyway, and aggregate-only reporting would give the appearance of
privacy without the substance.

**What we pay, and it is not small.** A named person is permanently marked as
having been behind on payments. Someone having the worst year of their life gets
it recorded on a public ledger that cannot forget. And if an arrear is recorded
*wrongly*, the chain can only have a correction appended to it — the original
entry stays visible forever. The information view labels this in red and does not
soften it.

**The interface mitigation is presentation, not protection.** Anyone running
their own node sees the amounts, the history and the resolved arrears regardless
of what our interface chooses to display. Calling it a privacy control would be
dishonest, so we do not.

**The alternative stays on the record.** Aggregate-only publication is a credible
choice and a reviewer may prefer it. It was rejected for the reasons above, not
because it is unreasonable.
