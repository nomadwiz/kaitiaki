# Kaitiaki — repository instructions

Three files sit behind this one, and they are the authority:

- **[`../CLAUDE.md`](../CLAUDE.md)** — the full brief. Where this file and it disagree, it is right
- **[`../docs/spec.md`](../docs/spec.md)** — the build specification: the four guarantees, the contracts and their guards, the statutory parameters, the events, the refusal tests, and every requirement marked built or designed
- **[`../docs/ownership.md`](../docs/ownership.md)** — who owns which vertical, and who writes which tests

Read the brief and the specification before writing code.

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

## Picking up a piece of work

**The GitHub issues are the checklist.** There is no task list file in this
repository, deliberately — do not create one. An issue closes because a reviewed
pull request merged, which is evidence; a ticked box in a file is not.

```
gh issue list --assignee @me                 # what is mine
gh issue view <n>                            # the task and its acceptance criteria
git checkout -b <n>-short-description
```

Tick the acceptance criteria on the issue as they are actually met, and open a
pull request whose description says `Closes #<n>`. Do not tick a box for work
that has not passed its test.

The build order is nearly serial, so you will need something that does not exist
yet. **Write against the interface and use a stub.** Do not implement another
vertical's contract to unblock yourself — say so on the issue instead. If a
change must touch another vertical's contract, its owner reviews the pull
request.

Keep the `FR`, `NFR`, `G` and `B` identifiers exactly as the issue states them.
They are cited in the report; do not renumber or invent them.
