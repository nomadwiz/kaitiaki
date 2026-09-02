# Why the design is the way it is

**These are settled decisions, not open questions.** Each record names the
alternative that was rejected and the reason. Read the relevant one before
proposing a different approach — most of the obvious alternatives were
considered and refused for a stated reason, and re-litigating them costs the
group time it does not have.

If you think a decision is wrong, **raise an issue**. Do not reopen it in code,
and do not implement the rejected alternative because it looks tidier.

## What is here

| | |
| --- | --- |
| `adr/` | Thirteen decision records. Context, Decision, Consequences, and the alternative that was rejected. Start with `adr/index.md` |
| `views/` | The five architecture views: context, functional, behavioural, information, deployment. Each carries its own rationale and rejected alternatives |
| `product.md` | The problem, the evidence, the build plan and the timeline |

## The three most likely to be argued with

- **[`adr/001-narrow-release-interface.md`](adr/001-narrow-release-interface.md)** — why the treasury exposes one
  function instead of the standard general execution path. An assistant that has
  seen a lot of governance code will reach for the standard pattern; this
  explains why it cannot be used here.
- **[`adr/013-own-voting-contract.md`](adr/013-own-voting-contract.md)** — why `Governance` is written for this project
  rather than extended from OpenZeppelin's Governor.
- **[`adr/012-no-built-in-accountability.md`](adr/012-no-built-in-accountability.md)** — why nothing is withheld, frozen or
  reversed. Five accountability mechanisms were designed and rejected, each
  because it made one party's money depend on another party's diligence.

## Status of these copies

**Read-only.** They are a snapshot taken from the project's architecture
description, which lives outside this repository and remains the source of truth.
Editing a file here changes nothing upstream and creates a disagreement nobody
will notice.

Two consequences of being a snapshot. The `../spec.md` build specification is the
authority for anything you are implementing — where it and a record here differ,
the specification is current. And the navigation links at the top of each record,
and its cross-references to `sad.md`, point at files that were not copied, so
they will not resolve; the prose around them still reads fine.

`product.md` is the one to treat with most caution: it holds the timeline and the
build plan, which change as the project moves.
