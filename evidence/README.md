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
can carry. An admin turned it on under #96; its evidence is in `week5/`.

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

### Issue #91 — Treasury cumulative release limits

| File | What it shows | Reproduce with |
| --- | --- | --- |
| `91-treasury-cumulative-release-tests.txt` | 82 passing, `Treasury.sol` at 100% line and statement coverage. Release limits are cumulative per proposal (ADR-014): a second release that takes the total one wei past the limit reverts with the four-argument `AmountExceedsLimit` and leaves `released` unchanged, a total exactly at the limit is paid, one proposal's spent limit does not reduce another's, and a fuzz test over two amounts shows the pair succeeds if and only if their sum is within the limit. The new tests assert `PaymentReleased` on every release they expect to pay | `npm run test:coverage` |

### Issue #49 — Treasury role administration

| File | What it shows | Reproduce with |
| --- | --- | --- |
| `49-treasury-role-administration-tests.txt` | The constructor grants `RELEASER_ROLE` to the timelock and `DEPOSITOR_ROLE` to the LevyLedger, each role then has exactly that one member, and no address holds `DEFAULT_ADMIN_ROLE` (NFR8); a `grantRole` of `RELEASER_ROLE` by any caller, fuzzed and including the deployer, reverts with `AccessControlUnauthorizedAccount` (FR31, R8); each zero constructor address is refused with its own error | `npm run test:coverage` |

### Issue #50 — PayeeRegistry: admission by owner vote only

| File | What it shows | Reproduce with |
| --- | --- | --- |
| `50-payeeregistry-admission-tests.txt` | The ten `PayeeRegistryTest` tests pass alongside the existing suites, 88 passing, with 100% line and statement coverage of `PayeeRegistry.sol`: only the immutable executor may call `admit`, and any other caller is refused with `UnauthorizedExecutor(caller)`, fuzzed over 256 callers (FR12); a direct admission from the firm's key is refused (G2); a zero payee or a zero proposal id is refused with its own error; `isRegistered` is readable by any caller (FR13); `PayeeAdmitted` carries the payee and the admitting proposal id | `npm run test:coverage` |

This is the boundary test: it proves no address but the executor can admit. That the executor admits only after an executed affirmative proposal depends on which contract the executor is, which #56 settles, and is not proved here. With the caller check temporarily removed from `admit`, the fuzz test and the firm-key test both failed with "next call did not revert as expected"; the check was restored before this output was captured on 30-09-2026.

### Issue #90 — PayeeRegistry: duplicate admission is refused

| File | What it shows | Reproduce with |
| --- | --- | --- |
| `90-payeeregistry-duplicate-admission-tests.txt` | Admission is write-once. A second admission of a registered payee reverts with `PayeeAlreadyRegistered(payee, admittedBy)`, carrying the first admitting proposal id, whether it repeats the same proposal or names a new one, and the payee stays registered; because the call reverts, no second `PayeeAdmitted` reaches the log. The same run as the #50 capture: 88 passing, 100% line and statement coverage of `PayeeRegistry.sol` | `npm run test:coverage` |

With the duplicate check temporarily removed from `admit`, both duplicate tests failed with "next call did not revert as expected" and no other test failed; the check was restored before this output was captured on 30-09-2026.

### Issue #51 — secrets check and the deployment account

| File | What it shows | Reproduce with |
| --- | --- | --- |
| `51-deployment-account.txt` | The configuration secrets check passes on this tree, and its six tests pass: it exits 1 on a tracked file holding a private-key-shaped value, on a tracked `.env`, on a value filled in to `.env.example`, and outside a git repository, where it fails closed rather than passing; it exits 0 on a clean tree and on a committed Ignition journal, whose transaction hashes have the same shape as a key. Each test runs the check against a throwaway git repository, and the fake key is built at run time | `npm run check:config-secrets; npx hardhat test mocha test/check-config-secrets.ts` |

This covers the third acceptance criterion of #51, no key committed and a check on every pull request. It does not show the first, a funded account: that needs `npm run check:sepolia-account` run by the key holder, and its output (address, balance, required balance, date) captured here. The required balance is worked out at the top of `scripts/check-sepolia-account.ts`.

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

### Issue #58 — LevyLedger: charges, payment and arrears

