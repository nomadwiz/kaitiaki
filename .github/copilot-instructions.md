# Kaitiaki — repository instructions

The full brief for this repository is **[`CLAUDE.md`](../../CLAUDE.md)**, and the
build specification — the four guarantees, the contracts and their guards, the
statutory parameters, the events, the refusal tests and the requirement
identifiers — is **[`docs/spec.md`](../../docs/spec.md)**. Read both before writing
code. Where this file and `CLAUDE.md` disagree, `CLAUDE.md` is right.

## Rules that override anything else

The treasury has exactly one function that sends money out —
`release(fund, payee, amount, proposalId)` — callable only by the timelock, which
checks four things itself before moving anything. **Never introduce a general
execution path.** Do not write any of the following; each one breaks the
architecture rather than merely being untidy:

- a `call`, `delegatecall` or `execute(bytes calldata)` anywhere in the contracts
- a proposal struct holding target addresses or calldata
- a function on `Treasury` that transfers value other than `release`
- a way to grant `RELEASER_ROLE` after deployment
- an owner or admin function that can pause, reverse or redirect a payment

Quorum, thresholds, the voting window and the timelock delay come from New
Zealand's unit titles statutory scheme. **Never invent, round or improve one** —
the values are in `docs/spec.md`.

Nine requirements are designed and deliberately **not** built, among them the
maintenance plan, arrears enforcement, payee removal and owners raising
proposals. Building one makes the report's requirements section wrong. If a task
seems to need one, say so on the issue instead of implementing it.

Every guard reverts with its own named error, and events must carry enough to
reconstruct state from the log alone.
