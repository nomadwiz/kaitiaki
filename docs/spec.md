# Build specification

Everything needed to build the prototype correctly, in one file. It is a
condensed extract of [`sad.md`](sad.md), the architecture description; where the
two disagree, `sad.md` is right and this file needs correcting.

Identifiers (`FR`, `NFR`, `G`, `B`, `UC`) are the ones the report cites. Keep
them.

---

## 1. What the system is

A unit title development — an apartment building — is governed by a body
corporate: every owner, collectively. It levies owners for shared costs and
decides by resolution. Day-to-day administration is delegated to a management
firm, and in the current arrangement an elected committee sits between the owners
and the money.

This design removes the committee. The firm proposes work and administers it,
the owners vote on everything, and nothing sits in between. Money moves along one
path: the firm proposes work naming a vendor and a spending cap; owners vote; the
proposal waits out a timelock; the vendor does the work; the firm attests it is
complete; that attestation releases payment.

## 2. The four guarantees

Every design decision serves these. They are properties of what the treasury
**accepts**, not of what a proposal says it will do.

|        | Guarantee                                                                                                            | Enforced by                                                                  |
| ------ | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **G1** | No unilateral spending — no firm or administrator can move funds outside an approved proposal                        | `Treasury.release` caller check; timelock is the sole `RELEASER_ROLE` holder |
| **G2** | No payment redirection — funds reach only a payee owners affirmatively admitted _and_ named in the approved proposal | Checked twice: at proposal creation and again at payment                     |
| **G3** | No spending beyond approval — every proposal carries a hard limit                                                    | `amount <= proposal.limit` in `Treasury.release`                             |
| **G4** | No fund re-purposing — operating money cannot be spent on long-term maintenance, or the reverse                      | Two segregated balances; `fund == proposal.fund` in `Treasury.release`       |

**See:** [ADR-001](decisions/adr/001-narrow-release-interface.md), [functional view](decisions/views/functional-view.md).

## 3. The two funds

A levy receipt is split across two balances that never mix.

- **Operating** — this year's running costs: insurance, cleaning, power for
  common areas, the management fee, minor repairs.
- **Long-term maintenance** — money set aside against the maintenance plan for
  major periodic works: roof, cladding, lifts, repainting. It accumulates over
  years.

The separation exists because raiding the maintenance reserve to cover an
operating shortfall keeps levies low this year and leaves the building unable to
pay for the roof in twelve. G4 makes that structurally impossible rather than a
bookkeeping convention.

## 4. Contracts

Six built. Build in this order — it falls out of the permission structure, not
preference:

`MembershipRegistry` → `Treasury` + `PayeeRegistry` → `Governance` + `Timelock` → `LevyLedger`

| Contract             | Responsibility                                   | Externally callable                        | Guard                                                                                                       |
| -------------------- | ------------------------------------------------ | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `MembershipRegistry` | Unit → wallet bindings; voting eligibility       | `bindUnit`                                 | Land-title adapter role only. Bindings are fixed at deployment in the prototype                             |
|                      |                                                  | `isOwner`, `unitsOf`                       | view                                                                                                        |
| `LevyLedger`         | Issues charges, tracks arrears, takes payment    | `issueCharges`                             | Permissionless; **reverts before the due date**                                                             |
|                      |                                                  | `payLevy`                                  | Any payer; credits the unit, not the payer                                                                  |
|                      |                                                  | `arrearsOf`                                | view; a derived predicate, never stored state                                                               |
| `PayeeRegistry`      | Vendors admitted by affirmative owner vote       | `admit`                                    | Reachable only through an executed affirmative proposal                                                     |
|                      |                                                  | `isRegistered`                             | view                                                                                                        |
| `Governance`         | Proposals, voting, quorum, queueing, attestation | `propose`                                  | Firm key only; reverts if the payee is unregistered                                                         |
|                      |                                                  | `castVote`                                 | Only wallets `MembershipRegistry.isOwner` recognises                                                        |
|                      |                                                  | `attest`                                   | Firm key only; requires the proposal to have passed                                                         |
|                      |                                                  | `queue`, `execute`                         | Permissionless once the window and timelock have elapsed                                                    |
| `Timelock`           | Delay between approval and execution             | `schedule`, `execute`                      | `Governance` only                                                                                           |
|                      |                                                  | _holds `RELEASER_ROLE` on `Treasury`_      | **Sole holder**                                                                                             |
| `Treasury`           | Custody, and the single outward money path       | `release(fund, payee, amount, proposalId)` | `RELEASER_ROLE` **and** payee registered **and** `amount <= proposal.limit` **and** `fund == proposal.fund` |
|                      |                                                  | `deposit`                                  | `LevyLedger` only                                                                                           |
|                      |                                                  | `balanceOf(fund)`                          | view                                                                                                        |
|                      |                                                  | _role administration_                      | **Renounced at deployment.** No address can grant `RELEASER_ROLE` afterwards                                |

