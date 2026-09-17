# Kaitiaki

A body corporate treasury on a permissioned national housing chain. Owners vote
on what levy money buys; a contract releases it.

The treasury has exactly one function that sends money out, and it checks four
things itself before moving anything. No proposal can carry an instruction —
there is no general execution path anywhere in these contracts, deliberately.
`docs/spec.md` §2 states the four guarantees that rest on it.

## The paper

**COMP842 — Applied Blockchain and Cryptocurrency. Assignment 1.**

This repository is the assignment's prototype source. The report carries key
contract snippets only, never the full source.

## The group

| Member      | GitHub                 | Vertical                                                                     |
| ----------- | ---------------------- | ---------------------------------------------------------------------------- |
| Nicholas Ng | `@nomadwiz`            | **Money in** — `MembershipRegistry`, `LevyLedger`, the mock settlement token |
|             | `@tutd-work`           | **Money out** — `Treasury`, `PayeeRegistry`                                  |
|             | `@laysokhour-computer` | **Decisions** — `Governance`, `Timelock`                                     |

`docs/ownership.md` says who writes which tests, and why nobody writes the
refusal tests for their own contracts.

## Getting started

Node 22.13 or newer — Hardhat 3 refuses to start below that. The exact version
this was built on is pinned in `.nvmrc`.

```
nvm use          # or install Node 22.23.2 by any other means
npm install
npx hardhat test
```

Contract tests are written in Solidity; TypeScript is kept for the claims that
are off-chain by definition. The two suites can be run separately:

```
npx hardhat test solidity
npx hardhat test mocha
```

## Stack

| Piece      | Choice                                                                                                                                                                                                                      |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contracts  | Solidity 0.8.36, fixed pragma; optimiser on, 200 runs; `prague` EVM target                                                                                                                                                  |
| Libraries  | OpenZeppelin Contracts 5.6.1 — `AccessControl`, `TimelockController`, `ERC20`, and nothing else                                                                                                                             |
| Toolchain  | Hardhat 3.15 with `@nomicfoundation/hardhat-toolbox-mocha-ethers`                                                                                                                                                           |
| Testing    | Solidity tests (`.t.sol`) with `forge-std` assertions and cheatcodes. Coverage and gas statistics are built into Hardhat 3                                                                                                  |
| Settlement | `MockNZD` (`contracts/MockNZD.sol`) — a **mock** ERC-20 standing in for an NZD-pegged stablecoin. Anyone may mint it, but only on the Hardhat network or Sepolia. This project issues nothing, and holding it gives no vote |

The compiler version and the EVM target are pinned rather than floating because
the report publishes gas measurements, and a measurement is only meaningful if
the bytecode behind it can be reproduced. The reasoning for every row is in
`docs/product.md` §16.2.

## Status

**Week 1.** The toolchain, the contract interfaces and their stubs (#44), and the mock settlement token `MockNZD` (#45) are in place. None of the six system contracts is built yet.

Six contracts are planned, in this build order — `MembershipRegistry`, then
`Treasury` and `PayeeRegistry`, then `Governance` and `Timelock`, then
`LevyLedger` — plus `MockNZD`, a mock NZD ERC-20. A seventh, `MaintenancePlan`, is designed
and deliberately **not** built; nine requirements depend on it or on systems
outside the prototype, and `docs/spec.md` marks each one.

Deployment in week 5 is to a **public test network**, not the permissioned
national housing chain the design assumes. The report says so, and so does this
file.

## Where things are

| Path                | What is in it                                                                                                                    |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `contracts/`        | Solidity sources, and the `.t.sol` tests that run against them                                                                   |
| `test/`             | TypeScript tests, for the claims that are off-chain by definition                                                                |
| `docs/index.md`     | The map of every document here, and where each identifier is defined                                                             |
| `docs/product.md`   | The product in plain language — the problem, the evidence, the build plan and the timeline                                       |
| `docs/sad.md`       | The architecture description: requirements, drivers, the five views, evaluation and limits                                       |
| `docs/spec.md`      | The build specification: the guarantees, the contracts and their guards, the statutory parameters, the events, the refusal tests |
| `docs/ownership.md` | Who owns which vertical, and who writes which tests                                                                              |
| `docs/decisions/`   | Why the design is the way it is — thirteen decision records, one superseded, and the five architecture views                     |
| `CLAUDE.md`         | The working agreement, for people and their assistants                                                                           |
| `evidence/`         | Screenshots, test listings and gas tables the report cites                                                                       |

## Licence

MIT. See `LICENSE`.
