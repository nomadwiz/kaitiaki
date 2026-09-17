# ADR-007 — Permissioned proof of authority, not proof of stake

**Status.** Accepted, 28 Aug 2026.

## Context

The network needs a way for its participants to agree on what happened. The two
obvious families are:

- **Proof of stake**, where participants put up something valuable and lose it if
  they cheat.
- **Proof of authority**, where participants are known, identified organisations
  and their reputation and legal accountability stand in for the stake.

Proof of stake exists to secure networks where anyone can join anonymously — the
money at risk substitutes for knowing who someone is. It needs a valuable native
token to work.

This network is different in two ways that matter. Its participants are named,
legally accountable institutions: a government agency, insurers, banks, audit
firms. And the money moving through it is an NZD-pegged stablecoin, not a token
this project issues.

## Decision

Permissioned proof of authority, with a known and deliberately mixed set of
participants, and no native token.

## Consequences

**What we gain.** No need to invent a tradeable asset for a public housing
registry and then explain why a government service has a speculative token
attached to it. Payments also settle with certainty rather than becoming
gradually more final, which matters when the transactions are payments.

**What we pay.** Proof of authority gets criticised as centralised, and the
criticism is fair unless the participant mix genuinely holds. Security here comes
from the mix plus the fact that anyone can read and check the chain — not from
money at risk. That is why the one-third rule in the deployment view is written
as a requirement rather than a hope.

**Alternatives on the record.** Proof of stake using the existing stablecoin is
viable, avoids inventing an asset, and is the fallback if a reviewer insists on
economic security. A fully public permissionless chain would answer the "is this
really a blockchain?" objection most strongly, and was rejected on cost,
throughput and the absence of anyone accountable for a public register.

**A mistake worth recording, because it changed the design.** An earlier version
of this proposal argued that making management firms stake separately in each
building they manage would stop any one of them getting too much influence. It
does not: influence adds up across addresses, so a firm staking in a thousand
buildings ends up with a thousand stakes' worth. Concentration is prevented by
capping weight per class, not by how the staking is arranged.

Separately — and this one invalidated the original accountability argument
entirely — **the penalty for cheating at consensus does not touch misuse of a
building's funds.** They are different layers. That realisation is what led to
the fee retention mechanism in [`product.md` §11.3](../../product.md#113-accountability-without-a-deposit).