| File | What it shows | Reproduce with |
| --- | --- | --- |
| `58-levyledger-tests.txt` | The 17 `LevyLedgerTest` tests pass alongside the existing suites, 110 passing, with 100% line and statement coverage of `LevyLedger.sol`. They run against the real `Treasury`, whose address and the ledger's are fixed before either exists (spec §4). `issueCharges` called one second before the due date reverts with `ChargeNotDue(chargeId, dueDate)` (B1, FR5); at the due date a stranger issues two charges (FR6, NFR7). A stranger pays a unit's charge: `LevyPaid` names the unit and the payer, and the receipt reaches the two funds 800/200 through `Treasury.deposit`, leaving the ledger with no balance and no allowance (FR7, FR8). A charge can be paid a week before it is issued (ADR-016). `arrearsOf` is false at the due date itself, true one second later, false again once paid, and never true for a charge nobody issued (FR9, ADR-016). Paying or issuing twice, an unknown charge and a failed token call each revert with a named error of their own (NFR9) | `npm run test:coverage` |
| `58-arrears-replay.txt` | The QAS-4 replay test, now running against the real `LevyLedger` instead of a signer standing in for it. From `ChargeIssued`, `LevyPaid` and a timestamp alone, `arrearsAt` gives the same arrears flag as `LevyLedger.arrearsOf` for each of five units: one paid before its charge was issued, one paid late, one never paid, and two never charged. The log carries a `LevyPaid` before the `ChargeIssued` for the same charge, and the replay accepts that order. Three forged logs are refused: a charge paid for a different unit from the one it was issued to, a charge issued twice, and a charge paid twice (FR9, FR40) | `npm run test:mocha` |

The tests bite, checked on 01-10-2026. With the due-date check removed from `issueCharges`, `test_IssuingBeforeTheDueDateReverts` and `test_OneChargeNotDueRevertsTheWholeBatch` fail. With the "issued" condition removed from `arrearsOf`, `test_ArrearsBeginsOnlyAfterTheDueDate` and `test_AChargeNobodyIssuedIsNeverInArrears` fail. Both were restored before this output was captured.

### Issue #65 — Refusal test B5

| File | What it shows | Reproduce with |
| --- | --- | --- |
| `65-refusal-b5-tests.txt` | Refusal test B5, proving G4: `testFuzz_ReleaseRejectsWrongFund` passes over 256 runs alongside the existing suites, 78 passing, with 100% line and statement coverage of `Treasury.sol`. Each run approves one of the two funds and asks `Treasury.release` to draw on the other, for any amount from 1 up to the proposal's limit, with a registered, matching payee and the timelock as caller, and the call reverts with `FundMismatch(approved, requested)` (NFR9). It replaces the single hand-picked `test_ReleaseRejectsWrongFund`, as spec §7 "Fuzz the value guards" asks | `npm run test:coverage` |

With the fund check temporarily removed from `Treasury.release`, the same test
fails: the fuzzer finds a counterexample whose release to the wrong fund does
not revert. The check was restored before this output was captured.

### Issue #63 — Refusal test B3

| File | What it shows | Reproduce with |
| --- | --- | --- |
| `63-refusal-b3-tests.txt` | The 28 `TreasuryTest` tests pass alongside the existing suites, with 100% line and statement coverage of `Treasury.sol`. Refusal B3 (spec §7), proving G1 and FR31: `testFuzz_ReleaseRefusesNonTimelock` calls `Treasury.release` from 256 random callers other than the timelock, with the payee registered and the fund holding enough, so the caller is the only reason to refuse; every one is refused with the distinct named error `UnauthorizedReleaser(caller)` (NFR9); `test_AdminCannotRelease` pins the deployer's case | `npm run test:coverage` |

The test bites: with the role check removed from `Treasury.release`, the fuzz
test fails because the call no longer reverts — the release is paid.
`test_AdminCannotRelease`, whose payee is not registered, fails with
`PayeeNotRegistered` instead of `UnauthorizedReleaser`.

### Issue #62 — Refusal test B2′

| File | What it shows | Reproduce with |
| --- | --- | --- |
| `62-refusal-b2-prime-tests.txt` | The 78 tests pass, with 100% line and statement coverage of `Treasury.sol`. Among them, `test_ReleaseRejectsUnregisteredPayee` is refusal B2′ (spec §7, FR34): the timelock calls `Treasury.release` for an approved proposal whose payee is not registered, and the call reverts with `PayeeNotRegistered(payee)`, a named error of its own (NFR9). This proves G2 again — the check is made at payment time and not cached from the proposal | `npm run test:coverage` |

B2′ is proved by calling `Treasury.release` directly with an unregistered payee, because registry removal is designed and not built (FR14). The test was checked to bite on 30-09-2026: with the registration check deleted from `Treasury.release`, it was the only one of the 78 to fail, with "next call did not revert as expected"; the check was then restored.

