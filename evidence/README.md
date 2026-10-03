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
| `69-qas4-replay.txt` | The 18 `QAS-4 replay` tests pass. `scripts/replay.ts` is handed only a provider it may ask for `eth_getLogs`, so it makes no contract call and no storage read. It decodes every event the replayed contracts emit, Treasury's `RoleGranted` and `RoleRevoked` included, and refuses any log from those addresses it cannot decode. From the log alone it derives both fund balances, which equal `Treasury.balanceOf` exactly for each fund while a direct token transfer of 500 sits in Treasury uncredited; the holders of each Treasury role, so `RELEASER_ROLE` is held by the `TimelockController` alone, `DEPOSITOR_ROLE` by the LevyLedger alone and `DEFAULT_ADMIN_ROLE` by nobody (rule 1, QAS-8); the amount released per proposal, here a work proposal's whole limit, paid once it was queued, attested and executed through the real `TimelockController`; each proposal's tally, keyed on the unit ids in `VoteCast` and equal to `Governance.tallyOf`, including a wallet that votes twice with different units; whether each proposal reached quorum, from the principal units in `ProposalCreated` and the units and distinct wallets in `VoteCast`, equal to `Governance.quorumReached` for a proposal that reached it, one that missed the two-wallet minimum and one nobody voted on; the unit-to-wallet bindings from `UnitBound`, equal to `MembershipRegistry`; the payee register from `PayeeAdmitted`, with the proposal that admitted each payee, equal to `PayeeRegistry.isRegistered`; which proposals are queued, with the `eta` from `ProposalQueued`, equal to the queue block's timestamp plus `Governance.TIMELOCK_DELAY`, and queued exactly when `Governance.state` is `Queued` or `Executed`; which proposals are attested, with the attester and evidence hash from `WorkAttested`, equal to `Governance.attested`; the arrears flag (#58); and every transition in order. A forged log shows quorum's unit half at its rounding boundary: two units voted reach quorum against 8 principal units and miss it against 9. Sixteen forged logs are refused: a vote for a unit no `UnitBound` gave the voter, a unit counted twice, a weight that is not the number of units, a vote on a proposal never created, a payee admitted twice, a release to a payee never admitted, a release on an admission proposal, the three forged levy logs from #58, a proposal queued that was never created, a proposal queued twice, an attestation on an admission proposal, an attestation on a proposal never queued, a proposal attested twice, and an undecodable log (FR40, NFR2) | `npm run test:mocha` |

The in-process network stands in for a node run by a party independent of the
operator and the firm — an insurer, a lender or an audit firm
(`deployment-view.md` §2.1). The same script runs against any JSON-RPC
endpoint: `node scripts/replay.ts <rpc-url> <treasury> <governance> <membership-registry> <levy-ledger> <payee-registry> [from-block]`.
A proposal's outcome before it is queued is not derived: `Governance.state` depends on block timestamps, which `eth_getLogs` does not return. A queued proposal is a passed one, and `ProposalQueued` puts it in the log. For the same reason the replay does not check that an attestation or a release came at or after its proposal's `eta`. In the run, a signer stands in for the `TimelockController` as `PayeeRegistry`'s admitter, so the vendor is admitted without a 21-day admission vote.

The new checks bite, checked on 02-10-2026. Each of four mutations to `scripts/replay.ts` fails exactly one test: dropping quorum's unit half fails the rounding-boundary test; dropping its two-wallet half fails the main replay test; dropping the payee check on a release, or the duplicate-admission check, fails its forged-log test. The script was restored before this output was captured.

The queue and attestation checks bite, checked on 03-10-2026. Each of five mutations to `scripts/replay.ts` fails exactly one test, its own forged-log test: dropping the unknown-proposal check on `ProposalQueued`, the queued-twice check, the work-proposal check on `WorkAttested`, the attested-twice check, or the queued-before-attested check. Each mirrors a refusal in `Governance.queue` or `Governance.attest`: `UnknownProposal`, `AlreadyQueued`, `NotWorkProposal`, `AlreadyAttested`, and `NotQueued` or `NotPassed`. The script was restored before this output was captured.

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

**What this measures, and what it does not.** The figures are gas units, not money: for a pinned compiler and the same inputs they are the same on any network, and only the price per unit differs, so no money figure is given here. They were measured on Hardhat's in-process network. NFR11 asks for the measurement on the test network, which needs the Sepolia deployment (#73); there, the levy and voting steps can be run again for real, but queueing and execution wait for the real 14-day window and 7-day timelock, which only a local network can skip. `hardhat.config.ts` lists OpenZeppelin's `TimelockController` under `npmFilesToBuild`, so that a script can deploy it unchanged.

### Issue #72 — Minimal read interface

| File | What it shows | Reproduce with |
| --- | --- | --- |
| `72-read-interface-tests.txt` | The five interface tests pass alongside the existing TypeScript suites, 31 passing. They render the page to the same markup the browser receives, from the event log of a building on the real contracts. **NFR10**, by its stated method: for each of four viewers, every row for a unit other than the viewer's own holds exactly one status, `current` or `in arrears`, and no digit beyond the unit's own name; another unit's status carries no amount or date even before rendering. **R4**: a charge paid late is surfaced nowhere, and once alice pays her overdue charge it leaves her page and others'. Fund balances match `Treasury.balanceOf`, and each proposal's state matches `Governance.state` while open, extended and passed. A vote form is offered only while voting is open and one of the viewer's units has not voted. **FR41**: the interface's source holds no key and knows no contract function but `castVote` | `npm run test:mocha` |
| `72-interface-as-alice.png` | Alice (units 1 and 2) on the seeded local building. Her own unit 2 is in arrears, with its amount and due date; unit 3, whose charge was paid late, shows `current`, and unit 4 shows `in arrears` with nothing more. She has voted on proposal 2 with both units, so no vote form is offered | `npx hardhat node`, `npm run demo`, `npm run interface`, open `?as=<alice>` |
| `72-interface-as-bob.png` | Bob (unit 3), who paid late: his own unit shows `current` and no history of the late payment | as above, `?as=<bob>` |
| `72-interface-as-carol.png` | Carol (unit 4): her own arrear with its amount and due date, the others as status only, and the vote form on the open proposal | as above, `?as=<carol>` |

The tests bite, checked on 03-10-2026, one change at a time. Rendering a date beside another unit's `in arrears` fails the NFR10 test and no other. Listing paid charges as overdue fails the R4 test and no other. Both were restored before this output was captured.

The seeded building's proposal 2 also received one vote from bob, cast through the same `castVote` call the form makes and signed by the local node, before the screenshots were taken.

### Issue #73 — Deploy to a public test network

**A public test network, not the permissioned national chain the design assumes.** The deployment is for readability ([ADR-017](https://github.com/nomadwiz/kaitiki-doc/blob/master/doc/design/decisions/adr/017-test-network-for-readability.md), deciding #100): it uses the real parameters (spec §5), so the loop is not run here in real time; it is demonstrated on the local network, where time can be advanced.

| File | What it shows | Reproduce with |
| --- | --- | --- |
| `73-deployment-11155111.json` | The seven contracts deployed to Sepolia (chain 11155111) from block 11831859 by one throwaway account, which is also the firm and the land-title adapter: their addresses and each contract's constructor arguments. `scripts/deploy.ts` precomputed every address from the deployer's nonce and checked each one as it landed, then read the wiring back from the chain, and writes this file only when all 23 checks pass — among them the Timelock as the sole `RELEASER_ROLE` member, `LevyLedger` as the sole `DEPOSITOR_ROLE` member and no member of Treasury's `DEFAULT_ADMIN_ROLE`, all checked before any deposit (spec §4, ADR-015). `LevyLedger`'s charge schedule is empty, because the reference building's levy schedule is a gap, recorded on #73, and no value is invented (CLAUDE.md rule 2) | `npx hardhat run scripts/deploy.ts --network sepolia` |
| `73-sepolia-wiring-check.txt` | The deployed wiring read back from Sepolia afterwards by `scripts/check-deployment.ts`, sending nothing: 24 of 24 checks pass. The 24th, added since the deployment, reads Treasury's operating split back against the recorded constructor argument | `npx hardhat run scripts/check-deployment.ts --network sepolia` |
| `73-sepolia-vs-local-gas.txt` | The seven deployment transactions' gas on Sepolia, read from their receipts, against the local dry run: 6,279,779 against 6,279,827. MockNZD, which takes no argument, is identical; every other difference is a multiple of 12 gas, a zero against a non-zero calldata byte in the addresses passed. So the two networks charge the same execution gas for these contracts, which is what lets NFR11 be measured locally (ADR-017) | Sepolia receipts, and `npx hardhat run scripts/deploy.ts` |
| `73-sepolia-verification.txt` | All seven contracts verified on Etherscan, with their source and constructor arguments, so anyone can read the deployed code against this repository | `npx hardhat run scripts/verify.ts --network sepolia` |

The addresses are in `73-deployment-11155111.json`, which `scripts/verify.ts`, `scripts/bind-unit.ts` and `scripts/check-deployment.ts` read; `73-sepolia-verification.txt` links each to its Etherscan page.

That the contracts can be read by anyone is a property of the public test network, not evidence about the national permissioned chain, which is described rather than stood up: FR42 stays designed, not built (`sad.md` §6.2).
