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

CI runs the steps in [`.github/workflows/ci.yml`](.github/workflows/ci.yml) on every pull request; each is an `npm run` script in `package.json`. To type-check the TypeScript as well:

```
npm run typecheck
```

## Deploy

[`scripts/deploy.ts`](scripts/deploy.ts) deploys the real system (#73). What it deploys, and the wiring check that makes it refuse a wrong deployment, are described at the top of the script. To dry-run it on Hardhat's in-process network:

```
npx hardhat run scripts/deploy.ts
```

To Sepolia, `hardhat.config.ts` reads `SEPOLIA_RPC_URL`, `SEPOLIA_PRIVATE_KEY` and `ETHERSCAN_API_KEY` through `configVariable`. Store them in the encrypted Hardhat keystore, never in a committed file, and check that the account holds enough:

```
npx hardhat keystore set SEPOLIA_RPC_URL
npx hardhat keystore set SEPOLIA_PRIVATE_KEY
npx hardhat keystore set ETHERSCAN_API_KEY
npm run check:sepolia-account
npx hardhat run scripts/deploy.ts --network sepolia   # writes evidence/week5/73-deployment-11155111.json
npx hardhat run scripts/verify.ts --network sepolia   # verifies each contract on Etherscan
npx hardhat run scripts/check-deployment.ts --network sepolia   # reads the wiring back, sends nothing
```

The check prints the deployer address, its balance and the balance required, and exits 1 if it is short. The account must be a throwaway test-network account, and must send nothing else while the deployment runs. What the test-network deployment is for is [ADR-017](https://github.com/nomadwiz/kaitiki-doc/blob/master/doc/design/decisions/adr/017-test-network-for-readability.md).

## Interface

The owners' and the management firm's view of the building, read from the contracts' event log and signed by the viewer's own wallet. What each screen shows and does is [`doc/design/interface.md`](https://github.com/nomadwiz/kaitiki-doc/blob/master/doc/design/interface.md), §4 for the screens and their actions; what it must withhold is FR41 and NFR10 in [`doc/design/spec.md` §8](https://github.com/nomadwiz/kaitiki-doc/blob/master/doc/design/spec.md#8-requirements). To run it against a local node seeded with a small building ([`scripts/building.ts`](scripts/building.ts)):

```
npx hardhat node              # terminal 1
npm run demo                  # terminal 2: deploys, seeds, writes interface/public/deployment.json
npm run interface             # terminal 3: then open the URL it prints
```

- **Whose workspace.** The address picks it ([ADR-021](https://github.com/nomadwiz/kaitiki-doc/blob/master/doc/design/decisions/adr/021-workspace-per-role.md)): the firm's address opens the Firm workspace, a wallet bound to a unit the Owner workspace, and any other address one screen with no building data. Without a browser wallet, `?as=<address>` in the URL picks the address, and with none the page opens as the first wallet bound to a unit. `firm` is in `interface/public/deployment.json`.
- **Switching role.** `npm run demo` seeds the building from the local node's default accounts, in the order `deployBuilding` takes them. Account #1, the adapter, only binds units and has no workspace.

  | Role | Account | URL |
  | --- | --- | --- |
  | Firm | #0 | `http://localhost:5173/?as=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` |
  | Alice, units 1 and 2 | #2 | `http://localhost:5173/?as=0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` |
  | Bob, unit 3 | #3 | `http://localhost:5173/?as=0x90F79bf6EB2c4f870365E785982E1f101E93b906` |
  | Carol, unit 4 | #4 | `http://localhost:5173/?as=0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65` |
  | Vendor, no unit | #5 | `http://localhost:5173/?as=0x9965507D1a55bcC2695C58ba16FB37d1a11A4dc8` |

  Without a browser wallet, open the role's URL; if `npm run interface` printed a port other than 5173, change it. With one, the wallet's account wins over `?as=`: import accounts #0 and #2–#4 from `npx hardhat node`'s printout, add the network `http://127.0.0.1:8545` with chain ID 31337, and switch account in the wallet. The page reloads by itself.
- **Signing.** Every action is signed by the viewer's wallet: a browser wallet shows its signing dialog, and the unlocked local account signs with no dialog ([`interface.md` §3](https://github.com/nomadwiz/kaitiki-doc/blob/master/doc/design/interface.md)).
- **Time.** The local node's clock moves only when a script moves it: `npm run demo` while seeding, then `npm run demo:loop`, which carries proposal 2 through the rest of the loop, and `UNTIL` stops it part-way so each stage can be seen: `UNTIL=passed` (the voting window has closed), `UNTIL=ready` (queued, delay passed), `UNTIL=attested` (the firm has attested), and with no `UNTIL` it runs to executed. Each run does only the steps still to do. Reload the interface after each.

The screenshots under `evidence/week6/` are captured with [`scripts/screenshot.mjs`](scripts/screenshot.mjs); `evidence/README.md` has the sequence.

## Where things belong

| Path | What belongs here |
| --- | --- |
| `contracts/` | Solidity sources, each with its Solidity tests (`*.t.sol`) beside it; `interfaces/` for the interfaces contracts call each other through, `stubs/` for stand-ins used before a real contract exists |
| `test/` | TypeScript tests, only for claims that are off-chain by definition |
| `interface/` | The interface: the Vite and React app, shadcn/ui's components in `src/components/ui/` (added with `scripts/shadcn-add.sh`), Kaitiaki's own in `src/components/kaitiaki.tsx`, its styles, and the screens |
| `scripts/` | Scripts run with `hardhat run` or `node`: deployment, the demo seeding and its stages, the event-log replay, the screenshot capture, and configuration checks |
| `evidence/` | Test output, gas tables and screenshots the report cites: one folder per week (`week1/`, `week2/`, …), each file named `<issue>-<slug>.<ext>`; its `README.md` says what each file shows |
| `.github/workflows/` | CI, run on every pull request, and the automated review |
| `artifacts/`, `cache/`, `coverage/`, `types/`, `interface/dist/`, `interface/public/deployment.json` | Build output; generated, never committed |

## Licence

MIT. See [`LICENSE`](LICENSE).
