# Evidence

Artefacts the report cites. Captured as the work happens, not retro-fitted in
the last week — a screenshot taken in a hurry is illegible, and an unexplained
figure earns nothing (C7).

## Conventions

- **One folder per week**: `week1/`, `week2/`, …
- **Filenames are `<issue-number>-<slug>.<ext>`**, so every artefact traces back
  to the pull request that produced it and the acceptance criterion it proves.
- **Every artefact records the command that reproduces it.** Text captures put
  the command in a header comment or the surrounding entry below; images get a
  caption here.
- **Every image has a one-line caption** saying what is being demonstrated and
  why it matters. The rubric requires each piece of visual evidence to be
  individually explained.
- **Screenshots at 14pt or larger, light background.** They end up in a Word
  document at half width.

## week1

### Issue #42 — repository and Hardhat 3 skeleton

| File | What it shows | Reproduce with |
| --- | --- | --- |
| `42-hardhat-test.txt` | Both test runners green: three Solidity tests and two TypeScript tests | `npx hardhat test` |
| `42-toolchain-versions.txt` | The exact Node, npm, Hardhat, compiler and library versions this project builds on | `node -v; npm -v; npx hardhat --version; npm ls --depth=0` |
| `42-hardhat-test-green.png` | Terminal screenshot of the green run. **Not yet captured** — see below | screenshot of `npx hardhat test` |

`42-toolchain-versions.txt` is the one with lasting value. It is the
reproducibility record behind every gas number and test result the report later
prints, and the Prototype Implementation criterion asks explicitly for the
technologies, frameworks and tools used.

The green suite itself is a canary for the toolchain, not a demonstration of
system functionality — there are no contracts yet. It belongs in an appendix,
not as a numbered figure.

### Issue #45 — MockNZD, the mock settlement token

| File | What it shows | Reproduce with |
| --- | --- | --- |
| `45-mocknzd-tests.txt` | The six `MockNZDTest` tests pass alongside the toolchain canaries: 18 decimals; minting succeeds on the Hardhat network and on Sepolia; on 256 randomly chosen other chains it is refused with `MintOutsideTestChain`; and the token has no voting, delegation, role or owner function (NFR15) | `npx hardhat test` |

This proves the governance half of NFR15 only. The other half, that the token
confers no consensus weight, is a property of the network rather than of any
contract: validators are appointed under proof of authority (ADR-007). The
report cites ADR-007 for that half, not this test.

### Issue #43 — coverage, gas statistics, linting and CI

| File | What it shows | Reproduce with |
| --- | --- | --- |
| `43-coverage.txt` | Coverage built into Hardhat 3 (no plugin needed): 100% on `MockNZD`, 0% on the untested stubs — expected, since the stubs exist only for other verticals to build and test against, not to be tested here | `npm run test:coverage` |
| `43-gas-stats.txt` | Gas usage statistics built into Hardhat 3 for every function call in a test run, proving NFR11 is measurable now rather than retro-fitted in week 4 | `npm run test:gas` |
| `43-lint.txt` | solhint configured (`solhint:recommended` plus the pinned 0.8.36 compiler-version rule) running clean: 0 errors across every contract, only advisory warnings | `npm run lint` |
| `.github/workflows/ci.yml` (not evidence text — the file itself) | The workflow that runs lint, format check, build, Solidity tests with coverage, and the TypeScript suite on every pull request | Open a pull request and see the checks run |

**Not yet captured.** A screenshot of the green GitHub Actions run — needs an
actual pull request open against `main` first.

**Branch protection on main is not done by this issue's code.** It is a
repository setting only a repo admin can change (verified: this account has
`push` but not `admin` on `nomadwiz/kaitiaki`), not something a pull request
can carry. Whoever holds admin needs to turn it on directly in GitHub settings.

Introducing prettier for the first time reformatted three pre-existing files
(`MockNZD.sol`, `MockNZD.t.sol`, `Toolchain.t.sol`) to the configured line
width — whitespace only, no behaviour change, verified by the full test suite
passing unchanged before and after.

## week2

### Issue #47 — Treasury deposit split

| File | What it shows | Reproduce with |
| --- | --- | --- |
| `47-treasury-tests.txt` | Treasury tests pass, including the configured ledger, settlement-token custody, and 80/20 fund split | `npm run test:coverage` |
