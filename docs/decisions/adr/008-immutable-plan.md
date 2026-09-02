# ADR-008 — The maintenance plan cannot be edited once ratified

<!-- nav -->
> **Document** · [SAD](../sad.md) · [Decisions](index.md)
>
> **Method** · [Index](../index.md) · [Brief](../method/00-brief.md) · [Readers](../method/01-stakeholders.md) · [Outline](../method/02-outline.md) · [Drivers](../method/03-drivers.md) · [Scope](../method/04-poc-scope.md) · [Review](../method/05-cold-review.md)
>
> **Views** · [Context](../view/context-view.md) · [Functional](../view/functional-view.md) · [Behavioural](../view/behavioural-view.md) · [Information](../view/information-view.md) · [Deployment](../view/deployment-view.md)
<!-- /nav -->




**Status.** Accepted, 28 Aug 2026. Designed, not built ([`@work/method/04-poc-scope.md`](../method/04-poc-scope.md)).

## Context

The plan sets out what maintenance the building needs, when, and what it may
cost. Every way of quietly abusing it needs the same thing to exist: a way to
edit it after it is agreed.

Inflate a cost. Pull a date forward. Insert an item. Pad the numbers to justify
higher levies. Delete work to lower them. Push work into the far future to avoid
raising levies this year — the Crown names that last one directly, saying bodies
corporate "may defer maintenance by placing it in the longer-term section of the
LTM Plan in order to avoid immediate levy increases" (MHUD, 2022).

The usual answer is to allow edits but require a high threshold and log them.

## Decision

No edits. Once ratified, the plan is fixed for its term. Renewal is a fresh
ratification at a high threshold — never an amendment.

A plan item says **what, when, and a maximum**. It never names a contractor and
never fixes a price.

## Consequences

**What we gain.** Removing the edit path removes every attack that needed it, all
at once and by construction. That is stronger than any threshold, because a
threshold can be met and an audit log can be ignored.

Because an item carries a maximum rather than a price, **a plan that no longer
matches the market needs no edit**. A quote under the maximum proceeds and the
surplus stays in the fund. A quote over it cannot use the automatic path and goes
to a normal vote with the real market figure attached. And because contractors
are chosen when the work happens, an item written today gets paid to whoever is
trading in twelve years.

**What we pay.** The risk moves to the day the plan is agreed. A plan that is
wrong at ratification stays wrong for its whole term, and there is no correction
mechanism. Sector practice expects a review every three years; this design does
not do that, and the write-up should name it as a divergence rather than skip it.

**Structure.** Detailed costings for the first ten years, which carry automatic
execution; a high-level projection for the following twenty, which does not — so
those items need a normal affirmative vote when they arrive. This mirrors what
New Zealand practice already does, and confines automatic execution to the window
where cost estimates are actually reliable (MHUD, 2022).

**Not demonstrated.** The plan contract is designed, not built. The strongest
evidence available is that the designed interface has no edit function at all,
which is an argument rather than a test.
