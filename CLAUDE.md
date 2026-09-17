# Kaitiaki

A treasury for an apartment building's body corporate. Owners vote on what levy
money buys, and a contract pays for it. This file is the starting point for
anyone working here, people and AI assistants alike: it says where to look, and
it holds every rule.

This is university coursework (COMP842, assignment 1): three people, seven weeks.
80 of the 100 marks are for the written report, so a small system that works
correctly and has clear evidence beats a large, impressive one.

## Where to look

| File | What it is | Read it when |
| --- | --- | --- |
| [`docs/product.md`](docs/product.md) | The product in plain language: the problem, who has it, how money moves, why a blockchain, and the timeline | You need to know what we are building and why |
| [`docs/spec.md`](docs/spec.md) | The technical build: the four guarantees, each contract and its checks, the parameters, events, refusal tests, requirements and stack | Before writing any code |
| [`docs/ownership.md`](docs/ownership.md) | Who owns which contracts, who tests whose code, and how an issue goes from picked up to merged | Before picking up an issue |

The decision records (`docs/decisions/adr/`) and the five architecture views
(`docs/decisions/views/`) explain why the design is the way it is. Each of the
three files above links to the ones that matter to it. Where they mention
`sad.md` or `method/`, that is the full architecture description, which lives
outside this repository.

## Rules

1. **Money leaves only through `Treasury.release`**, and only the timelock can
   call it. Never write `call`, `delegatecall` or `execute(bytes)`; a proposal
   that holds target addresses or calldata; any other `Treasury` function that
   moves value; a way to grant `RELEASER_ROLE` after deployment; or an admin
   function that pauses, reverses or redirects a payment.
   [ADR-001](docs/decisions/adr/001-narrow-release-interface.md) explains why.
2. **Never invent, round or change a parameter.** The values come from New
   Zealand law ([`docs/spec.md` §5](docs/spec.md#5-parameters--statutory-not-chosen)). If one looks wrong, raise an issue.
3. **Never build what is designed but not built** — the `D` rows in
   [`docs/spec.md` §8](docs/spec.md#8-requirements) and everything in §10. Say so on the issue instead.
4. **Never reopen a settled decision in code.** If you think a decision record is
   wrong, raise an issue.
5. **Every check that refuses reverts with its own named error.** No `require`
   with a string, and no single error shared by several checks.
6. **Events carry enough to rebuild all state from the log alone**, with no
   storage reads.
7. **Contract tests are written in Solidity** (`.t.sol`, `vm.expectRevert` with
   the contract's own error). TypeScript is only for claims that are off-chain by
   definition.
8. **No new dependency without an issue.** OpenZeppelin and the Hardhat toolchain
   are settled.
9. **Never commit a private key or `.env`.**

Rules change here and nowhere else.
[`.github/copilot-instructions.md`](.github/copilot-instructions.md) only points
to this file.
