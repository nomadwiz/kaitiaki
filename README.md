# Kaitiaki

Smart contracts for a New Zealand body corporate's treasury, in which unit owners vote on what levy money buys and a contract pays for it — the prototype for COMP842 Applied Blockchain and Cryptocurrency, Assignment 1.

## The documents

The design this build implements — the requirements, the decisions, who owns what, and why each tool was chosen — is in `doc/design/` of the documents repository, [`nomadwiz/kaitiki-doc`](https://github.com/nomadwiz/kaitiki-doc). Clone it first, then this repository inside it as `code/`:

```
git clone https://github.com/nomadwiz/kaitiki-doc.git comp842-a1
git clone https://github.com/nomadwiz/kaitiaki.git comp842-a1/code
```

Paths written `doc/design/…` in this repository's source comments resolve from the documents repository's root; from inside `code/` they are `../doc/design/…`. Start with:

- [`doc/design/spec.md`](https://github.com/nomadwiz/kaitiki-doc/blob/master/doc/design/spec.md) — what is built, and the stack (§9)
- [`doc/design/ownership.md`](https://github.com/nomadwiz/kaitiki-doc/blob/master/doc/design/ownership.md) — the group, and who owns and tests what
- [`CLAUDE.md`](CLAUDE.md) — the rules for working in this repository

## Prerequisites

- Node 22.13 or newer. The exact version is pinned in `.nvmrc`; `nvm use` selects it.
- npm and git.

## Setup

```
nvm use
npm ci
```

## Test

```
npx hardhat test              # every test: Solidity, then TypeScript
npm run test:solidity         # the Solidity tests (*.t.sol) only
npm run test:mocha            # the TypeScript tests only
npm run test:coverage         # Solidity tests with a coverage report
npm run test:gas              # Solidity tests with gas statistics
```

The checks CI runs on every pull request:

```
npm run check:config-secrets
npm run lint
npm run format:check
npm run build
npm run typecheck
```

## Deploy

To Hardhat's in-process network, printing each deployed address:

```
npx hardhat run scripts/deploy.ts
```

To Sepolia, `hardhat.config.ts` reads `SEPOLIA_RPC_URL` and `SEPOLIA_PRIVATE_KEY` through `configVariable`. Store both in the encrypted Hardhat keystore, never in a committed file, and check the account holds enough before deploying:

```
npx hardhat keystore set SEPOLIA_RPC_URL
npx hardhat keystore set SEPOLIA_PRIVATE_KEY
npm run check:sepolia-account
```

The check prints the deployer address, its balance and the balance required, and exits 1 if it is short. The account must be a throwaway test-network account.

## Replay the record

Anyone can rebuild the building's balances, votes and payments from the event log alone, against any JSON-RPC endpoint:

```
node scripts/replay.ts <rpc-url> <treasury> <governance> <membership-registry> <levy-ledger> <payee-registry> [from-block]
```

## Where things belong

| Path | What belongs here |
| --- | --- |
| `contracts/` | Solidity sources, each with its Solidity tests (`*.t.sol`) beside it; `interfaces/` for the interfaces contracts call each other through, `stubs/` for stand-ins used before a real contract exists |
| `test/` | TypeScript tests, only for claims that are off-chain by definition |
| `scripts/` | Scripts run with `hardhat run` or `node`: deployment, the event-log replay, and configuration checks |
| `evidence/` | Test output, gas tables and screenshots the report cites, one folder per week, named `<issue>-<slug>`; its `README.md` says what each file shows |
| `ignition/deployments/` | Records of test-network deployments, which are committed as evidence |
| `.github/workflows/` | CI, run on every pull request, and the automated review |
| `artifacts/`, `cache/`, `coverage/`, `types/` | Build output; generated, never committed |

## Licence

MIT. See [`LICENSE`](LICENSE).
