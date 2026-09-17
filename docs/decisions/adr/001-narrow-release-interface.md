# ADR-001 — The treasury has only one way to pay money out

**Status.** Accepted, 28 Aug 2026. Supersedes nothing.

## Context

The usual way to build on-chain governance is: owners vote on a proposal, and if
it passes, the system carries out whatever instruction that proposal was
carrying. OpenZeppelin publishes the standard, audited version of this pattern
(OpenZeppelin, n.d.), and using it as-is would have been the obvious choice.

The problem is what "whatever instruction" means. A proposal can carry *any*
instruction at all — including one that empties the entire fund. So two of our
four promises would depend on owners reading the instruction and understanding
it before they vote:

- **G3**, that nothing is spent above the approved limit
- **G4**, that operating money is not spent on long-term maintenance, or the
  reverse

Owners will not do that. The research says so directly: in real on-chain
organisations, 10–20% of governance transactions are already meaningless —
votes cast with no voting power, self-delegations, zero-value transfers — which
tells us that this kind of system defeats ordinary users (Feichtinger et al.,
2023). Our electorate is forty apartment owners.

There is a harder version of the problem too. QAS-8 asks what happens if
somebody **steals the management firm's key** — not if the firm misbehaves, but
if an outsider can sign as the firm. The promises have to survive that.

## Decision

The treasury has exactly one function that sends money out:

```
release(fund, payee, amount, proposalId)
```

Before it pays anything, it checks four things itself, in code:

1. Is the caller allowed to trigger a payment at all?
2. Is this payee on the approved vendor list?
3. Is the amount within the limit the owners approved?
4. Is this coming out of the fund the owners approved?

Only **one** address in the whole system is allowed to trigger a payment: the
timelock — the contract that enforces the waiting period between a vote passing
and anything happening. Nothing can grant that permission to anyone else.

We keep the audited voting and waiting-period machinery. We do not keep the
part that lets a proposal carry an arbitrary instruction.

## Consequences

**What we gain.** The four promises stop being claims about what a proposal
*says* and become facts about what the treasury *will accept*. An auditor asking
"who can move money here?" reads one list and finds one entry. And if the firm's
key is stolen outright, the attacker can send money to **no new address at all**,
because adding a vendor needs an owner vote they cannot cast.

**What we pay.** We have stepped off the standard path, so less of our risk is
covered by code that has already been audited, and more sits in code this team
wrote — with a team new to Solidity and six weeks to do it (C9, C8). And any new
kind of spending in future needs a deliberate change to this one function rather
than just a differently-worded proposal. That friction is the point, but it is
still friction.

**One alternative worth recording.** We could have kept the general mechanism and
just listed which instructions are allowed. It looks safer, and it is not: a list
like that grows. Every new feature is a reason to add one more entry, and the
promise weakens one entry at a time, with no single moment where anyone notices
it has broken. Exposing one function is narrower than permitting a list.
