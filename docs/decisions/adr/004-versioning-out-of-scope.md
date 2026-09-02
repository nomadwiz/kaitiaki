# ADR-004 — New versions of the contracts are out of scope

<!-- nav -->
> **Document** · [SAD](../sad.md) · [Decisions](index.md)
>
> **Method** · [Index](../index.md) · [Brief](../method/00-brief.md) · [Readers](../method/01-stakeholders.md) · [Outline](../method/02-outline.md) · [Drivers](../method/03-drivers.md) · [Scope](../method/04-poc-scope.md) · [Review](../method/05-cold-review.md)
>
> **Views** · [Context](../view/context-view.md) · [Functional](../view/functional-view.md) · [Behavioural](../view/behavioural-view.md) · [Information](../view/information-view.md) · [Deployment](../view/deployment-view.md)
<!-- /nav -->




**Status.** Accepted, 28 Aug 2026. Recorded as a scope decision, not a design.

## Context

Scenario QAS-2 asked: the government operator publishes an updated version of
the standard contracts. What happens to a building already running the old one?

The question matters because of what [`@doc/product.md` §5.1](../../doc/product.md#5.1%20The%20condition%20the%20argument%20rests%20on) claims — that no
operator, including the state, can change the record or the rules underneath a
building. If a new version could be pushed to a running building without its
owners agreeing, that claim would be false.

Three answers were available: owners must vote to move; no changes ever once a
building is running; or the operator may push security fixes only.

## Decision

**None of them. Versioning is out of scope for this project.**

It is recorded here rather than left unmentioned, because a reviewer who spots
the gap and finds nothing written will assume it was never seen.

## Consequences

**What we gain.** The scope stays where `00-brief.md` §3 put it: one building
instance, one loop, six weeks. Versioning is a lifecycle problem for national
infrastructure, and answering it properly would mean designing an upgrade
mechanism, a migration path and an exit route — none of which the prototype
would build and all of which would need pages the report does not have.

**What we pay, and it should be stated in the limitations section.** The claim in
§5.1 is therefore complete only for a building's *running* life, not across
versions. The architecture describes a system that cannot be changed underneath
its owners while it runs; it does not describe what happens when the published
standard moves on.

**Where it goes if the project continues.** Alongside the other items in
[`@doc/product.md` §15.3](../../doc/product.md#15.3%20Future%20work) future work, as the first thing a real deployment would
have to answer.