Use OpenZeppelin's `TimelockController` unchanged. **Write `Governance`
yourselves** — do not extend OpenZeppelin's `Governor`, because its purpose is
the general execution path this design removes.

**See:** [functional view](decisions/views/functional-view.md), [ADR-001](decisions/adr/001-narrow-release-interface.md), [ADR-013](decisions/adr/013-own-voting-contract.md).

## 5. Parameters — statutory, not chosen

Six of the seven come from the scheme these buildings already operate under.
Never invent a value.

| Parameter             | Value                                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Quorum                | 25% of eligible voters, minimum 2 — 10 of 40 at the reference building                                              |
| Passing threshold     | Ordinary: more than 50% of votes cast. Special (75%): genesis ratification, plan re-ratification, waiving the audit |
| Voting window         | 14 days; failing quorum it extends 7 days, after which **quorum is waived**                                         |
| Timelock              | 7 days between passing and the treasury being able to pay                                                           |
| Completion to payment | None. Payment releases on the firm's attestation                                                                    |
| Fee retention         | None. The firm is paid in full as earned                                                                            |
| Audit                 | Annual, financial, owner-commissioned, waivable by special resolution                                               |

**A known and deliberate consequence:** quorum is 25%, an ordinary resolution is
a majority of votes _cast_, and quorum is waived after the extension. Composed,
after 21 days a payment can be approved by a majority of whoever voted, even if
that is one owner in forty. This is faithful to the statute and is discussed in
the report as a finding. **It is not a bug — do not "fix" it.**

**See:** [ADR-003](decisions/adr/003-one-unit-one-vote.md), [ADR-011](decisions/adr/011-payment-on-attestation.md), [ADR-012](decisions/adr/012-no-built-in-accountability.md).

## 6. Events — eight, and they must be sufficient alone

`ChargeIssued`, `LevyPaid`, `ProposalCreated`, `VoteCast`, `ProposalQueued`,
`PayeeAdmitted`, `WorkAttested`, `PaymentReleased`.

Every state change emits one. Replaying the log alone — no storage reads, no
off-chain data — must yield every fund balance and every transition. So an event
carries enough to _reconstruct_, not merely to notify: `PaymentReleased` must
carry amount and fund, not only a proposal identifier.

**See:** [information view](decisions/views/information-view.md), [ADR-005](decisions/adr/005-arrears-published-per-unit.md), [ADR-009](decisions/adr/009-publicly-readable.md).

## 7. The eight refusals — each one is a test

Named on the behavioural view and in the report's evaluation section.

| #   | Where                     | Condition                            | Proves                                                                    |
| --- | ------------------------- | ------------------------------------ | ------------------------------------------------------------------------- |
| B1  | `LevyLedger.issueCharges` | Called before the due date           | Permissionless triggering is safe: anyone may call, nobody may call early |
| B2  | `Governance.propose`      | Vendor not on the approved list      | G2, at proposal time                                                      |
| B2′ | `Treasury.release`        | Payee not registered at payment time | G2 again — the check is not cached                                        |
| B3  | `Treasury.release`        | Caller is not the timelock           | G1                                                                        |
| B4  | `Treasury.release`        | Amount exceeds the approved limit    | G3                                                                        |
| B5  | `Treasury.release`        | Fund is not the approved fund        | G4                                                                        |
| B6  | `Governance.attest`       | Proposal never passed                | Attestation cannot manufacture an approval                                |
| B8  | `Governance.castVote`     | Voter is not a bound owner wallet    | Eligibility comes from the register, not the interface                    |

There is no B7; it was withdrawn with an earlier design and the number is left
unused rather than reassigned.

