# Kaitiaki

A body corporate treasury on a permissioned national housing chain. Owners vote
on what levy money buys; a contract releases it.

The treasury has exactly one function that sends money out, and it checks four
things itself before moving anything. No proposal can carry an instruction —
there is no general execution path anywhere in these contracts, deliberately.
`doc/design/spec.md` §2 states the four guarantees that rest on it.

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

`doc/design/ownership.md` says who writes which tests, and why nobody writes the
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

## Sepolia deployment account

Issue #51 reserves a funded deployment account before week 5. Hardhat 3
resolves `SEPOLIA_RPC_URL`, `SEPOLIA_PRIVATE_KEY`, and
`SEPOLIA_PRIVATE_KEY` through `configVariable`; store the endpoint and key in
the encrypted Hardhat keystore rather than committing them. The public
`SEPOLIA_MIN_BALANCE_WEI` threshold is supplied as an environment variable:

```
npx hardhat keystore set SEPOLIA_RPC_URL
npx hardhat keystore set SEPOLIA_PRIVATE_KEY
export SEPOLIA_MIN_BALANCE_WEI=<required-balance-in-wei>
npm run check:sepolia-account
```

The account must be a throwaway test-network account. Never put its private key
or `.env` file in Git. Every CI run executes `npm run check:config-secrets` to
reject tracked environment files and private-key-shaped values.

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
`doc/design/product.md` §16.2.

## The documents

The design this build implements is in `doc/design/` of the documents
repository, `nomadwiz/kaitiki-doc`. Clone that first, then the build
inside it as `code/`:

```
git clone https://github.com/nomadwiz/kaitiki-doc.git comp842-a1
git clone https://github.com/nomadwiz/kaitiaki.git comp842-a1/code
```

Paths written `doc/design/…` in the build's source comments resolve from the
documents repository's root; from inside `code/` they are `../doc/design/…`.

## Where things are

| Path                | What is in it                                                                                                                    |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `contracts/`        | Solidity sources, and the `.t.sol` tests that run against them                                                                   |
| `test/`             | TypeScript tests, for the claims that are off-chain by definition                                                                |
| `CLAUDE.md`         | The working agreement, for people and their assistants                                                                           |
| `evidence/`         | Screenshots, test listings and gas tables the report cites                                                                       |

## Licence

MIT. See `LICENSE`.
