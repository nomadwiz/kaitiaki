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

### Issue #48 — Treasury release guards

| File | What it shows | Reproduce with |
| --- | --- | --- |
| `48-treasury-release-tests.txt` | Treasury release tests pass for Governance-backed proposal reads (an Admit proposal is refused as unknown), constructor-bound registry and settlement asset, release refused to any caller without `RELEASER_ROLE` (including the admin), proposal payee matching, proposal limits including the exact-limit boundary, fund matching, sufficient balances, opposite-fund isolation, settlement-token payment, `PaymentReleased` event emission, and no other value-moving or redirecting function. The role is granted in the tests' `setUp`; that no address can grant it after deployment is #49 | `npm run test:coverage` |

### Issue #49 — Treasury role administration

| File | What it shows | Reproduce with |
| --- | --- | --- |
| `49-treasury-role-administration-tests.txt` | The constructor grants `RELEASER_ROLE` to the timelock and `DEPOSITOR_ROLE` to the LevyLedger, each role then has exactly that one member, and no address holds `DEFAULT_ADMIN_ROLE` (NFR8); a `grantRole` of `RELEASER_ROLE` by any caller, fuzzed and including the deployer, reverts with `AccessControlUnauthorizedAccount` (FR31, R8); each zero constructor address is refused with its own error | `npm run test:coverage` |

## week4

### Issue #53 — Governance: propose, for both proposal kinds

| File | What it shows | Reproduce with |
| --- | --- | --- |
| `53-governance-propose-tests.txt` | The 14 `GovernanceProposeTest` tests pass alongside the existing suites, with 100% line and statement coverage of `Governance.sol`: the firm proposes both kinds (FR16, FR17); any other caller is refused with `NotFirm`, fuzzed over 256 callers per function; a work proposal naming an unregistered vendor is refused at creation with `PayeeNotRegistered` (FR18, G2); `ProposalCreated` carries the proposal's fields | `npm run test:coverage` |

The unregistered-vendor case proves the guard exists. The refusal test B2
itself is #61, written by another member (`ownership.md`), and is the one the
report cites.

### Issue #46 — MembershipRegistry: unit-to-wallet bindings and voting eligibility

| File | What it shows | Reproduce with |
| --- | --- | --- |
| `46-membership-registry-tests.txt` | The 11 `MembershipRegistryTest` tests pass alongside the existing suites, with 100% line and statement coverage of `MembershipRegistry.sol`: only the land-title adapter may bind, fuzzed over 256 callers, and any other caller is refused with `NotAdapter`; a unit binds to exactly one wallet, and a second binding — to another wallet or the same one — is refused with `UnitAlreadyBound` (FR1); an unbound wallet, or the zero address, is never an owner (FR2); a wallet's `unitsOf` length equals the units bound to it, fuzzed over 0–255 units (FR19); `UnitBound` carries the unit and wallet | `npm run test:coverage` |

The register holds no voting weight and no entitlement share: weight is the
number of units a wallet holds (ADR-003), which `Governance` counts. The
refusal test B8 — an unbound wallet cannot vote — is #67, written by another
member (`ownership.md`), and is the one the report cites.

### Issue #54 — Governance: castVote and eligibility

| File | What it shows | Reproduce with |
| --- | --- | --- |
| `54-governance-castvote-tests.txt` | The 13 `GovernanceVoteTest` tests pass alongside the existing suites, with 100% line and statement coverage of `Governance.sol`: a bound owner votes and an unbound wallet is refused with `NotBoundOwner` (FR2); weight is the number of units held (FR19); a unit votes once per proposal, including after it changes hands or is listed twice by the register, and a second vote with nothing new is refused with `AlreadyVoted` (ADR-003); a wallet may vote both ways with different units; `VoteCast` carries the wallet, direction, weight and the ids of only the units that voted in that call, excluding units voted earlier, stale register entries and duplicates, so a tally rebuilt from the log keys on unit ids | `npm run test:coverage` |

The unbound-wallet case proves the guard exists. The refusal test B8 itself is
#67, which the report cites.

## week5

### Issue #62 — Refusal test B2′

| File | What it shows | Reproduce with |
| --- | --- | --- |
| `62-refusal-b2-prime-tests.txt` | The 78 tests pass, with 100% line and statement coverage of `Treasury.sol`. Among them, `test_ReleaseRejectsUnregisteredPayee` is refusal B2′ (spec §7, FR34): the timelock calls `Treasury.release` for an approved proposal whose payee is not registered, and the call reverts with `PayeeNotRegistered(payee)`, a named error of its own (NFR9). This proves G2 again — the check is made at payment time and not cached from the proposal | `npm run test:coverage` |

B2′ is proved by calling `Treasury.release` directly with an unregistered payee, because registry removal is designed and not built (FR14). The test was checked to bite on 30-09-2026: with the registration check deleted from `Treasury.release`, it was the only one of the 78 to fail, with "next call did not revert as expected"; the check was then restored.