**Write these in Solidity.** A Solidity test is a transaction, so `msg.sender`,
reverts and gas behave exactly as they will in production. Use `vm.prank` to call
as another address, and `vm.expectRevert` naming the contract's own error — never
a generic revert.

**Fuzz the value guards.** G3 and G4 are properties, not examples: no amount
above a proposal's cap may ever succeed, and no release may ever draw on a fund
other than the approved one. Write those as fuzz tests taking the amount and the
fund as parameters, rather than as three hand-picked values.

B2′ is proved by calling `Treasury.release` directly with an unregistered payee,
because registry removal is designed and not built. The report says so in those
words — do not implement removal to make the end-to-end version work.

Plus scenario tests: a full levy cycle; a proposal from draft to payment; a
rejected proposal; a vote from an unbound wallet; and a proposal passing on one
owner's vote after the quorum extension — which is **expected to succeed**.

Two adversarial tests carry the strongest claims. **QAS-8:** drive the full
attacker path holding the firm's key — funds reachable at any new address must
be zero. **QAS-4:** replay events on an independent node — the derived balance
must equal the on-chain balance exactly.

**See:** [behavioural view](decisions/views/behavioural-view.md).

## 8. Requirements

`B` = built and demonstrated. `D` = designed, not built.

| ID   | Requirement                                                                                       |     |
| ---- | ------------------------------------------------------------------------------------------------- | --- |
| FR1  | Each unit is bound to exactly one wallet                                                          | B   |
| FR2  | Only bound wallets may vote                                                                       | B   |
| FR3  | A unit's binding updates from the land title register on sale                                     | D   |
| FR4  | The treasury cannot spend until owners ratify the configuration                                   | D   |
| FR5  | A levy charge becomes issuable on its due date and not before                                     | B   |
| FR6  | Any caller may issue a due charge                                                                 | B   |
| FR7  | An owner may pay a levy; payment credits the unit, not the payer                                  | B   |
| FR8  | Receipts are split across the operating and maintenance funds                                     | B   |
| FR9  | A charge unpaid past its due date counts as arrears                                               | B   |
| FR10 | An owner in arrears has their vote suspended                                                      | D   |
| FR11 | Levy amounts derive from the plan and the operating budget                                        | D   |
| FR12 | A vendor joins the approved list only through a passed affirmative vote                           | B   |
| FR13 | The list is readable by any caller                                                                | B   |
| FR14 | A vendor may be removed from the list by owner vote                                               | D   |
| FR15 | A payee record binds an address to a durable company identifier                                   | D   |
| FR16 | The firm may propose admitting a vendor                                                           | B   |
| FR17 | The firm may propose work naming description, limit, fund and vendor                              | B   |
| FR18 | A work proposal naming an unapproved vendor is refused at creation                                | B   |
| FR19 | Voting weight is the number of units a wallet holds                                               | B   |
| FR20 | Threshold within the window passes; failing quorum the window extends 7 days and quorum is waived | B   |
| FR21 | A passed proposal cannot execute before the 7-day timelock elapses                                | B   |
| FR22 | Any caller may queue or execute a proposal whose conditions are met                               | B   |
| FR23 | Owners may raise proposals, not only the firm                                                     | D   |
| FR24 | A ratified plan item becomes triggerable on its due date by any caller                            | D   |
| FR25 | The firm attests completion with an evidence hash, and that attestation releases payment          | B   |
| FR26 | Attestation on a proposal that did not pass is refused                                            | B   |
| FR30 | The treasury holds two segregated fund balances                                                   | B   |
| FR31 | Only the timelock may trigger a release, and no path can regrant that                             | B   |
| FR32 | A release above the proposal's limit is refused                                                   | B   |
| FR33 | A release drawing on a fund other than the approved one is refused                                | B   |
| FR34 | A release to an address not on the approved list is refused                                       | B   |
| FR35 | Payment is made in the settlement asset directly to the payee                                     | B   |
| FR39 | Every state change emits a structured event                                                       | B   |
| FR40 | Fund balance and every transition are derivable from events alone                                 | B   |
| FR41 | The interface reads events only and holds no authority                                            | B   |
| FR42 | The ledger is readable without permission                                                         | D   |

Non-functional requirements with a measure attached:

