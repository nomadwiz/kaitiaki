# ADR-013 — The voting contract is written for this project, not extended from a framework

<!-- nav -->
> **Document** · [SAD](../sad.md) · [Decisions](index.md)
>
> **Method** · [Index](../index.md) · [Brief](../method/00-brief.md) · [Readers](../method/01-stakeholders.md) · [Outline](../method/02-outline.md) · [Drivers](../method/03-drivers.md) · [Scope](../method/04-poc-scope.md) · [Review](../method/05-cold-review.md)
>
> **Views** · [Context](../view/context-view.md) · [Functional](../view/functional-view.md) · [Behavioural](../view/behavioural-view.md) · [Information](../view/information-view.md) · [Deployment](../view/deployment-view.md)
<!-- /nav -->




**Status.** Accepted, 1 Sep 2026. Refines [ADR-001](001-narrow-release-interface.md); supersedes nothing.

## Context

[ADR-001](001-narrow-release-interface.md) decided what the treasury will accept: one function, four checks, and
one address allowed to call it. It did not decide where the voting machinery in
front of that function comes from, and there are two credible answers.

The obvious one is to inherit OpenZeppelin's Governor, the standard audited
framework for on-chain voting (OpenZeppelin, n.d.), and constrain it so that the
only thing a passed proposal can execute is the treasury's release call. The
other is to write a small voting contract for this project and take only the
timelock off the shelf.

The team is three people new to Solidity, with seven weeks and eighty of one
hundred marks resting on written work ([`@doc/product.md` §16.1](../../doc/product.md#16.1%20Timeline)).

## Decision

Write `Governance` for this project. Take `TimelockController` from OpenZeppelin
unchanged, and use OpenZeppelin's `AccessControl` and `ERC20` as well.

`Governance` holds only what the loop needs: raise a proposal of one of two
kinds, cast a vote, count votes against the quorum and threshold in
[`@work/sad.md` §2.5](../sad.md#2.5%20Configured%20parameters%2C%20and%20where%20each%20value%20comes%20from), queue through the timelock, execute, and attest. It stores
the parameters of a payment — fund, payee, amount — rather than an instruction
to be executed.

## Consequences

**What we gain.** The claim in [ADR-001](001-narrow-release-interface.md) becomes something the code shows rather
than something the configuration promises: there is no general execution path to
constrain, because none was ever written. Extending the framework would mean
disabling the feature it exists to provide, and then explaining in the report
what was disabled and why the disabling holds — an argument about someone else's
code, made by a team who did not write it. A small contract the team wrote is a
contract the team can explain, which matters when the explanation is worth more
marks than the code.

**What we pay, and it is the same cost [ADR-001](001-narrow-release-interface.md) already accepted, made larger.**
Vote counting, window arithmetic and quorum are now unaudited code written by
people learning the language. A defect there is a defect in the guarantee that
owners decide, and no audit stands behind it. The mitigation is scope: the
contract stays as small as the loop allows, and the quorum-and-threshold
arithmetic gets its own tests rather than being exercised only through scenarios.

**What we keep.** The timelock is the one piece where an off-the-shelf component
carries no argumentative cost — it enforces a delay and holds a role, it is the
single hardest thing to get right by hand, and using it unchanged means the
report can say the waiting period rests on audited code.

**Where this shows up in the report.** Section 3 lists it among the technologies;
Section 5 discusses it as a limitation, because "we wrote our own voting logic"
is a weakness a critical evaluation should name rather than let the marker find.
