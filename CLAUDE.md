# Kaitiaki — working agreement for people and their agents

A body corporate treasury on a permissioned national housing chain. Owners vote
on what levy money buys; a contract releases it. This file is the standing brief
for anyone working in this repository, including AI assistants. Read it and
[`docs/spec.md`](docs/spec.md) before writing code.

**This file is the brief, and the only full copy.**
`.github/copilot-instructions.md` is a short pointer to it, so that a teammate
working with GitHub Copilot starts from the same facts; it repeats only the hard
prohibitions. If a decision changes, change this file, and check in the same
commit whether that prohibition list still matches.

This is university coursework (COMP842, assignment 1). Three people, seven weeks,
and **80 of the 100 marks are for written work**. The prototype exists to make
claims in a report demonstrable. That shapes what "good" means here: a small
correct system with legible evidence beats a large impressive one.

## The one thing to get right

The treasury has exactly **one** function that sends money out:

```solidity
function release(Fund fund, address payee, uint256 amount, uint256 proposalId) external;
```

Only the timelock may call it, and it checks four things itself before moving
anything. **Never introduce a general execution path.** The usual on-chain
governance pattern lets a passed proposal carry an encoded instruction and
executes whatever it says; this design deliberately does not, because two of its
four guarantees cannot hold if a proposal can carry any call at all.

Concretely, if you are about to write any of the following, stop — it breaks the
architecture:

- a `call`, `delegatecall` or `execute(bytes calldata)` anywhere in the contracts
- a proposal struct holding target addresses or calldata
- a function on `Treasury` that transfers value other than `release`
- a way to grant `RELEASER_ROLE` after deployment
- an owner or admin function that can pause, reverse or redirect a payment

## Conventions

- **Parameters are not choices.** Quorum, thresholds, windows and the timelock
  delay come from New Zealand's unit titles statutory scheme and are listed in
  [`docs/spec.md`](docs/spec.md). Do not invent, round or "improve" one. If a value
  seems wrong, raise it as an issue rather than changing it.
- **Every guard reverts with a distinct named error.** No bare `require` with a
  string, no shared `Unauthorized()` covering four cases. A test asserts the
  specific error, and the report tabulates them.
- **Events must be sufficient to reconstruct state.** Someone replaying the log
  alone, with no contract storage reads, must be able to derive every fund
  balance and every transition. An event carrying only an identifier fails this.
- **Interfaces before implementations.** The build order is nearly serial, so a
  stub that satisfies an interface unblocks two other people.
- **No new dependencies without discussion.** OpenZeppelin and the Hardhat
  toolchain are settled; anything else needs an issue.
- **Never commit a private key or a `.env`.** `.env.example` is committed;
  `.env` is ignored.

## Definition of done

An issue closes when the tests pass in CI, one other member has approved the
pull request, and any evidence the report needs — a screenshot, a test listing,
a gas table — is captured and committed under `evidence/`.

Capture evidence as you go. Retro-fitting screenshots in the last week is how
figures end up illegible, and an unexplained figure earns nothing.

## Scope

Six contracts are built. A seventh, `MaintenancePlan`, is designed and not
built, and nine requirements depend on it or on systems outside the prototype.
[`docs/spec.md`](docs/spec.md) marks each one.

**Do not build the unbuilt.** If an issue seems to need `MaintenancePlan`,
ownership transfer, arrears enforcement, payee removal, or owners raising
proposals, it is out of scope — say so on the issue rather than implementing it.
The report explains what was designed and not built, and why; quietly building
one of them makes that section wrong.

## Picking up a piece of work

**The GitHub issues are the checklist.** There is no task list in this
repository, deliberately — a file three people tick on three branches conflicts
constantly, and a box an assistant ticks proves only that it believed it was
finished. An issue closes because a reviewed pull request merged, which is
evidence.

To pick up work:

```
gh issue list --assignee @me                 # what is mine
gh issue view <n>                            # the task and its acceptance criteria
git checkout -b <n>-short-description
```

Tick the acceptance criteria on the issue as they are actually met — `gh issue
edit <n>` or the web interface — and open a pull request whose description says
`Closes #<n>`. Do not tick a box for work that has not passed its test.

`docs/ownership.md` says who owns which vertical. If a task seems to need a
contract you do not own, say so on the issue rather than building it: the build
order is nearly serial, so write against the interface and use a stub.

## Working with issues

Every issue names the requirements it closes and the guarantees or tests it
proves — `FR31`, `G1`, `B3`. Those identifiers come from the architecture and
are cited in the report, so keep them in commit messages and pull request
descriptions. Do not renumber them or invent new ones.

Branch per issue, named `<issue-number>-short-description`. Pull request titles
reference the issue. One approving review before merge.
