# ADR-006 — There is no elected committee

<!-- nav -->
> **Document** · [SAD](../sad.md) · [Decisions](index.md)
>
> **Method** · [Index](../index.md) · [Brief](../method/00-brief.md) · [Readers](../method/01-stakeholders.md) · [Outline](../method/02-outline.md) · [Drivers](../method/03-drivers.md) · [Scope](../method/04-poc-scope.md) · [Review](../method/05-cold-review.md)
>
> **Views** · [Context](../view/context-view.md) · [Functional](../view/functional-view.md) · [Behavioural](../view/behavioural-view.md) · [Information](../view/information-view.md) · [Deployment](../view/deployment-view.md)
<!-- /nav -->




**Status.** Accepted, 28 Aug 2026.

## Context

Today, a body corporate elects a committee. The committee decides how the pooled
levy money is spent. The owners who funded it do not.

That arrangement is the problem this project is about: a small group deciding on
behalf of contributors who cannot effectively check them. The Crown's own
analysis names it — information asymmetry, optimism bias, and committee members
not treating conflicts of interest as a problem when deciding on the body
corporate's behalf (MHUD, 2022).

The obvious design would keep the committee and give it better books.

## Decision

No committee. The management firm proposes work and administers it; the owners
vote on everything; nothing sits in between.

## Consequences

**What we gain.** The structure that produced the problem is gone, not
instrumented. It also removes a whole layer of roles, elections and terms of
office from a six-week prototype.

**What we pay, and it is the sharpest trade in the design.** The firm now
proposes work, recommends the vendor, attests that the work is done, *and* is
paid out of the same fund. Every role except voting belongs to the party being
paid. Removing the committee removed a check as well as a bottleneck.

Two mechanisms exist specifically to counterbalance a concentration this
decision created: owners must approve a vendor in a separate vote before any
payment can name them, and owners get an objection window after the firm attests.
Neither is a substitute for an independent party, and the write-up should say so
rather than presenting them as equivalent.

**The alternative deserves recording properly.** Keeping the committee and using
the chain as its accounting system is a much smaller change, fits existing law
without amendment, and still gives a record nobody can quietly revise. It was
rejected because it leaves the power structure exactly as it is — the result
would be better bookkeeping rather than a different arrangement. A reviewer could
reasonably disagree with that call, which is precisely why it is written down.
