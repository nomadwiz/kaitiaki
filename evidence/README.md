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
- **Absolute local paths in a text capture are replaced with `<repo>`**, the repository root on the machine that captured it.
- **Every image has a one-line caption** saying what is being demonstrated and
  why it matters. The rubric requires each piece of visual evidence to be
  individually explained.
- **Screenshots print at 14pt or larger, light background.** They are placed
  at full text width in a Word document, about 451 pt on A4. A 520 CSS px
  viewport captured at 2× device scale prints 16 px body text at about 14 pt,
  and nothing on the read interface below 10 pt.

## week1

### Issue #42 — repository and Hardhat 3 skeleton

| File | What it shows | Reproduce with |
| --- | --- | --- |
| `42-hardhat-test.txt` | Both test runners green: three Solidity tests and two TypeScript tests | `npx hardhat test` |
| `42-toolchain-versions.txt` | The exact Node, npm, Hardhat, compiler and library versions this project builds on | `node -v; npm -v; npx hardhat --version; npm ls --depth=0` |

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

### Issue #64 — Refusal test B4

| File | What it shows | Reproduce with |
| --- | --- | --- |
| `64-refusal-b4-tests.txt` | Refusal test B4, proving G3 and FR32: two fuzz tests pass over 256 runs each alongside the existing suites, 171 passing, with 100% line and statement coverage of `Treasury.sol`. `testFuzz_ReleaseRejectsAmountOverProposalLimit` approves any limit and asks `Treasury.release` for any amount above it, with the fund holding enough to pay, a registered, matching payee and the timelock as caller; the call reverts with `AmountExceedsLimit(proposalId, amount, 0, limit)` (NFR9) and nothing is released or paid. `testFuzz_CumulativeReleaseNeverExceedsLimit` approves any limit and makes two releases against it: the second succeeds only while the total stays within the limit, and otherwise reverts with `AmountExceedsLimit(proposalId, second, first, limit)`, so no sequence takes the total above the limit (ADR-014). `testFuzz_ReleaseRejectsAmountOverProposalLimit` replaces the single hand-picked `test_ReleaseRejectsAmountOverProposalLimit`, as spec §7 "Fuzz the value guards" asks; `testFuzz_CumulativeReleaseNeverExceedsLimit` already existed (#91, PR #104) and now fuzzes the limit too. The run also includes `test_TreasuryStubEmitsReleaseCall`, which brings `TreasuryStub.sol` to full coverage | `npm run test:coverage` |

With the limit check temporarily removed from `Treasury.release`, both fuzz
tests fail, as does `test_ReleaseRejectsCumulativeAmountOverProposalLimit`:
checked on 03-10-2026. The check was restored before this output was captured.

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
| `69-qas4-replay.txt` | The 23 `QAS-4 replay` tests pass. `scripts/replay.ts` is handed only a provider it may ask for `eth_getLogs` and block headers, so it makes no contract call and no storage read. It decodes every event the replayed contracts emit, Treasury's `RoleGranted` and `RoleRevoked` included, and refuses any log from those addresses it cannot decode. From the log alone it derives both fund balances, which equal `Treasury.balanceOf` exactly for each fund while a direct token transfer of 500 sits in Treasury uncredited; the holders of each Treasury role, so `RELEASER_ROLE` is held by the `TimelockController` alone, `DEPOSITOR_ROLE` by the LevyLedger alone and `DEFAULT_ADMIN_ROLE` by nobody (rule 1, QAS-8); the amount released per proposal, here a work proposal's whole limit, paid once it was queued, attested and executed through the real `TimelockController`; each proposal's tally, keyed on the unit ids in `VoteCast` and equal to `Governance.tallyOf`, including a wallet that votes twice with different units; whether each proposal reached quorum, from the principal units in `ProposalCreated` and the units and distinct wallets in `VoteCast`, equal to `Governance.quorumReached` for a proposal that reached it, one that missed the two-wallet minimum and one nobody voted on; each proposal's state, from `ProposalCreated`, `VoteCast`, `ProposalQueued`, the executions and block times, equal to `Governance.state` at the last replayed block for all five proposals: two `Executed`, one `Queued`, one `Failed` and one `Passed`; the unit-to-wallet bindings from `UnitBound`, equal to `MembershipRegistry`; the payee register from `PayeeAdmitted`, with the proposal that admitted each payee, equal to `PayeeRegistry.isRegistered`, the vendor admitted by an admission proposal voted on, queued and executed through the real `TimelockController`; which proposals are queued, with the `eta` from `ProposalQueued`, equal to the queue block's timestamp plus `Governance.TIMELOCK_DELAY`, and queued exactly when `Governance.state` is `Queued` or `Executed`; which proposals are attested, with the attester and evidence hash from `WorkAttested`, equal to `Governance.attested`; the arrears flag (#58); and every transition in order. A forged log shows quorum's unit half at its rounding boundary: two units voted reach quorum against 8 principal units and miss it against 9. Another shows a vote cast in the extension keeping its proposal `Extended` until the extension ends, though it reaches quorum. Twenty forged logs are refused: a vote for a unit no `UnitBound` gave the voter, a unit counted twice, a weight that is not the number of units, a vote on a proposal never created, a payee admitted twice, a release to a payee never admitted, a release on an admission proposal, the three forged levy logs from #58, a proposal queued that was never created, a proposal queued twice, an attestation on an admission proposal, an attestation on a proposal never queued, a proposal attested twice, an admission and a release on a proposal never queued, an admission and a release in a block before their proposal's `eta` (FR21), and an undecodable log (FR40, NFR2) | `npm run test:mocha` |

The in-process network stands in for a node run by a party independent of the
operator and the firm — an insurer, a lender or an audit firm
(`deployment-view.md` §2.1). The same script runs against any JSON-RPC
endpoint: `node scripts/replay.ts <rpc-url> <treasury> <governance> <membership-registry> <levy-ledger> <payee-registry> [from-block]`.
The replay reads the header of each block its logs sit in, for the block's timestamp (project owner's decision on #138, 03-10-2026). A header is neither a contract call nor a storage read. A proposal's state depends on the time it is asked at, so `stateAt` takes a timestamp, no earlier than the last replayed block; the run asks at that block's. Every contract in the run is the real one, wired as in deployment.

The new checks bite, checked on 02-10-2026. Each of four mutations to `scripts/replay.ts` fails exactly one test: dropping quorum's unit half fails the rounding-boundary test; dropping its two-wallet half fails the main replay test; dropping the payee check on a release, or the duplicate-admission check, fails its forged-log test. The script was restored before this output was captured.

The queue and attestation checks bite, checked on 03-10-2026. Each of five mutations to `scripts/replay.ts` fails exactly one test, its own forged-log test: dropping the unknown-proposal check on `ProposalQueued`, the queued-twice check, the work-proposal check on `WorkAttested`, the attested-twice check, or the queued-before-attested check. Each mirrors a refusal in `Governance.queue` or `Governance.attest`: `UnknownProposal`, `AlreadyQueued`, `NotWorkProposal`, `AlreadyAttested`, and `NotQueued` or `NotPassed`. The script was restored before this output was captured.

The FR21 checks and the derived states bite, checked on 03-10-2026 (#138). Each of nine mutations to `scripts/replay.ts` (the condition made false) fails a test. Dropping either half of FR21, for an admission or for a release, fails exactly its own forged-log test, as does dropping the mark a vote in the extension sets. Each FR21 check mirrors a refusal on the way to the operation: `NotQueued` in `Governance.execute`, and `NotReady` or the `TimelockController`'s own readiness check before `eta`. In `stateAt`, dropping the `Failed` or the `Queued` branch fails the main replay test alone; dropping the `Executed` branch fails it and the read interface's state test; dropping quorum's part in the extension fails the read interface's state test alone, the one run that asks while a proposal is `Extended`. The script was restored, and checked byte-identical, before this output was captured.

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

### Issue #57 — Governance: attest, and payment on attestation

| File | What it shows | Reproduce with |
| --- | --- | --- |
| `57-attest-and-payment-tests.txt` | The 11 `GovernanceAttestTest` tests pass alongside the existing suites, 161 passing, with 100% line and statement coverage of `Governance.sol` and `Treasury.sol`. Every contract is the real one. The loop runs end to end: once a passed work proposal's 7 days have elapsed, the firm attests with an evidence hash and `WorkAttested` names the proposal, the firm as attester and the hash; attesting pays nothing by itself; any caller — a stranger, or the vendor in the same block — then executes, and `Treasury` releases the whole limit from the approved fund, emitting `PaymentReleased`, with no owner step and no further wait (FR25, ADR-011). Attestation is refused from any address but the firm, fuzzed over 256 callers; on a proposal still open or failed, with `NotPassed`, so an attestation cannot manufacture an approval (FR26, the guard refusal test B6 exercises); on a passed proposal not yet queued, with `NotQueued`, and at any moment before the 7 days have elapsed, with `NotReady`, fuzzed over 256 moments, because attestation sits after the timelock (behavioural view, R2); on an admission proposal, a second time before or after payment, with a zero evidence hash, or on an unknown proposal, each with a named error of its own | `npm run test:coverage` |

The tests bite, checked on 02-10-2026, one change at a time to `Governance.attest`. Removing the never-passed check fails `test_AttestRefusesProposalStillOpen` and `test_AttestRefusesFailedProposal`: such a proposal is still refused, because it was never scheduled, but with `NotReady`, which no longer says why. Removing the after-the-timelock check fails `testFuzz_AttestRefusesBeforeTheDelayElapses`. Removing the firm-only check fails `testFuzz_AttestRefusesNonFirm`. No other test fails in any of the three. Each change was reverted before this output was captured.

### Issue #66 — Refusal test B6

| File | What it shows | Reproduce with |
| --- | --- | --- |
| `66-refusal-b6-tests.txt` | Refusal test B6 (spec §7), proving that attestation cannot manufacture an approval (FR26): `testFuzz_AttestOnProposalNeverPassedReverts` passes over 256 runs alongside the existing suites, 160 passing, with 100% line and statement coverage of `Governance.sol`. Every contract is the real one. Each run raises a work proposal for an admitted vendor that never passes — nobody votes, a majority votes against, the vote ties, or a majority is for it while the 14-day window is still open — and has the firm attest at a random moment from its creation to 400 days later. Every attestation reverts with `NotPassed(proposalId, state)`, a named error of its own (NFR9), the proposal is not marked attested, and the vendor is paid nothing. The fuzz test replaces the two hand-picked never-passed tests from #57 | `npm run test:coverage` |

The test bites, checked on 02-10-2026. With the never-passed check removed from `Governance.attest`, `testFuzz_AttestOnProposalNeverPassedReverts` fails and no other test does: such a proposal is still refused, because it was never scheduled on the timelock, but with `NotReady`, which no longer names the reason. The check was restored before this output was captured.

### Issue #93 — QAS-11: a false attestation releases payment

**A demonstrated limit, not a defect.** This test is expected to succeed, and its success is the honest statement of what the design cannot do: no contract can verify physical work (QAS-11, `sad.md` §2.3; ADR-011).

| File | What it shows | Reproduce with |
| --- | --- | --- |
| `93-qas11-false-attestation-tests.txt` | `test_FalseAttestationReleasesPaymentAndTheRecordNamesEveryone` passes alongside the existing suites, 161 passing, with 100% line and statement coverage of `Governance.sol` and `Treasury.sol`. Every contract is the real one. A work proposal passes with two owners' votes and waits out the timelock; the vendor does nothing; the firm attests completion anyway, with the hash of a claim that has nothing behind it; any caller executes, and the vendor is paid the whole limit. QAS-11's measure is placed on the record rather than the outcome, so the test reads the event log alone — no storage — and finds the proposal (kind, payee, limit, fund, quote hash and description in `ProposalCreated`), the vote (two `VoteCast` events from bound owners, three units for), the attestation (`WorkAttested` naming the firm as attester and carrying the evidence hash), and exactly one payment (`PaymentReleased` with fund, payee and amount), which comes after the attestation. The system does not prevent a false attestation and does not detect it; it makes one provable once suspected | `npm run test:coverage` |

The test bites, checked on 02-10-2026, one change at a time to the `WorkAttested` event in `Governance.attest`. Emitting it with the zero address as attester, or not emitting it at all, fails this test and #57's `test_AttestThenAnyoneExecutesPaysTheWholeLimit`, and no other test. The event was restored before this output was captured.

### Issue #61 — Refusal test B2

| File | What it shows | Reproduce with |
| --- | --- | --- |
| `61-refusal-b2-tests.txt` | Refusal test B2 (spec §7), proving G2 at proposal time (FR18): `testFuzz_ProposeWorkWithUnapprovedVendorReverts` passes over 256 runs alongside the existing suites, 163 passing, with 100% line and statement coverage of `Governance.sol` and `PayeeRegistry.sol`. Every contract is the real one, and one vendor has already been admitted by an executed owner vote. Each run has the firm propose work for any other address, with any limit and either fund, after that address's own admission has reached a random stage short of execution — never proposed, vote still open, passed but not queued, queued and waiting, or ready but not executed. Every proposal reverts with `PayeeNotRegistered(vendor)`, a named error of its own (NFR9), and no proposal is created: nearly approved is not approved. `test_ProposeWorkAcceptsVendorOnceAdmissionExecutes` is the other half — once the admission has executed, the same proposal is accepted. The hand-picked `test_ProposeWorkRefusesUnregisteredVendor` from #53, on a stub registry, stays as the guard's own test, because the group report cites it | `npm run test:coverage` |

The test bites, checked on 02-10-2026. With the registration check removed from `Governance.propose`, `testFuzz_ProposeWorkWithUnapprovedVendorReverts` fails and no other test does. Without it, the payment path would still be closed by `Treasury.release`'s own check at payment time (B2′, #62): G2 is checked at both ends so that losing one check does not open the path. The check was restored before this output was captured.

### Issue #67 — Refusal test B8

| File | What it shows | Reproduce with |
| --- | --- | --- |
| `67-refusal-b8-tests.txt` | Refusal test B8 (spec §7), proving that eligibility comes from the register, not the interface (FR2): `testFuzz_CastVoteFromUnboundWalletReverts` passes over 256 runs alongside the existing suites, 165 passing, with 100% line and statement coverage of `Governance.sol` and `MembershipRegistry.sol`. Every contract is the real one, with units bound to three owners. Each run has any other wallet vote, either way, at a random moment while the vote is open — the 14-day window or the 7-day extension — and every vote reverts with `NotBoundOwner(caller)`, a named error of its own (NFR9); nothing is counted, neither units nor a voter. `castVote` takes no unit ids from the caller and reads them from the register, so no interface can claim units for a wallet. `test_BoundOwnerVotesWithEveryUnitItHolds` is the other half: a bound owner of two units votes with both. The hand-picked `test_UnboundWalletRefused` from #54, on a stub register, stays as the guard's own test, because the group report cites it | `npm run test:coverage` |

The test bites, checked on 02-10-2026. With the bound-owner check removed from `Governance.castVote`, this test and #54's `test_UnboundWalletRefused` and `test_UnitRebindMovesTheVote` fail, and no other test does: such a wallet is still refused, because it has no units to vote with, but with `AlreadyVoted`, which no longer names the reason. The check was restored before this output was captured.

### Issue #68 — Scenario tests: the loop end to end

| File | What it shows | Reproduce with |
| --- | --- | --- |
| `68-loop-scenario-tests.txt` | The five `LoopScenariosTest` scenarios pass alongside the existing suites, 170 passing, with 100% line and statement coverage of all six contracts. They run in the 40-unit reference building on all six real contracts, wired as they are deployed, with time moved by `vm.warp`. **A full levy cycle** (FR5–FR8): a stranger issues the 40 charges once due, 39 units pay, each receipt is split 80/20 into the operating and long-term maintenance funds, and only the unit that never paid is in arrears after the due date. **A proposal from draft to payment** (FR16–FR22, FR25): the owners admit a roofer, the firm proposes a 5,000 NZD roof repair from the maintenance fund, the owners approve it, and after the window, the timelock and the firm's attestation a stranger executes and the roofer is paid in full. **A rejected proposal**: 10 units against 8 for; the proposal fails, cannot be queued or attested, and a year later nothing has been paid. **A vote from an unbound wallet**: a stranger's vote mid-vote is refused with `NotBoundOwner` and counts for nothing, and the owners' vote carries on and pays. **A single owner after the quorum extension** — expected to succeed, the finding in `sad.md` §2.5: one unit of forty votes alone, quorum is not met, the window extends, quorum is waived, and that one vote passes a payment that is then made | `npm run test:coverage` |

**NFR5, and how far this shows it.** The draft-to-payment scenario takes every step after the second vote as the firm or a stranger — never an owner — and records the event log over those steps: it holds `PaymentReleased` and no `VoteCast` or `LevyPaid`. That shows the loop completes without owner action after the two votes. It is shown by how the scenario is built and by its log, not by a scan of every transaction on a network, which a Solidity test cannot make.

The scenarios bite, checked on 02-10-2026, one change at a time. Letting a proposal with no more units for than against pass fails the rejected-proposal scenario, alongside seven quorum, timelock and B6 tests. Counting a paid charge as arrears fails the levy-cycle scenario, alongside two `LevyLedger` tests. Scheduling a release one wei short of the limit fails the draft-to-payment, unbound-wallet and single-owner scenarios, alongside four #56, #57 and QAS-11 tests. Each change was reverted before this output was captured.

### Issue #70 — QAS-8: the attacker path under a stolen firm key

| File | What it shows | Reproduce with |
| --- | --- | --- |
| `70-qas8-stolen-firm-key-tests.txt` | QAS-8, proving NFR3: `testFuzz_StolenFirmKeyReachesNoNewAddress` passes over 256 runs alongside the existing suites, 172 passing, with 100% line and statement coverage of `Governance.sol`, `Treasury.sol` and `PayeeRegistry.sol`. Every contract is the real one. The attacker holds the firm's key and inherits one vendor the owners admitted and one passed work proposal for it, ready to attest. Each run picks any new address the owners never admitted and tries every path to it: calling `Treasury.release` directly (`UnauthorizedReleaser`), granting itself `RELEASER_ROLE` and scheduling on the timelock directly (`AccessControlUnauthorizedAccount`), admitting the address directly (`UnauthorizedExecutor`), proposing work that pays it (`PayeeNotRegistered`, B2), and proposing its admission, which the key may raise but neither it nor the address can vote on (`NotBoundOwner`, B8), so after the window and the extension it fails and cannot be queued (`NotPassed`) or executed (`NotQueued`). Last, the key attests the inherited work and executes it. Funds reachable at the new address = 0, and it is never registered; the loss is bounded by one approved limit paid to the admitted vendor from the approved fund | `npm run test:coverage` |

The test bites, checked on 03-10-2026, one change at a time. With the executor check removed from `PayeeRegistry.admit`, this test fails, as do three `PayeeRegistry` tests. With `Governance.state` letting a proposal with no votes for it pass, this test fails, as do five `Governance` tests. Both were restored before this output was captured.

### Issue #71 — Gas per owner per levy cycle

| File | What it shows | Reproduce with |
| --- | --- | --- |
| `71-gas-per-cycle.txt` | The gas each step costs, read from the transaction receipts — what the sender pays, base cost included — in the 40-unit reference building, five owners holding 8, 1, 1, 10 and 20 units, on all six real contracts wired as they are deployed. **One levy cycle** costs the building 5,593,708 gas: 1,280,744 to issue all 40 charges in one call, by anyone, and 4,312,964 for the owners' approvals and payments. That is 139,842 per unit, or 1,118,741 per owner on average. An owner pays one approval (about 46,400) and one payment per unit held (101,002, or 142,032 for the first payment into an empty fund), so a one-unit owner pays 147,368 and the 20-unit owner 2,066,418 — cost per owner scales with units held, which is why the table gives both. **One full loop**, admitting a vendor and then paying it for approved work, is 11 calls and 2,110,123 gas: 1,370,826 from the two owners who vote, 337,885 from the firm and 401,412 from whoever queues and executes. A vote costs more the more units it carries — 331,026 for 8 units, 354,387 for 10 — because each unit is checked and flagged. From work proposal to payment takes 21 days, the 14-day window and the 7-day timelock, which the design sets | `npx hardhat run scripts/gas-per-cycle.ts` |
| `71-coverage.txt` | The coverage listing captured alongside the measurement: 170 passing, 100% line and statement coverage of all six contracts | `npm run test:coverage` |

**What this measures, and what it does not.** The figures are gas units, not money, so no money figure is given here. They were measured on Hardhat's in-process network, which is where NFR11 is measured; the Sepolia deployment (#73) is for readability and runs no levy cycle ([ADR-017](https://github.com/nomadwiz/kaitiki-doc/blob/master/doc/design/decisions/adr/017-test-network-for-readability.md), deciding #100). ADR-017 states the assumption under which these figures stand for the test network's, and `73-sepolia-vs-local-gas.txt` tests it in part. `hardhat.config.ts` lists OpenZeppelin's `TimelockController` under `npmFilesToBuild`, so that a script can deploy it unchanged.

### Issue #72 — Minimal read interface

| File | What it shows | Reproduce with |
| --- | --- | --- |
| `72-read-interface-tests.txt` | The five interface tests pass alongside the existing TypeScript suites, 31 passing. They render the page to the same markup the browser receives, from the event log of a building on the real contracts. **NFR10**, by its stated method: for each of four viewers, every row for a unit other than the viewer's own holds exactly one status, `current` or `in arrears`, and no digit beyond the unit's own name; another unit's status carries no amount or date even before rendering. **R4**: a charge paid late is surfaced nowhere, and once alice pays her overdue charge it leaves her page and others'. Fund balances match `Treasury.balanceOf`, and each proposal's state matches `Governance.state` while open, extended and passed. A vote form is offered only while voting is open and one of the viewer's units has not voted. **FR41**: the interface's source holds no key and knows no contract function but `castVote` | `npm run test:mocha` |
| `72-interface-as-alice.png` | **FR8, FR19, FR9.** Alice (units 1 and 2) on the seeded local building. The funds hold NZD 400 operating and NZD 100 maintenance, the NZD 500 paid split 80:20 (FR8). Proposal 2 shows 3 for, counted in units: alice's two and bob's one (FR19). Her own unit 2 is in arrears, with its amount and due date (FR9); unit 3, whose charge was paid late, shows `current`, and unit 4 shows `in arrears` with nothing more. She has voted on proposal 2 with both units, so no vote form is offered | `npx hardhat node`, `npm run demo`, `npm run interface`, then the capture below with `?as=<alice>` |
| `72-interface-as-bob.png` | **R4, NFR10.** Bob (unit 3), who paid late: his own unit shows `current` and no history of the late payment (R4); alice's unit 2 shows `in arrears` and nothing more (NFR10) | as above, `?as=<bob>` |
| `72-interface-as-carol.png` | **FR41, B8.** Carol (unit 4), whose unit has not voted: the vote form on the open proposal, the page's one write (FR41), sent as `castVote` from her wallet, which the contract checks (B8). Her own arrear has its amount and due date, the others are status only | as above, `?as=<carol>` |

The tests bite, checked on 03-10-2026, one change at a time. Rendering a date beside another unit's `in arrears` fails the NFR10 test and no other. Listing paid charges as overdue fails the R4 test and no other. Both were restored before this output was captured.

`npm run demo` casts bob's vote on proposal 2 as well as alice's, so the state above is reproduced from a fresh node. Each screenshot is headless Chrome at the size the conventions above set, with a window height that fits the page:

```
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --hide-scrollbars \
  --window-size=520,1100 --force-device-scale-factor=2 --virtual-time-budget=5000 \
  --screenshot=72-interface-as-alice.png 'http://localhost:5173/?as=<alice>'
```

Any Chrome or Chromium binary takes the same flags. The heights are 1100 for alice, 1075 for bob and 1140 for carol. The local node's accounts 2, 3 and 4 are alice, bob and carol.

#158's set under `week6/` supersedes these three images for the current interface, which was rebuilt after #72; they stay because report §3 still cites them.

### Issue #73 — Deploy to a public test network

**A public test network, not the permissioned national chain the design assumes.** The deployment is for readability ([ADR-017](https://github.com/nomadwiz/kaitiki-doc/blob/master/doc/design/decisions/adr/017-test-network-for-readability.md), deciding #100): it uses the real parameters (spec §5), so the loop is not run here in real time; it is demonstrated on the local network, where time can be advanced.

| File | What it shows | Reproduce with |
| --- | --- | --- |
| `73-deployment-11155111.json` | The seven contracts deployed to Sepolia (chain 11155111) from block 11831859 by one throwaway account, which is also the firm and the land-title adapter: their addresses and each contract's constructor arguments. `scripts/deploy.ts` precomputed every address from the deployer's nonce and checked each one as it landed, then read the wiring back from the chain, and writes this file only when all 23 checks pass — among them the Timelock as the sole `RELEASER_ROLE` member, `LevyLedger` as the sole `DEPOSITOR_ROLE` member and no member of Treasury's `DEFAULT_ADMIN_ROLE`, all checked before any deposit (spec §4, ADR-015). `LevyLedger`'s charge schedule is empty, because the reference building's levy schedule is a gap, recorded on #73, and no value is invented (CLAUDE.md rule 2) | `npx hardhat run scripts/deploy.ts --network sepolia` |
| `73-sepolia-wiring-check.txt` | The deployed wiring read back from Sepolia afterwards by `scripts/check-deployment.ts`, sending nothing: 24 of 24 checks pass. The 24th, added since the deployment, reads Treasury's operating split back against the recorded constructor argument | `npx hardhat run scripts/check-deployment.ts --network sepolia` |
| `73-sepolia-vs-local-gas.txt` | The seven deployment transactions' gas on Sepolia, from their receipts, against the local dry run, contract by contract; the reading is in the file. It supports ADR-017's assumption that NFR11, measured locally, holds on the test network | Sepolia receipts, and `npx hardhat run scripts/deploy.ts` |
| `73-sepolia-verification.txt` | All seven contracts verified on Etherscan, with their source and constructor arguments, so anyone can read the deployed code against this repository | `npx hardhat run scripts/verify.ts --network sepolia` |

The addresses are in `73-deployment-11155111.json`, which `scripts/verify.ts`, `scripts/bind-unit.ts` and `scripts/check-deployment.ts` read; `73-sepolia-verification.txt` links each to its Etherscan page.

That the contracts can be read by anyone is a property of the public test network, not evidence about the national permissioned chain, which is described rather than stood up: FR42 stays designed, not built (`sad.md` §6.2).

## week6

### Issue #150 — every transaction through one path, refusals in plain words

| File | What it shows | Reproduce with |
| --- | --- | --- |
| `150-send-path-tests.txt` | The TypeScript suites pass, 56 passing: ten tests are new for #150 and the FR41 test is rewritten. **FR41**: every function in the interface's ABI (`interface/src/tx.ts`) changes state, none is `view` or `pure`, no other source file names a function, and no source file holds a private key, mnemonic, `new Wallet` or 64-hex string. The ABI carries every custom error the compiled `Treasury`, `Governance`, `MembershipRegistry`, `LevyLedger`, `PayeeRegistry`, `TimelockController` and `MockNZD` declare, checked against their artifacts, so a new error with no counterpart fails the suite. **NFR9, as the viewer reads it**: each of the 23 errors the design names is encoded with `Interface.encodeErrorResult` and decodes to its RefusalNotice message — `NotReady` and `ChargeNotDue` with their date in New Zealand time, `AmountExceedsLimit` with its fourth argument, the cap, not the amount asked for. An error with no message reads "The contract refused this action (FailedCall).", and a wallet rejection has its own sentence. Revert data that cannot be decoded — `0x` from an empty revert, or a selector with its arguments cut short — gives ethers' own message and never throws, so the signing Dialog always closes. A real vote from a wallet with no unit, sent through the interface's ABI, decodes to `NotBoundOwner`'s message. The signing Dialog, success Toast and RefusalNotice render in the design system's markup. **The one path, `send`**, driven by a fake transaction: the Dialog opens while the wallet signs and closes once it has signed, before the block arrives; then the Toast shows, and only then is the log read again. A refusal closes the Dialog and shows the RefusalNotice with the error's name. When the local node signs, which asks nobody, no Dialog opens | `npm run test:mocha` |

### Issue #158 — screenshots of every screen in the new design

| File | What it shows | Reproduce with |
| --- | --- | --- |
| `158-home-as-alice.png` | **FR8, FR19, FR9.** Home as alice (units 1 and 2), the vote on proposal 2 open. The funds hold NZD 400 operating and NZD 100 maintenance (FR8). Proposal 2 shows 3 units for, alice's two and bob's one (FR19). Her own unit 2 is in arrears with its amount and due date (FR9); nothing needs her vote, because both her units have voted | `npm run demo`, then `node scripts/screenshot.mjs evidence/week6/158-home-as-alice.png 'http://localhost:5173/?as=<alice>'` |
| `158-proposal-2-as-carol.png` | **FR41, FR19.** Proposal 2 as carol (unit 4), whose unit has not voted: the seven-step timeline stopped at Open, the tally in units, both quorum tests met, and the vote form, whose two buttons send `castVote` from her own wallet | `npm run demo`, then `node scripts/screenshot.mjs evidence/week6/158-proposal-2-as-carol.png 'http://localhost:5173/?as=<carol>#/proposal/2'` |
| `158-units-as-alice.png` | **FR7, FR9.** Your units as alice: each charge with its own Pay button, including charge 4 for unit 1, scheduled for 5 November 2026 and not yet issued. Anyone may pay a unit's charge and the payment credits the unit, not the payer (FR7) | `npm run demo`, then `node scripts/screenshot.mjs evidence/week6/158-units-as-alice.png 'http://localhost:5173/?as=<alice>#/units'` |
| `158-register-as-bob.png` | **NFR10, FR13, FR15.** Register as bob (unit 3): units 1, 2 and 4 show only `current` or `in arrears`, with no amount or date (NFR10). The approved vendors are listed by name, wallet and company identifier, with the proposal that admitted each (FR13, FR15) | `npm run demo`, then `node scripts/screenshot.mjs evidence/week6/158-register-as-bob.png 'http://localhost:5173/?as=<bob>#/register'` |
| `158-activity-as-bob.png` | **NFR10, FR41.** Activity as bob: every event the contracts recorded, newest first, in plain words. Bob's own charge shows its amount and date; every other owner's charge, payment and unit link reads "another owner's unit", with no amount, date or number | `npm run demo`, then `node scripts/screenshot.mjs evidence/week6/158-activity-as-bob.png 'http://localhost:5173/?as=<bob>#/activity'` |
| `158-firm-as-firm.png` | **FR41.** Firm as the management firm's wallet, which has the forms to propose work and a vendor. It has nothing to confirm yet, and the page says it cannot move money | `npm run demo`, then `node scripts/screenshot.mjs evidence/week6/158-firm-as-firm.png 'http://localhost:5173/?as=<firm>#/firm'` |
| `158-actions-as-carol-passed.png` | **FR6, NFR7, FR22.** Anyone's actions at stage `passed`, as carol (unit 4; any wallet sees the same page). The voting window has closed and proposal 2 is Passed, so Queue is enabled. Charge 4 can be issued too, because the node's clock is past 5 November | `UNTIL=passed npm run demo:loop`, then `node scripts/screenshot.mjs evidence/week6/158-actions-as-carol-passed.png 'http://localhost:5173/?as=<carol>#/actions'` |
| `158-firm-as-firm-ready.png` | **FR21, FR25.** Firm at stage `ready`: proposal 2 is queued and the seven-day timelock delay has passed, so Confirm work is done is enabled and asks for an evidence hash | `UNTIL=ready npm run demo:loop`, then `node scripts/screenshot.mjs evidence/week6/158-firm-as-firm-ready.png 'http://localhost:5173/?as=<firm>#/firm'` |
| `158-actions-as-carol-attested.png` | **FR25, FR22.** Anyone's actions at stage `attested`, as carol: the firm has attested, nothing waits to be queued, and Carry out is enabled for proposal 2 | `UNTIL=attested npm run demo:loop`, then `node scripts/screenshot.mjs evidence/week6/158-actions-as-carol-attested.png 'http://localhost:5173/?as=<carol>#/actions'` |
| `158-proposal-2-as-alice-executed.png` | **FR22, FR25.** Proposal 2 as alice after the loop completes: every step of the timeline is done with its date, Extended is marked not needed because quorum was met, and the vendor is paid | `npm run demo:loop`, then `node scripts/screenshot.mjs evidence/week6/158-proposal-2-as-alice-executed.png 'http://localhost:5173/?as=<alice>#/proposal/2'` |

**Stage sequence.** Start a fresh node, because the clock only moves forward: `npx hardhat node`, `npm run demo`, `npm run interface`, and capture the first six files. Then run one stage at a time and capture after each: `UNTIL=passed npm run demo:loop`, `UNTIL=ready npm run demo:loop`, `UNTIL=attested npm run demo:loop`, and last `npm run demo:loop` with no `UNTIL`. Each run does only the steps still to do, so a plain `npm run demo:loop` after `npm run demo` still runs the whole loop. The viewer addresses are the local node's accounts: 0 is the firm, 2 alice, 3 bob and 4 carol.

**Capture.** Each file is 1440 CSS px wide at a 2× device scale (2880 px), light theme, cut to the page's content, so the heights differ. Headless Chrome takes the operating system's colour scheme, and on a dark-mode machine `--screenshot` produces the dark theme. So `scripts/screenshot.mjs` starts Chrome with `--headless=new --hide-scrollbars`, asks it for light over the DevTools protocol, sets a 1440 px window at 2× scale, loads the page, waits six seconds for the log replay, then sets the window height to the page's lowest element plus 64 px and takes the screenshot. #72 used `--window-size`, `--force-device-scale-factor=2` and `--virtual-time-budget=5000` for the same steps. Set `CHROME` to use another Chrome or Chromium binary. In the commands above, `<alice>`, `<bob>` and `<carol>` are the local node's accounts 2, 3 and 4, and `<firm>` is `firm` in `interface/public/deployment.json`, which is account 0. Run each row's stage command first, in the order the stage sequence gives, and keep the node running between them.

**Printing.** A full 1440 px frame placed at full A4 text width (about 451 pt) prints its 16 px body text at about 5 pt, below the 14 pt rule above. The report therefore places crops of the relevant region, not whole frames. The 2× scale keeps a crop sharp.

### Issue #173 — the management firm collects due levies by direct debit

[ADR-020](https://github.com/nomadwiz/kaitiki-doc/blob/master/doc/design/decisions/adr/020-firm-collects-levies.md) replaces `issueCharges`, which any wallet could call, with `collect`, which only the firm may call. It issues each due charge and takes the amount from the unit's bound wallet when that wallet's approval and balance cover it. Otherwise it takes nothing, and the charge falls into arrears once past due.

| File | What it shows | Reproduce with |
| --- | --- | --- |
| `173-collect-tests.txt` | The Solidity suites pass, 182 passing, with 100% line and statement coverage of all six contracts (`npm run test:coverage`). **B1**: the firm collecting before the due date is refused with `ChargeNotDue`, fuzzed over 256 timestamps. **ADR-020**: any caller but the firm is refused with `NotFirm`, fuzzed over 256 addresses. With an approval and balance, `collect` takes the levy from the unit's bound owner and splits it 80/20 across the two funds (FR7, FR8). Without an approval, or with too little balance, it issues the charge, takes nothing and does not revert, and the unit is in arrears once past due (FR9). After the owner approves, a second collection pays without issuing again, and `payLevy` still clears arrears by hand. A charge already paid by hand is skipped, so it neither reverts the batch nor is taken twice. A charge the firm never collects is never arrears, the gap ADR-020 admits. **Scenario 1** now has 39 of 40 units collected in one call and carol's unit, never approved, in arrears. **Scenario 6, QAS-8 and NFR3**: a stolen firm key collects every levy, the owners top up, and it collects them all again; every receipt sits in the treasury and nothing reaches any new address, fuzzed over 256 addresses | `npm run test:solidity` |
| `173-interface-tests.txt` | The TypeScript suites pass, 99 passing. Anyone's actions lists no levy charge. The Firm workspace lists every unpaid charge with its number and date but no unit or amount (NFR10), and offers one Collect button for the due ones, disabled for every other wallet. `collect`, sent through the interface's own ABI, takes alice's direct-debited levies and leaves carol's owed. Your units offers Set up direct debit for the viewer's unpaid total. Paying one charge by hand leaves the direct debit standing for the rest: Pay approves the standing approval plus the charge, and the standing approval is rebuilt from the token's `Approval` and the ledger's `LevyPaid` events alone, matching the token's own `allowance` at every step (FR41). `ChargeNotDue` and `NotFirm` decode to their plain sentences. The QAS-4 replay rebuilds a charge paid by hand and never collected, one collected late after a failed collection, and one whose collection failed | `npm run test:mocha` |
| `173-gas-per-cycle.txt` | **One levy cycle** costs the building 3,408,006 gas: 3,176,152 for the firm to collect all 40 charges in one call, and 231,854 for the five owners' approvals, about 46,370 each whatever the number of units. Owners no longer send one payment per unit, so a one-unit owner pays 46,366 and the 20-unit owner 46,378, against 147,368 and 2,066,418 in `71-gas-per-cycle.txt`. The firm now pays most of the cycle's gas. The full loop's figures differ from #71's because the contracts have changed since, including [ADR-018](https://github.com/nomadwiz/kaitiki-doc/blob/master/doc/design/decisions/adr/018-payee-name-and-identifier.md)'s vendor names | `npx hardhat run scripts/gas-per-cycle.ts` |

The tests bite, checked on 06-10-2026, one change at a time. With the firm check removed from `collect`, `testFuzz_OnlyTheFirmCollects` fails. With the approval-and-balance check replaced by `true`, six tests fail, `test_FullLevyCycle` among them. With the standing approval ignoring payments, the direct-debit test fails. With the paid-charge skip removed, so a paid charge is collected again, `test_CollectingSkipsAPaidChargeAndCollectsTheRest` and Scenario 6 fail. Each was restored before this output was captured.

**What this changes in earlier rows.** The rows for #58, #60, #71 and #158 keep their dated results. #158's `158-units-as-alice.png`, `158-firm-as-firm.png`, `158-firm-as-firm-ready.png`, `158-actions-as-carol-passed.png` and `158-actions-as-carol-attested.png` show the interface before #173: an Issue card on Anyone's actions, no Collect on the Firm workspace and no Set up direct debit. The Sepolia deployment (#73) predates #173, as ADR-020 says.

### Issue #176 — Owner Home and the workspace shell

The first screen built on shadcn/ui to its Gate 3 mock-up, [`OwnerHome`](https://github.com/nomadwiz/kaitiki-doc/blob/master/doc/asset/mockups/OwnerHome.dc.html) and [`OwnerHomeMobile`](https://github.com/nomadwiz/kaitiki-doc/blob/master/doc/asset/mockups/OwnerHomeMobile.dc.html), and the checkpoint the project owner compares with them before the other screens proceed.

| File | What it shows | Reproduce with |
| --- | --- | --- |
| `176-home-1440.png` | **ADR-021.** Home as carol (unit 4), from 800 px up: the Sidebar with the owner's five items, Home current, and the shortened address beside "Every action is signed in your wallet." Needs your vote lists proposal 2, Open, with its vendor, cap, fund and closing date, and links to it. Your levies says unit 4 is in arrears for charge #3. Both cards have a Rules button. The two funds sit side by side | `npm run demo`, then `node scripts/screenshot.mjs evidence/week6/176-home-1440.png 'http://localhost:5173/?as=<carol>#/'` |
| `176-home-375.png` | The same page at 375 px: the top bar naming the role and address, one column, and the BottomBar with the same five items, Home marked by colour, weight and a bar on its top edge | `npm run demo`, then `node scripts/screenshot.mjs evidence/week6/176-home-375.png 'http://localhost:5173/?as=<carol>#/' 375` |

### Issue #189 — outcomes as Sonner toasts, conditions as shadcn/ui Alerts

Each state beside the [`States`](https://github.com/nomadwiz/kaitiki-doc/blob/master/doc/asset/mockups/States.dc.html) mock-up. A toast is brought about by an action in the page, evaluated over the DevTools protocol (`ACT`). Headless Chrome has no browser wallet, so the wrong-network and signing states are shown with a stand-in EIP-1193 wallet injected before the page loads (`INIT`); the page's own code is unchanged. Capture the wrong-network pair first: the vote uses carol's units.

| File | What it shows | Reproduce with |
| --- | --- | --- |
| `189-wrong-network-1440.png` | **Interface.md §3.** A browser wallet holding carol's address on chain 1, against the deployment on 31337: the warning Alert "Your wallet is on chain 1." with "Switch it to chain 31337 to act." above Home | `npm run demo`, then `INIT="window.ethereum = { request: async ({ method }) => ({ eth_chainId: '0x1', eth_accounts: ['<carol>'] })[method] ?? null, on() {} };" node scripts/screenshot.mjs evidence/week6/189-wrong-network-1440.png 'http://localhost:5173/#/'` |
| `189-wrong-network-375.png` | The same at 375 px, one column under the top bar | The same `INIT`, with `evidence/week6/189-wrong-network-375.png` and a trailing `375` |
| `189-vote-toast-1440.png` | **#150.** Carol presses Vote for on proposal 2; the node signs, and the Sonner toast "Vote recorded", "Unit 4 voted for Proposal #2." shows top centre with a check icon, while the tally reads 4 units for | `ACT="[...document.querySelectorAll('button')].find((b) => b.textContent === 'Vote for').click()" node scripts/screenshot.mjs evidence/week6/189-vote-toast-1440.png 'http://localhost:5173/?as=<carol>#/proposal/2'` |
| `189-vote-toast-375.png` | The same toast across the top of the phone layout | On a fresh `npm run demo` (carol's units have voted once), the same `ACT` with `evidence/week6/189-vote-toast-375.png` and a trailing `375` |
| `189-refusal-1440.png` | **Hard rule 5.** The firm proposes a vendor with no name; `Governance` refuses, and the destructive Alert reads "The vendor was not proposed", "Add the vendor's name before proposing.", and `VendorNameIsEmpty` in caption mono beneath | `ACT="(() => { const i = document.getElementById('v-addr'); i.value = '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc'; i.form.requestSubmit(); })()" node scripts/screenshot.mjs evidence/week6/189-refusal-1440.png 'http://localhost:5173/?as=<firm>#/vendors'` |
| `189-refusal-375.png` | The same Alert at 375 px | The same `ACT`, with `evidence/week6/189-refusal-375.png` and a trailing `375` |
| `189-signing-1440.png` | The signing Dialog over the firm's page: "Confirm in your wallet", "Your wallet is asking you to confirm proposing Stair Paint Ltd as a vendor.", "Waiting for your wallet" and Close, 480 px wide. The stand-in wallet passes every call to the node except `eth_sendTransaction`, which it never answers, so the Dialog stays open | `INIT="window.ethereum = { request: async ({ method, params }) => method === 'eth_sendTransaction' ? new Promise(() => {}) : method === 'eth_accounts' ? ['<firm>'] : fetch('http://localhost:8545', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: params ?? [] }) }).then((r) => r.json()).then((j) => j.result), on() {} };" ACT="(() => { document.getElementById('v-name').value = 'Stair Paint Ltd'; document.getElementById('v-co').value = 'NZBN 9'; const i = document.getElementById('v-addr'); i.value = '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc'; i.form.requestSubmit(); })()" AFTER=3000 node scripts/screenshot.mjs evidence/week6/189-signing-1440.png 'http://localhost:5173/#/vendors'` |
| `189-signing-375.png` | The same Dialog at 375 px | The same `INIT` and `ACT`, with `evidence/week6/189-signing-375.png` and a trailing `375` |
| `189-elsewhere-toast-1440.png` | **ADR-021.** Carol on Home follows a link to `#/collect`, the firm's route; Home stays open and the toast "That page belongs to another workspace. Kaitiaki opened your Home instead." shows, with no Alert in the page | `ACT="location.hash = '#/collect'" node scripts/screenshot.mjs evidence/week6/189-elsewhere-toast-1440.png 'http://localhost:5173/?as=<carol>#/'` |
| `189-elsewhere-toast-375.png` | The same toast at 375 px | The same `ACT`, with `evidence/week6/189-elsewhere-toast-375.png` and a trailing `375` |

### Issue #177 — Proposals, in both workspaces

Proposals beside its mock-ups, [`Proposals`](https://github.com/nomadwiz/kaitiki-doc/blob/master/doc/asset/mockups/Proposals.dc.html), [`ProposalsMobile`](https://github.com/nomadwiz/kaitiki-doc/blob/master/doc/asset/mockups/ProposalsMobile.dc.html), [`FirmProposals`](https://github.com/nomadwiz/kaitiki-doc/blob/master/doc/asset/mockups/FirmProposals.dc.html) and [`FirmProposalsMobile`](https://github.com/nomadwiz/kaitiki-doc/blob/master/doc/asset/mockups/FirmProposalsMobile.dc.html). The first four are at the seeded stage (`npm run demo`); the last two after `UNTIL=passed npm run demo:loop`. Queue and Carry out (#156) stay below the tabs until #178 moves them onto the Proposal screen.

| File | What it shows | Reproduce with |
| --- | --- | --- |
| `177-proposals-owner-1440.png` | **FR19.** Proposals as carol (unit 4): the Tabs Voting 1, Waiting to pay 0, Closed 1, Voting selected. Proposal 2's card: Open and Work, Roof repair, Harbour Lifts Ltd, Up to NZD 400.00, Operating, its closing date, the QuorumMeter's two conditions (units voted against 25% of the building, different owners against 2), each with its count and StatusBadge, and "Unit 4 has not voted." The whole card links to proposal 2 | `npm run demo`, then `node scripts/screenshot.mjs evidence/week6/177-proposals-owner-1440.png 'http://localhost:5173/?as=<carol>#/proposals'` |
| `177-proposals-owner-375.png` | The same at 375 px: one column, the third tab wrapping to a second row inside the segmented group, the BottomBar | The same, with `evidence/week6/177-proposals-owner-375.png` and a trailing `375` |
| `177-proposals-firm-1440.png` | **ADR-021.** Proposals as the firm: Propose work and Propose a vendor beside the heading, linking to `#/propose` and `#/vendors`; the card's action reads View, and no line about votes | `node scripts/screenshot.mjs evidence/week6/177-proposals-firm-1440.png 'http://localhost:5173/?as=<firm>#/proposals'` |
| `177-proposals-firm-375.png` | The same at 375 px, the two buttons stacked under the heading | The same, with `evidence/week6/177-proposals-firm-375.png` and a trailing `375` |
| `177-proposals-waiting-passed-1440.png` | After the voting window: the Waiting to pay tab, selected over the DevTools protocol, holds proposal 2, Passed, with "Voting closed" and its date; Voting 0 | `UNTIL=passed npm run demo:loop`, then `ACT='document.querySelector("[id$=trigger-waiting]").dispatchEvent(new MouseEvent("mousedown",{bubbles:true}))' node scripts/screenshot.mjs evidence/week6/177-proposals-waiting-passed-1440.png 'http://localhost:5173/?as=<carol>#/proposals'` |
| `177-proposals-waiting-passed-375.png` | The same tab at 375 px | The same `ACT`, with `evidence/week6/177-proposals-waiting-passed-375.png` and a trailing `375` |

### Issue #178 — Proposal, in both workspaces

The Proposal screen beside its mock-ups, [`Proposal`](https://github.com/nomadwiz/kaitiki-doc/blob/master/doc/asset/mockups/Proposal.dc.html), [`ProposalMobile`](https://github.com/nomadwiz/kaitiki-doc/blob/master/doc/asset/mockups/ProposalMobile.dc.html), [`FirmProposal`](https://github.com/nomadwiz/kaitiki-doc/blob/master/doc/asset/mockups/FirmProposal.dc.html) and [`FirmProposalMobile`](https://github.com/nomadwiz/kaitiki-doc/blob/master/doc/asset/mockups/FirmProposalMobile.dc.html). The owner's pair is at the seeded stage (`npm run demo`), the firm's after `UNTIL=ready npm run demo:loop`, and the Carry out pair after `UNTIL=attested npm run demo:loop`. Queue and Carry out moved here from Proposals.

| File | What it shows | Reproduce with |
| --- | --- | --- |
| `178-proposal-owner-1440.png` | **FR19–FR21, NFR9.** Proposal 2 as carol (unit 4), Open: the Breadcrumb back to Proposals; Open, Work and Operating badges; the LifecycleTimeline horizontal, Proposed done, Open current with its closing date, no Extended step; What owners are voting on, with Harbour Lifts Ltd, its address and Copy, DEMO-0001, the cap, the fund, the quote hash and Copy, and the proposal date; Votes with the quorum badge, Rules, both QuorumMeter conditions and the tally in units; Your vote, "Unit 4 has not voted.", Vote for and Vote against, "Signed in your wallet."; After voting closes, naming the date Queue for payment appears | `npm run demo`, then `node scripts/screenshot.mjs evidence/week6/178-proposal-owner-1440.png 'http://localhost:5173/?as=<carol>#/proposal/2'` |
| `178-proposal-owner-375.png` | The same at 375 px: the timeline vertical, one column, the BottomBar | The same, with `evidence/week6/178-proposal-owner-375.png` and a trailing `375` |
| `178-proposal-firm-1440.png` | **FR25, ADR-021.** Proposal 2 as the firm, Queued with the 7-day wait over: Firm confirms work current from the wait's end; Confirm the work, "The 7-day wait ended on …", Rules, the evidence hash field, Confirm work and "Signed in your wallet."; Then carry out the payment with the payee, cap and fund, and no button before the work is confirmed; no vote | `UNTIL=ready npm run demo:loop`, then `node scripts/screenshot.mjs evidence/week6/178-proposal-firm-1440.png 'http://localhost:5173/?as=<firm>#/proposal/2'` |
| `178-proposal-firm-375.png` | The same at 375 px | The same, with `evidence/week6/178-proposal-firm-375.png` and a trailing `375` |
| `178-proposal-carry-out-1440.png` | **FR22, NFR7.** Proposal 2 as carol once the firm has confirmed the work: Executed current, "Now"; Carry out the payment with Carry out payment and "Signed in your wallet.", offered to an owner | `UNTIL=attested npm run demo:loop`, then `node scripts/screenshot.mjs evidence/week6/178-proposal-carry-out-1440.png 'http://localhost:5173/?as=<carol>#/proposal/2'` |
| `178-proposal-carry-out-375.png` | The same at 375 px | The same, with `evidence/week6/178-proposal-carry-out-375.png` and a trailing `375` |

### Issue #179 — Your units

The owner's Your units screen beside its mock-ups, [`YourUnits`](https://github.com/nomadwiz/kaitiki-doc/blob/master/doc/asset/mockups/YourUnits.dc.html) and [`YourUnitsMobile`](https://github.com/nomadwiz/kaitiki-doc/blob/master/doc/asset/mockups/YourUnitsMobile.dc.html), and Home's Your levies beside [`OwnerHome`](https://github.com/nomadwiz/kaitiki-doc/blob/master/doc/asset/mockups/OwnerHome.dc.html). All three are as alice (units 1 and 2) at the seeded stage.

| File | What it shows | Reproduce with |
| --- | --- | --- |
| `179-units-1440.png` | **UC1, FR5, ADR-020, information view R4.** Your units as alice: the Direct debit card, with Rules, the scheduled total of her unpaid charges (NZD 500.00), the approval the levy ledger holds (NZD 0.00) and her wallet balance (NZD 250.00), the last two rebuilt from MockNZD's `Approval`, `Transfer` and the ledger's `LevyPaid`; Approve NZD 500.00 and "Signed in your wallet.". Unit 1, current: charge #4 Scheduled, Pay early. Unit 2, in arrears: an Alert that charge #1 was not covered when the firm collected it, and its row in arrears with Pay now. Charge #0, paid before it was due, is not listed | `npm run demo`, then `node scripts/screenshot.mjs evidence/week6/179-units-1440.png 'http://localhost:5173/?as=<alice>#/units'` |
| `179-units-375.png` | The same at 375 px: one column, the three figures stacked, each charge Table scrolling inside its card, the BottomBar | The same, with `evidence/week6/179-units-375.png` and a trailing `375` |
| `179-home-1440.png` | **ADR-020.** Home as alice: Your levies gains "Direct debit approved for" and "Wallet balance" from the same replay, above Next charge | `npm run demo`, then `node scripts/screenshot.mjs evidence/week6/179-home-1440.png 'http://localhost:5173/?as=<alice>#/'` |

### Issue #180 — Building

The owner's Building screen beside its mock-ups, [`Building`](https://github.com/nomadwiz/kaitiki-doc/blob/master/doc/asset/mockups/Building.dc.html) and [`BuildingMobile`](https://github.com/nomadwiz/kaitiki-doc/blob/master/doc/asset/mockups/BuildingMobile.dc.html), as bob (unit 3) and as alice (units 1 and 2) at the seeded stage. It replaces the old Register.

| File | What it shows | Reproduce with |
| --- | --- | --- |
| `180-building-bob-1440.png` | **NFR10, information view R4, FR8, FR40, FR13, FR15, ADR-005.** Building as bob: two FundCards side by side, Operating NZD 400.00 and Long-term maintenance NZD 100.00, each with its marker, its colour on the top edge and "Queued to pay, at most NZD 0.00" (FR8, FR40). Below them, What the contract guarantees, four lines and Rules. Other units: the disclosure line in an Alert, then units 1, 2 and 4 as `Unit N` and one word, `current` or `in arrears`, with no amount or date (NFR10), and "Unit 3 is on Your units". Approved vendors: Harbour Lifts Ltd, DEMO-0001, admitted by proposal #1, its shortened address and Copy, and Rules (FR13, FR15) | `npm run demo`, then `node scripts/screenshot.mjs evidence/week6/180-building-bob-1440.png 'http://localhost:5173/?as=<bob>#/building'` |
| `180-building-bob-375.png` | The same at 375 px: one column, the two FundCards stacked, the register in two columns, the BottomBar | The same, with `evidence/week6/180-building-bob-375.png` and a trailing `375` |
| `180-building-alice-1440.png` | **NFR10.** Building as alice: units 3 and 4 only, unit 4 in arrears, and "Units 1 and 2 are on Your units" | `npm run demo`, then `node scripts/screenshot.mjs evidence/week6/180-building-alice-1440.png 'http://localhost:5173/?as=<alice>#/building'` |
| `180-building-alice-375.png` | The same at 375 px | The same, with `evidence/week6/180-building-alice-375.png` and a trailing `375` |

### Issue #181 — Activity, in both workspaces

Activity beside its mock-ups, [`Activity`](https://github.com/nomadwiz/kaitiki-doc/blob/master/doc/asset/mockups/Activity.dc.html), [`ActivityMobile`](https://github.com/nomadwiz/kaitiki-doc/blob/master/doc/asset/mockups/ActivityMobile.dc.html), [`FirmActivity`](https://github.com/nomadwiz/kaitiki-doc/blob/master/doc/asset/mockups/FirmActivity.dc.html) and [`FirmActivityMobile`](https://github.com/nomadwiz/kaitiki-doc/blob/master/doc/asset/mockups/FirmActivityMobile.dc.html), as bob (unit 3) and as the firm, after the whole loop has run, when the log fills four pages of ten.

| File | What it shows | Reproduce with |
| --- | --- | --- |
| `181-activity-owner-1440.png` | **FR40, FR41.** Activity as bob, page 1: no subtitle, Rules beside the title, then the ten newest events, each with its date, its sentence and its event name in mono, newest first from the payment of proposal 2. shadcn/ui's Pagination below: Previous disabled, page 1 current, pages 2 to 4, Next | `npm run demo`, `npm run demo:loop`, then `node scripts/screenshot.mjs evidence/week6/181-activity-owner-1440.png 'http://localhost:5173/?as=<bob>#/activity'` |
| `181-activity-owner-375.png` | The same at 375 px: each row stacked as date, sentence and event name, the Pagination wrapping Next to a second line, the BottomBar | The same, with `evidence/week6/181-activity-owner-375.png` and a trailing `375` |
| `181-activity-owner-page2-1440.png` | **NFR10.** Page 2 as bob, page 2 current and Previous enabled: bob's own levy events name his unit, charge and amount ("The firm asked for payment of Charge #2 for your Unit 3: NZD 250.00, due 7 Oct 2026."); another owner's name none ("The firm asked for payment of a levy charge for another owner's unit.", "A levy was paid for another owner's unit.") | The same as the first row, with `ACT="[...document.querySelectorAll('nav[aria-label=\"Pages\"] a')].find(a => a.textContent === '2').click()"` before the command and `evidence/week6/181-activity-owner-page2-1440.png` |
| `181-activity-firm-1440.png` | **FR40, FR41, ADR-021.** Activity as the firm, page 1: the firm's Sidebar, Activity current, and the same ten newest events | `npm run demo`, `npm run demo:loop`, then `node scripts/screenshot.mjs evidence/week6/181-activity-firm-1440.png 'http://localhost:5173/?as=<firm>#/activity'` |
| `181-activity-firm-375.png` | The same at 375 px | The same, with `evidence/week6/181-activity-firm-375.png` and a trailing `375` |
| `181-activity-firm-page2-1440.png` | **NFR10.** Page 2 as the firm: every levy event names its charge and never a unit or an amount ("Charge #2 was paid.", "The firm asked for payment of Charge #3.") | As the owner's page 2, with `?as=<firm>` and `evidence/week6/181-activity-firm-page2-1440.png` |

### Issue #182 — Firm Home

The firm's Home beside its mock-ups, [`FirmHome`](https://github.com/nomadwiz/kaitiki-doc/blob/master/doc/asset/mockups/FirmHome.dc.html) and [`FirmHomeMobile`](https://github.com/nomadwiz/kaitiki-doc/blob/master/doc/asset/mockups/FirmHomeMobile.dc.html), as the firm, at the seeded stage and then as proposal 2 moves on. The clock only moves forward, so capture the rows in order.

| File | What it shows | Reproduce with |
| --- | --- | --- |
| `182-firm-home-1440.png` | **NFR10, ADR-021.** Firm Home at the seeded stage: no subtitle. Levies to collect counts two due charges and dates the oldest, with no unit and no amount, and links to Collect levies. Work to confirm and Ready to carry out are empty, the second with Rules. Your proposals in voting lists proposal 2, Open, with both quorum conditions and its closing date, and links to Propose work | `npm run demo`, then `node scripts/screenshot.mjs evidence/week6/182-firm-home-1440.png 'http://localhost:5173/?as=<firm>#/'` |
| `182-firm-home-375.png` | The same at 375 px: one column, the table scrolling inside its card, the BottomBar | The same, with `evidence/week6/182-firm-home-375.png` and a trailing `375` |
| `182-firm-home-ready-1440.png` | **UC6.** Proposal 2 queued and its wait over: Work to confirm lists it with its vendor and "Wait ended", and the row, linking to the proposal, reads Confirm work. Nothing is in voting | `UNTIL=ready npm run demo:loop`, then `node scripts/screenshot.mjs evidence/week6/182-firm-home-ready-1440.png 'http://localhost:5173/?as=<firm>#/'` |
| `182-firm-home-ready-375.png` | The same at 375 px | The same, with `evidence/week6/182-firm-home-ready-375.png` and a trailing `375` |
| `182-firm-home-attested-1440.png` | **UC6.** The work confirmed: Ready to carry out lists proposal 2 with "Work confirmed", its cap and Carry out; Work to confirm is empty | `UNTIL=attested npm run demo:loop`, then `node scripts/screenshot.mjs evidence/week6/182-firm-home-attested-1440.png 'http://localhost:5173/?as=<firm>#/'` |

### Issue #183 — Propose work

The firm's Propose work beside its mock-ups, [`ProposeWork`](https://github.com/nomadwiz/kaitiki-doc/blob/master/doc/asset/mockups/ProposeWork.dc.html) and [`ProposeWorkMobile`](https://github.com/nomadwiz/kaitiki-doc/blob/master/doc/asset/mockups/ProposeWorkMobile.dc.html), as the firm at the seeded stage. The last row proposes work, so capture it last.

| File | What it shows | Reproduce with |
| --- | --- | --- |
| `183-propose-1440.png` | **UC3, FR17, ADR-021.** The empty form, reached from Proposals, which stays current: a Breadcrumb back to Proposals, the title with Rules, and no subtitle. What the work is; Vendor, a Select of the approved vendors by name and company identifier; Limit; Paid from, Operating or Long-term maintenance, each with its fund marker; Quote hash. Propose beside "Signed in your wallet." No helper text under any field | `npm run demo`, then `node scripts/screenshot.mjs evidence/week6/183-propose-1440.png 'http://localhost:5173/?as=<firm>#/propose'` |
| `183-propose-375.png` | The same at 375 px: one column, Limit above Paid from, the BottomBar with Proposals current | The same, with `evidence/week6/183-propose-375.png` and a trailing `375` |
| `183-propose-hint-1440.png` | **FR17.** A malformed quote hash is caught before anything is sent: the field is marked invalid and its hint reads "A hash is 0x followed by 64 hexadecimal digits." The limit, written "NZD 48,000.00", passes | `ACT="(() => { document.getElementById('desc').value = 'Replace lift motor'; document.getElementById('limit').value = 'NZD 48,000.00'; const i = document.getElementById('quote'); i.value = '0x1234'; i.form.requestSubmit(); })()" node scripts/screenshot.mjs evidence/week6/183-propose-hint-1440.png 'http://localhost:5173/?as=<firm>#/propose'` |
| `183-propose-toast-1440.png` | **FR17.** The firm proposes "Replace lift motor" from Long-term maintenance; the node signs, the toast reads "Work proposed", "“Replace lift motor” is proposed for owners to vote on.", and the form is emptied once the proposal is mined | `ACT="(() => { document.getElementById('desc').value = 'Replace lift motor'; document.getElementById('limit').value = 'NZD 48,000.00'; document.getElementById('fund-1').click(); const i = document.getElementById('quote'); i.value = '0x' + 'ab'.repeat(32); setTimeout(() => i.form.requestSubmit(), 100); })()" AFTER=2500 node scripts/screenshot.mjs evidence/week6/183-propose-toast-1440.png 'http://localhost:5173/?as=<firm>#/propose'` |

### Issue #184 — Collect levies

The firm's Collect levies beside its mock-ups, [`CollectLevies`](https://github.com/nomadwiz/kaitiki-doc/blob/master/doc/asset/mockups/CollectLevies.dc.html) and [`CollectLeviesMobile`](https://github.com/nomadwiz/kaitiki-doc/blob/master/doc/asset/mockups/CollectLeviesMobile.dc.html), as the firm at the seeded stage. The last row collects, so capture it last.

| File | What it shows | Reproduce with |
| --- | --- | --- |
| `184-collect-1440.png` | **ADR-020, NFR10, ADR-021.** Due now, emphasised, "2 charges", with Rules: a Table of charges #1 and #3 by number, due date and when issued ("7 Oct 2026, not covered"), every box ticked, and no unit or amount. Collect 2 charges, the card's 52 px action, beside "Signed in your wallet." Coming due: "1 charge falls due on 6 Nov 2026." No subtitle, and no Last collection card | `npm run demo`, then `node scripts/screenshot.mjs evidence/week6/184-collect-1440.png 'http://localhost:5173/?as=<firm>#/collect'` |
| `184-collect-375.png` | The same at 375 px: one column, the Table scrolling inside its card, Signed in your wallet. under Collect, and the BottomBar with Collect levies current | The same, with `evidence/week6/184-collect-375.png` and a trailing `375` |
| `184-collect-rules-1440.png` | The Rules popover open on Due now, with the six collection rules, among them "A retry that is still not covered leaves no record." | `ACT="[...document.querySelectorAll('button')].find((b) => b.textContent === 'Rules').click()" AFTER=800 node scripts/screenshot.mjs evidence/week6/184-collect-rules-1440.png 'http://localhost:5173/?as=<firm>#/collect'` |
| `184-collect-toast-1440.png` | **ADR-020.** The firm collects both charges again; neither wallet covers them, and the toast reads "Levies collected", "0 collected, 2 not covered.", counted from the call's own receipt. The page is unchanged, because a retry still not covered emits no event (`interface.md` §4) | `ACT="[...document.querySelectorAll('button')].find((b) => b.textContent === 'Collect 2 charges').click()" AFTER=3000 node scripts/screenshot.mjs evidence/week6/184-collect-toast-1440.png 'http://localhost:5173/?as=<firm>#/collect'` |

### Issue #185 — Vendors

The firm's Vendors beside its mock-ups, [`Vendors`](https://github.com/nomadwiz/kaitiki-doc/blob/master/doc/asset/mockups/Vendors.dc.html) and [`VendorsMobile`](https://github.com/nomadwiz/kaitiki-doc/blob/master/doc/asset/mockups/VendorsMobile.dc.html), as the firm at the seeded stage.

| File | What it shows | Reproduce with |
| --- | --- | --- |
| `185-vendors-1440.png` | **FR12, FR15, FR16, ADR-018, ADR-021.** Approved vendors, "1 vendor", with Rules: Harbour Lifts Ltd by name, then "DEMO-0001, admitted 28 Oct 2026 by proposal #1", then the shortened address with Copy. Propose a vendor, emphasised, with Rules: Name, Company identifier, Wallet address, and Propose vendor above "Signed in your wallet." No subtitle | `npm run demo`, then `node scripts/screenshot.mjs evidence/week6/185-vendors-1440.png 'http://localhost:5173/?as=<firm>#/vendors'` |
| `185-vendors-375.png` | The same at 375 px: one column, the address and Copy under the vendor's lines, and the BottomBar with Vendors current | The same, with `evidence/week6/185-vendors-375.png` and a trailing `375` |
| `185-vendors-hint-1440.png` | **FR16.** A malformed wallet address is caught before anything is sent: the field is marked invalid and its hint reads "A wallet address is 0x followed by 40 hexadecimal digits." | `ACT="(() => { document.getElementById('v-name').value = 'Stair Paint Ltd'; document.getElementById('v-co').value = 'NZBN 9'; const i = document.getElementById('v-addr'); i.value = '0x123'; i.form.requestSubmit(); })()" AFTER=800 node scripts/screenshot.mjs evidence/week6/185-vendors-hint-1440.png 'http://localhost:5173/?as=<firm>#/vendors'` |