### Issue #69 — QAS-4: replay the event log on an independent node

| File | What it shows | Reproduce with |
| --- | --- | --- |
| `69-qas4-replay.txt` | The 13 `QAS-4 replay` tests pass. `scripts/replay.ts` is handed only a provider it may ask for `eth_getLogs`, so it makes no contract call and no storage read. It decodes every event the replayed contracts emit, Treasury's `RoleGranted` and `RoleRevoked` included, and refuses any log from those addresses it cannot decode. From the log alone it derives both fund balances, which equal `Treasury.balanceOf` exactly for each fund while a direct token transfer of 500 sits in Treasury uncredited; the holders of each Treasury role, so `RELEASER_ROLE` is held by the Timelock alone, `DEPOSITOR_ROLE` by the LevyLedger alone and `DEFAULT_ADMIN_ROLE` by nobody (rule 1, QAS-8); the amount released per proposal; each proposal's tally, keyed on the unit ids in `VoteCast` and equal to `Governance.tallyOf`, including a wallet that votes twice with different units; whether each proposal reached quorum, from the principal units in `ProposalCreated` and the units and distinct wallets in `VoteCast`, equal to `Governance.quorumReached` for a proposal that reached it, one that missed the two-wallet minimum and one nobody voted on; the unit-to-wallet bindings from `UnitBound`, equal to `MembershipRegistry`; the payee register from `PayeeAdmitted`, with the proposal that admitted each payee, equal to `PayeeRegistry.isRegistered`; the arrears flag (#58); and every transition in order. A forged log shows quorum's unit half at its rounding boundary: two units voted reach quorum against 8 principal units and miss it against 9. Eleven forged logs are refused: a vote for a unit no `UnitBound` gave the voter, a unit counted twice, a weight that is not the number of units, a vote on a proposal never created, a payee admitted twice, a release to a payee never admitted, a release on an admission proposal, the three forged levy logs from #58, and an undecodable log (FR40, NFR2) | `npm run test:mocha` |

The in-process network stands in for a node run by a party independent of the
operator and the firm — an insurer, a lender or an audit firm
(`deployment-view.md` §2.1). The same script runs against any JSON-RPC
endpoint: `node scripts/replay.ts <rpc-url> <treasury> <governance> <membership-registry> <levy-ledger> <payee-registry> [from-block]`.
Not yet replayed, because the code that emits them is not built: `ProposalQueued` (#56) and `WorkAttested` (#57). A proposal's outcome is not derived either: `Governance.state` depends on block timestamps, which `eth_getLogs` does not return, and `ProposalQueued` will put a passed proposal in the log.

The new checks bite, checked on 02-10-2026. Each of four mutations to `scripts/replay.ts` fails exactly one test: dropping quorum's unit half fails the rounding-boundary test; dropping its two-wallet half fails the main replay test; dropping the payee check on a release, or the duplicate-admission check, fails its forged-log test. The script was restored before this output was captured.

### Issue #96 — CI must pass before a merge to main

| File | What it shows | Reproduce with |
| --- | --- | --- |
| `96-main-rules.txt` | The rules GitHub enforces on `main`: the ruleset "Require CI on main" requires the `test` check from `.github/workflows/ci.yml` to pass before any merge, and pins it to GitHub Actions (`integration_id` 15368) so no other app can post a passing status under that name; the earlier ruleset still forbids deleting `main` and force-pushing to it. No rule requires an approving review, because authors cannot approve their own pull requests and the Claude review's token cannot approve at all, so a required approval would block every merge | `gh api repos/nomadwiz/kaitiaki/rules/branches/main` |

The rule is not in the code: it is a repository setting, created by an admin
through `POST /repos/nomadwiz/kaitiaki/rulesets`. A Claude review that finishes
before CI has its merge refused and leaves the pull request open for its author
to merge once CI passes.

### Issue #60 — Refusal test B1

| File | What it shows | Reproduce with |
| --- | --- | --- |
| `60-refusal-b1-tests.txt` | Refusal test B1 (spec §7), proving permissionless triggering is safe: `testFuzz_IssuingBeforeTheDueDateReverts` passes over 256 runs alongside the existing suites, 110 passing, with 100% line and statement coverage of `LevyLedger.sol`. Each run calls `LevyLedger.issueCharges` from a random caller at a random moment from zero up to one second before the due date, and the call reverts with `ChargeNotDue(chargeId, dueDate)`, a named error of its own (NFR9) — nobody may call early. `test_AnyCallerIssuesOnTheDueDate` is the other half: at the due date a stranger issues. The fuzz test replaces the single hand-picked `test_IssuingBeforeTheDueDateReverts` from #58 | `npm run test:coverage` |

The test bites, checked on 02-10-2026. With the due-date check removed from `issueCharges`, the fuzz test and `test_OneChargeNotDueRevertsTheWholeBatch` fail with "next call did not revert as expected", and no other test fails. The check was restored before this output was captured.

### Issue #55 — Governance: window, quorum, extension and waiver

| File | What it shows | Reproduce with |
| --- | --- | --- |
| `55-governance-quorum-tests.txt` | The 20 `GovernanceQuorumTest` tests pass alongside the existing suites, 130 passing, with 100% line and statement coverage of `Governance.sol` (FR20). Set in the reference building of 40 principal units: quorum needs a quarter of the units bound when the proposal was created, so 9 units fall short and 10 reach it, and a unit bound later votes but does not move that denominator; it also needs two distinct wallets, so one owner of 10 units is not quorate alone and a wallet that votes twice counts once (Unit Titles Act 2010, s 95). The proposal is `Open` for 14 days; it passes only on more units for than against, so a tie fails; voting closes with `VotingClosed` once the window ends with quorum. Without quorum it is `Extended` for 7 more days, and stays so even if quorum is reached inside the extension; then quorum is waived (reg 13(2)). `testFuzz_OneUnitPassesAfterExtension` passes over 256 runs: one unit of forty, voted at any moment in the 21 days, passes a proposal nobody else voted on — the finding in `sad.md` §2.5, expected to succeed, not a defect. A proposal nobody voted on, or a tie, still fails after the waiver, so no vendor is admitted without an affirmative vote (G2) | `npm run test:coverage` |

The tests bite, checked on 02-10-2026, one change at a time to `Governance.sol`. Letting a tie pass (`>=` for `>`) fails `test_TieFails`, `test_TieFailsAfterWaiver` and `test_NoVotesFailsAfterWaiver`. Dropping quorum's two-wallet half fails `test_QuorumNeedsTwoWallets`, `test_WalletCountsOnceTowardsTwoPersons` and `test_UnknownProposalHasNoQuorum`. Ignoring whether a vote was cast in the extension fails `test_ExtensionRunsItsCourseOnceQuorumReachedInIt`. No other test fails in any of the three. Each change was reverted before this output was captured.

### Issue #56 — Timelock wiring: schedule, execute, and the sole releaser

| File | What it shows | Reproduce with |
| --- | --- | --- |
| `56-timelock-wiring-tests.txt` | The 18 `GovernanceTimelockTest` tests pass alongside the existing suites, 150 passing, with 100% line and statement coverage of `Governance.sol`. Every contract is the real one, wired as ADR-015 sets out: OpenZeppelin's `TimelockController` unchanged with a 7-day delay, `Governance` holding its proposer, canceller and executor roles, the zero address not an executor, and the timelock its own admin while neither the deployer nor `Governance` is (`TimelockController` cannot list a role's members, so that `Governance` is the only holder rests on its constructor arguments, `[Governance]` for both lists); the timelock the single member of `Treasury`'s `RELEASER_ROLE` and `PayeeRegistry`'s executor (FR31, NFR8). Any address but `Governance` is refused by the timelock when it schedules or executes, each fuzzed over 256 callers, so `Governance.execute`'s checks cannot be stepped around. `Governance` targets only `PayeeRegistry` and `Treasury`, never the timelock. Anyone may queue a passed proposal and execute it once ready (FR22); `ProposalQueued` carries the `eta`. A work proposal schedules one release of its whole limit (ADR-015, amendment of 02-10-2026). Queueing a proposal that is open, failed, unknown or already queued is refused with a named error, as is executing one not queued or already run; executing at any moment before the 7 days have elapsed is refused with `NotReady`, fuzzed over 256 moments (FR21); and an unattested work proposal is refused with `NotAttested` a year after it became ready, with nothing paid (FR25) | `npm run test:coverage` |

The tests bite, checked on 02-10-2026, one change at a time to `Governance.sol`. Removing the attestation check from `execute` fails `test_ExecuteRefusesUnattestedWork`. Removing the readiness check fails `testFuzz_ExecuteBeforeDelayReverts`. Ignoring whether a proposal is on the timelock, so it never reads as queued, fails eight `GovernanceTimelockTest` tests, `test_QueueRefusesSecondSchedule` among them. No other test fails in any of the three. Each change was reverted before this output was captured.