| ID    | Requirement                                              | Measure                                                                     |
| ----- | -------------------------------------------------------- | --------------------------------------------------------------------------- |
| NFR2  | The record is verifiable without trusting its holder     | Balance derived from events alone equals the on-chain balance, exactly      |
| NFR3  | Loss is bounded under total compromise of the firm's key | Funds reachable at any new address = 0                                      |
| NFR7  | No privileged party decides when a due action happens    | Every time-gated entry point accepts any caller and refuses before its time |
| NFR8  | Authority is auditable by inspection, not by reasoning   | The set of addresses that may trigger a payment has exactly one member      |
| NFR9  | Refusal is deterministic and named                       | 100% of guard violations revert with a distinct named error                 |
| NFR10 | The interface discloses status, not amounts or history   | For a unit other than the viewer's own, only a status renders               |
| NFR11 | Operating cost per owner is knowable                     | Gas per owner per levy cycle, measured on the test network                  |
| NFR15 | The system issues no speculative asset                   | No contract confers governance rights or consensus weight                   |

The nine `D` requirements are what the report explains as designed and not
built. Building one of them makes that explanation wrong.

**See:** [context view](decisions/views/context-view.md), [ADR-004](decisions/adr/004-versioning-out-of-scope.md), [ADR-008](decisions/adr/008-immutable-plan.md).

## 9. Stack

| Piece      | Choice                                                                                                                                                                                                                                    |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contracts  | Solidity **0.8.36**, fixed pragma; optimiser on, 200 runs; `prague` EVM target. OpenZeppelin Contracts **5.6.1** — `AccessControl`, `TimelockController`, `ERC20`, and nothing else                                                       |
| Voting     | `Governance`, written for this project                                                                                                                                                                                                    |
| Toolchain  | Hardhat **3.15** with `@nomicfoundation/hardhat-toolbox-mocha-ethers` 3. Node **22.13 or newer** — Hardhat 3 refuses to start below it; the exact version is pinned in `.nvmrc`                                                           |
| Testing    | **Solidity tests** — `.t.sol` files, `forge-std` v1.16.2 assertions, cheatcodes, `npx hardhat test solidity`. Coverage (`--coverage`) and gas statistics are built in                                                                     |
| Settlement | `MockNZD`, a mock ERC-20 standing in for an NZD-pegged stablecoin. This project issues nothing. `mint` is open to any caller on the Hardhat network (31337) and Sepolia (11155111) only; elsewhere it reverts with `MintOutsideTestChain` |

| Interface | Vite and `ethers`, reading events. Holds no key and no role |
| Deployment | A public test network, week 5 — **not** the permissioned national chain the design assumes |

**The compiler version is pinned, and the pragma is fixed rather than floating.**
Write `pragma solidity 0.8.36;`, not `^0.8.36`. NFR11 measures gas per owner per
levy cycle and the report publishes the number; a gas measurement is only
meaningful if the bytecode behind it can be reproduced, and a floating pragma
means the build that produced the table and the build deployed to the test
network can come from different compilers. The `prague` EVM target is stated
explicitly for the same reason — it is supported by every current public test
network, and nothing here needs a newer opcode. Both compiler profiles carry the
same optimiser settings, so gas measured in a test is gas of the deployed
contract.

**See:** [ADR-013](decisions/adr/013-own-voting-contract.md), [ADR-007](decisions/adr/007-proof-of-authority.md), [deployment view](decisions/views/deployment-view.md).

## 10. What is deliberately absent

Say so on the issue rather than building it.

- No committee, and no admin or owner role that can decide anything
- No accountability mechanism inside the contracts: nothing is withheld, no
  claim can be voted, no payment can be frozen or reversed. Accountability sits
  outside — the audit, adjudication and the courts, and a firm's ordinary
  reputation. What the architecture contributes is evidence
- No dispute path, no vendor tendering, no enforcement against non-payers beyond
  disclosure
- No versioning or upgrade path
- No token beyond the mock settlement asset

**See:** [ADR-006](decisions/adr/006-no-committee.md), [ADR-012](decisions/adr/012-no-built-in-accountability.md), [ADR-011](decisions/adr/011-payment-on-attestation.md), [ADR-004](decisions/adr/004-versioning-out-of-scope.md).
