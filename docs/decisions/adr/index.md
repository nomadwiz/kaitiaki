# Decision index

A decision gets its own record when a competent engineer could reasonably have
made the opposite call. Descriptions of how the system *is* stay in the views;
the reasoning for why it is that way lives here, because reasoning changes far
faster than structure does.

| ADR | Title | Status | Where it came up |
| --- | --- | --- | --- |
| 001 | The treasury has only one way to pay money out | Accepted | Functional view, R1 |
| 002 | The firm's withheld fees are kept in their own contract | **Superseded by 012** | Functional view, R6 |
| 003 | One unit, one vote — and capture needs far fewer than a majority | Accepted | Gate 2, QAS-9 |
| 004 | New versions of the contracts are out of scope | Accepted | QAS-2 — declared exclusion, not designed |
| 005 | Arrears are published per unit, not just as a building total | Accepted | Information view, R3 |
| 006 | There is no elected committee | Accepted | Context view, A1 |
| 007 | Permissioned proof of authority, not proof of stake | Accepted | Deployment view, R1 |
| 008 | The maintenance plan cannot be edited once ratified | Accepted | Designed only; carried from [`product.md` §11.6](../../product.md#116-the-maintenance-plan-is-immutable-for-its-term) |
| 009 | The ledger is readable by anyone, not gated to citizens | Accepted | Deployment view, R2 — reclassified from a constraint |
| 010 | One standard contract set, published once, instantiated per building | Accepted | Deployment view, R3 — reclassified from a constraint |
| 011 | Payment is released by the firm's attestation, with nothing in between | Accepted | Closing the open parameters |
| 012 | Accountability is external; the architecture supplies evidence | Accepted | Closing the open parameters — supersedes 002 |
| 013 | The voting contract is written for this project, not extended from a framework | Accepted | Planning the build — refines 001 |

**On 004.** The gap is real — if the operator could push a new version to a
running building, it could change the rules underneath it, and §5.1's central
claim would not hold across versions. The project has decided this is out of
scope rather than designing an answer, and 004 records that as a decision so the
gap is visible rather than accidental.
