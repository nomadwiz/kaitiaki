# ADR-002 — The firm's withheld fees are kept in their own contract

<!-- nav -->
> **Document** · [SAD](../sad.md) · [Decisions](index.md)
>
> **Method** · [Index](../index.md) · [Brief](../method/00-brief.md) · [Readers](../method/01-stakeholders.md) · [Outline](../method/02-outline.md) · [Drivers](../method/03-drivers.md) · [Scope](../method/04-poc-scope.md) · [Review](../method/05-cold-review.md)
>
> **Views** · [Context](../view/context-view.md) · [Functional](../view/functional-view.md) · [Behavioural](../view/behavioural-view.md) · [Information](../view/information-view.md) · [Deployment](../view/deployment-view.md)
<!-- /nav -->




**Status.** **Superseded by [ADR-012](012-no-built-in-accountability.md), 29 Aug 2026.** Kept rather than deleted:
the reasoning below is sound on its own terms, and what overturned it was not a
flaw in the argument but a change to the thing it was arguing about — fee
retention was removed from the design entirely.

*Originally accepted 28 Aug 2026.*

## Context

The way this design holds the management firm accountable is to withhold part of
the firm's own fee for a while, release it gradually, and let owners vote to
claim some of it back if a specific payment turns out to have been wrong
([`@doc/product.md` §11.3](../../doc/product.md#11.3%20Accountability%20without%20a%20deposit)).

The important detail: that withheld money is **the firm's earnings**, not the
owners' levies. Two different pots, two different owners.

The treasury already holds the owners' money in two separate funds and is the
only place money leaves from ([ADR-001](001-narrow-release-interface.md)). The cheap option is to add the withheld
fees as a third pot in the same place.

## Decision

Keep them apart. The withheld fees live in their own contract.

When the treasury pays the firm its fee, it hands a share straight to that
contract. The contract releases matured amounts on its own schedule, and it only
gives money back to the owners if a claim vote passes naming a specific payment.

## Consequences

**What we gain.** If the claim logic has a bug — and it is the least
settled mechanism in the whole design — the damage stops at the firm's own money.
It cannot reach the owners' levies. The fact that these are two different
people's money is visible in how the system is built, rather than just asserted
in the write-up.

**What we pay.** One more contract to write, deploy and connect, against a
six-week deadline. And two contracts now have to agree on what counts as a fee
payment.

**Alternative rejected.** Putting it in the treasury as a third pot — one fewer
contract to build. Rejected purely on the grounds that a bug would then reach the
owners' money.
