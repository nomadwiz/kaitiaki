# ADR-010 — One standard contract set, published once, instantiated per building

**Status.** Accepted, 28 Aug 2026. Reclassified from a constraint to a decision,
28 Aug 2026 — same reason as [ADR-009](009-publicly-readable.md).

## Context

Roughly 14,952 unit title developments exist in New Zealand (MHUD, 2022). Each
needs its own treasury, its own register of owners and its own governance.

Either each building commissions its own contracts, or the operator publishes one
set that every building runs a copy of.

## Decision

One set, published and audited once at national scale, then instantiated per
building with that building's own configuration.

## Consequences

**What we gain.** The code every owner has to trust is a single, heavily examined
artefact rather than thousands of bespoke ones written to varying standards. That
makes an audit affordable — auditing one set properly is achievable; auditing
fifteen thousand is not.

It also changes what a building's owners actually have to judge at setup. They do
not review code. They review *configuration* — the unit register, the fund split,
the limits, the plan — which is a judgement ordinary people can make.

And because every building behaves identically, a management firm's conduct is
comparable across all the buildings it manages. That comparability is what makes
a portable reputation possible at all.

**What we pay.** A defect in the published set is a defect in every building at
once. The blast radius of a single mistake is national.

That consequence points straight at a question this project has ruled out of
scope: what happens when the operator publishes a corrected version ([ADR-004](004-versioning-out-of-scope.md)).
The two decisions are connected, and the limitations section says so rather than
leaving the reader to notice.
