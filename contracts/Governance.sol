// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {Fund, IRelease} from "./interfaces/IRelease.sol";
import {IAdmit} from "./interfaces/IAdmit.sol";
import {IPayeeQuery} from "./interfaces/IPayeeQuery.sol";
import {IMembershipQuery} from "./interfaces/IMembershipQuery.sol";
import {IArrearsQuery} from "./interfaces/IArrearsQuery.sol";

/// @notice Proposals, voting, quorum, queueing and attestation for one
/// building (doc/design/spec.md §4). Written for this project rather than extending
/// OpenZeppelin's `Governor`, whose purpose is the general execution path this
/// design removes (ADR-013). A proposal carries terms — a payee, a limit, a
/// fund — and never a target address or calldata (ADR-001).
///
/// One function name, `propose`, overloaded for the two kinds — the name the
/// spec, the views and the figures use throughout.
///
/// Built: raising proposals (#53), voting on them (#54) — a unit in arrears
/// does not vote (FR10) — the voting window,
/// quorum, extension and waiver that decide them (#55), queueing and executing
/// a passed proposal through the timelock (#56), and the firm's attestation
/// that lets a `Work` proposal's release run (#57).
///
/// The only calls this contract builds are `PayeeRegistry.admit` and
/// `Treasury.release`, against addresses fixed at construction, so it can
/// never schedule an operation on the timelock itself, and no role there can
/// change (ADR-015, FR31).
contract Governance {
    /// @notice The two kinds of proposal in the built loop. `Admit` puts a
    /// vendor on the approved list (FR16); `Work` spends against it (FR17).
    enum ProposalKind {
        Admit,
        Work
    }

    /// @notice Where a proposal stands. `Open` for the 14-day window;
    /// `Extended` for the 7 days after it when the window closed without
    /// quorum; then `Passed` or `Failed` (FR20). A passed proposal becomes
    /// `Queued` when its operation is scheduled on the timelock, and
    /// `Executed` once that operation has run. `Failed` and `Executed` never
    /// change.
    enum ProposalState {
        Open,
        Extended,
        Passed,
        Failed,
        Queued,
        Executed
    }

    /// @notice Everything doc/design/decisions/views/information-view.md §2.1 lists
    /// for a proposal. `limit`, `fund` and `quoteHash` are unused by an
    /// `Admit` proposal and left zero; it carries the vendor's name in
    /// `description` and its company identifier in `companyId` (ADR-018).
    /// `companyId` is empty for a `Work` proposal.
    struct Proposal {
        ProposalKind kind;
        address payee;
        Fund fund;
        uint64 createdAt;
        uint256 limit;
        /// The units bound when the proposal was created: the quorum
        /// denominator for its whole life, so a unit bound later can vote but
        /// does not move the bar (ADR-003, amendment of 30-09-2026).
        uint256 principalUnits;
        bytes32 quoteHash;
        string description;
        string companyId;
    }

    /// @notice Votes cast so far, weighted by unit (FR19).
    struct Tally {
        uint256 forVotes;
        uint256 againstVotes;
    }

    /// @notice The voting window: 14 days, mirroring the notice period for an
    /// annual general meeting (Unit Titles Regulations 2011, reg 6(3)(b)).
    uint256 public constant VOTING_PERIOD = 14 days;

    /// @notice Failing quorum, the window extends by this much and quorum is
    /// then waived (reg 13(2)). Composed with a majority of votes cast, one
    /// owner's vote can pass a proposal after 21 days — the finding in
    /// doc/design/sad.md §2.5, and deliberate, not a bug.
    uint256 public constant EXTENSION = 7 days;

    /// @notice Quorum's two halves (Unit Titles Act 2010, s 95(1), (1A)): the
    /// units voted are at least one in `QUORUM_UNIT_DIVISOR` of the principal
    /// units, and at least `QUORUM_MIN_VOTERS` distinct wallets cast them.
    uint256 public constant QUORUM_UNIT_DIVISOR = 4;
    uint256 public constant QUORUM_MIN_VOTERS = 2;

    /// @notice The wait between a proposal being queued and its operation
    /// running: 7 days, matched to the one-week adjournment in reg 13(2)
    /// (doc/design/spec.md §5, FR21). A design choice, not statute.
    uint256 public constant TIMELOCK_DELAY = 7 days;

    /// @notice The management firm's key: the only address that may propose.
    /// Fixed at deployment — there is no admin to rotate it, so a stolen key
    /// is bounded by the guards downstream rather than by revocation (QAS-8).
    address public immutable firm;

    /// @notice The approved-vendor list, read at proposal time (G2).
    IPayeeQuery public immutable payees;

    /// @notice The unit register. Voting eligibility is read from here, never
    /// from anything the voter supplies (FR2, B8).
    IMembershipQuery public immutable members;

    /// @notice The levy ledger. A unit in arrears when a vote is cast does not
    /// vote (FR10; Unit Titles Act 2010, s 96(3)).
    IArrearsQuery public immutable levies;

    /// @notice OpenZeppelin's `TimelockController`, unchanged, with this
    /// contract as its only proposer and only executor and no external admin
    /// (ADR-015). It holds `RELEASER_ROLE` on the treasury alone.
    TimelockController public immutable timelock;

    /// @notice The treasury a passed `Work` proposal is paid from.
    IRelease public immutable treasury;

    /// @notice The number of proposals raised. Ids run from 1, so 0 never
    /// names a real proposal.
    uint256 public proposalCount;

    mapping(uint256 proposalId => Proposal) private _proposals;
    mapping(uint256 proposalId => Tally) private _tallies;

    /// @notice Whether a unit has voted on a proposal. Kept per unit, not per
    /// wallet, so a unit that changes hands mid-vote still votes only once.
    mapping(uint256 proposalId => mapping(uint256 unitId => bool)) public unitHasVoted;

    /// @notice Whether a wallet has voted on a proposal, and how many distinct
    /// wallets have. The one count kept per wallet, not per unit: quorum's
    /// two-person minimum (doc/design/decisions/views/information-view.md §2.1).
    mapping(uint256 proposalId => mapping(address wallet => bool)) public walletHasVoted;
    mapping(uint256 proposalId => uint256) public voterCount;

    /// @dev Set by the first vote cast in the extension, which is only ever
    /// allowed when the window closed without quorum. Without it, a vote in
    /// the extension that reaches quorum would make the proposal look as if it
    /// had been decided when the window closed, and end the extension early.
    mapping(uint256 proposalId => bool) private _votedInExtension;

    /// @notice Whether the firm has attested a `Work` proposal's completion,
    /// which `execute` requires (FR25). Set once, by `attest`; the evidence
    /// hash lives in `WorkAttested`, not in storage.
    mapping(uint256 proposalId => bool) public attested;

    /// @notice Carries every stored field except `createdAt`, which is the
    /// block timestamp of this log, so a proposal can be rebuilt from the log
    /// alone without a storage read (CLAUDE.md rule 6, QAS-4) — including
    /// whether it reached quorum, which needs `principalUnits`.
    event ProposalCreated(
        uint256 indexed proposalId,
        ProposalKind kind,
        address indexed payee,
        uint256 limit,
        Fund fund,
        bytes32 quoteHash,
        string description,
        uint256 principalUnits,
        string companyId
    );

    /// @notice One event per `castVote` call, naming the units that voted in
    /// it, so which units have voted — not only the totals — can be rebuilt
    /// from the log alone (rule 6). The vote belongs to the unit, not the
    /// wallet: a wallet that gains a unit after voting may call again, and its
    /// second event may go the other way. A tally or vote record built from
    /// the log must key on `unitIds`, not on `voter`.
    event VoteCast(
        uint256 indexed proposalId,
        address indexed voter,
        bool inFavour,
        uint256 weight,
        uint256[] unitIds
    );

    /// @notice The proposal's operation is on the timelock, and runs from
    /// `eta`. Carries `eta` so FR21 can be checked from the log without
    /// importing the delay (doc/design/spec.md §6).
    event ProposalQueued(uint256 indexed proposalId, uint256 eta);

    /// @notice The firm asserts a `Work` proposal's work is complete. The
    /// evidence stays off the chain, committed by `evidenceHash`; `attester`
    /// identifies who made the claim (FR25, QAS-11; information view §2.1).
    event WorkAttested(uint256 indexed proposalId, address indexed attester, bytes32 evidenceHash);

    error FirmIsZero();
    error PayeeRegistryIsZero();
    error MembershipRegistryIsZero();
    error LevyLedgerIsZero();
    error TimelockIsZero();
    error TreasuryIsZero();
    error VendorIsZero();
    /// FR15, ADR-018: an admission names the vendor.
    error VendorNameIsEmpty();
    /// FR15, ADR-018: an admission carries the vendor's company identifier.
    error CompanyIdIsEmpty();
    error NotFirm(address caller);
    /// B2: a work proposal names a vendor the owners have not admitted.
    error PayeeNotRegistered(address payee);
    error UnknownProposal(uint256 proposalId);
    /// B8: the caller is not the bound owner of any unit.
    error NotBoundOwner(address caller);
    /// Every unit the caller owns has already voted on this proposal.
    error AlreadyVoted(uint256 proposalId, address voter);
    /// FR10: every unit the caller owns that has not voted is in arrears.
    error InArrears(uint256 proposalId, address voter);
    /// FR20: the window, and any extension, has closed.
    error VotingClosed(uint256 proposalId);
    /// Only a passed proposal is queued (FR22) or attested (FR26, B6).
    error NotPassed(uint256 proposalId, ProposalState state);
    /// A proposal is scheduled once (ADR-015, amendment of 02-10-2026).
    error AlreadyQueued(uint256 proposalId);
    /// Only a queued proposal is executed or attested.
    error NotQueued(uint256 proposalId, ProposalState state);
    /// FR21: the timelock's delay has not elapsed; the operation runs from
    /// `eta`. Attestation waits for it too (behavioural view, R2).
    error NotReady(uint256 proposalId, uint256 eta);
    error AlreadyExecuted(uint256 proposalId);
    /// FR25: a `Work` proposal pays only once the firm has attested it.
    error NotAttested(uint256 proposalId);
    /// Only a `Work` proposal has work to attest.
    error NotWorkProposal(uint256 proposalId);
    /// A proposal is attested once: it has one release (ADR-015, amendment of 02-10-2026).
    error AlreadyAttested(uint256 proposalId);
    /// FR25: an attestation carries an evidence hash; zero commits to nothing.
    error EvidenceHashIsZero();

    /// @dev `timelock_` is named before it exists: it takes this contract's
    /// address as its proposer and executor, so deployment precomputes one of
    /// the two (ADR-015).
    constructor(
        address firm_,
        IPayeeQuery payees_,
        IMembershipQuery members_,
        IArrearsQuery levies_,
        TimelockController timelock_,
        IRelease treasury_
    ) {
        if (firm_ == address(0)) revert FirmIsZero();
        if (address(payees_) == address(0)) revert PayeeRegistryIsZero();
        if (address(members_) == address(0)) revert MembershipRegistryIsZero();
        if (address(levies_) == address(0)) revert LevyLedgerIsZero();
        if (address(timelock_) == address(0)) revert TimelockIsZero();
        if (address(treasury_) == address(0)) revert TreasuryIsZero();
        firm = firm_;
        payees = payees_;
        members = members_;
        levies = levies_;
        timelock = timelock_;
        treasury = treasury_;
    }

    modifier onlyFirm() {
        if (msg.sender != firm) revert NotFirm(msg.sender);
        _;
    }

    /// @notice FR15, FR16. Propose admitting `vendor`, under `name` and
    /// `companyId`, to the approved list. The vendor is admitted only if the
    /// owners vote for it and the proposal executes; raising it changes
    /// nothing. The identifier's format is not checked (ADR-018).
    function propose(
        address vendor,
        string calldata name,
        string calldata companyId
    ) external onlyFirm returns (uint256 proposalId) {
        if (vendor == address(0)) revert VendorIsZero();
        if (bytes(name).length == 0) revert VendorNameIsEmpty();
        if (bytes(companyId).length == 0) revert CompanyIdIsEmpty();
        proposalId = _store(
            ProposalKind.Admit,
            vendor,
            Fund.Operating,
            0,
            bytes32(0),
            name,
            companyId
        );
    }

    /// @notice FR17, FR18. Propose work paid to `vendor` from `fund`, up to
    /// `limit`. Refused at creation if the vendor is not on the approved list
    /// (B2); the treasury checks again at payment time (B2′).
    /// @param quoteHash Commits the vendor's quote, which stays off the chain.
    function propose(
        string calldata description,
        uint256 limit,
        Fund fund,
        address vendor,
        bytes32 quoteHash
    ) external onlyFirm returns (uint256 proposalId) {
        if (!payees.isRegistered(vendor)) revert PayeeNotRegistered(vendor);
        proposalId = _store(ProposalKind.Work, vendor, fund, limit, quoteHash, description, "");
    }

    /// @notice FR2, FR19. Vote on `proposalId` with every unit the caller
    /// owns that has not yet voted on it — one vote per unit per proposal
    /// (ADR-003). Each call votes all such units the same way; a later call
    /// votes only units acquired since, in whichever direction it names.
    /// Eligibility is checked unit by unit against the register (B8). A unit
    /// in arrears is skipped and the caller's other units still vote; once its
    /// charge is paid it may vote (FR10; ADR-003, amendment of 09-10-2026).
    /// Voting runs for the window and, if it closed without quorum, the
    /// extension (FR20).
    /// @return weight The number of units this call voted with.
    function castVote(uint256 proposalId, bool inFavour) external returns (uint256 weight) {
        ProposalState current = state(proposalId);
        if (current == ProposalState.Extended) _votedInExtension[proposalId] = true;
        else if (current != ProposalState.Open) revert VotingClosed(proposalId);

        uint256[] memory held = members.unitsOf(msg.sender);
        uint256[] memory voted = new uint256[](held.length);
        bool ownsAny;
        bool inArrears;
        for (uint256 i = 0; i < held.length; ++i) {
            uint256 unitId = held[i];
            if (!members.isOwner(unitId, msg.sender)) continue;
            ownsAny = true;
            if (unitHasVoted[proposalId][unitId]) continue;
            if (levies.arrearsOf(unitId)) {
                inArrears = true;
                continue;
            }
            unitHasVoted[proposalId][unitId] = true;
            voted[weight++] = unitId;
        }
        if (!ownsAny) revert NotBoundOwner(msg.sender);
        if (weight == 0 && inArrears) revert InArrears(proposalId, msg.sender);
        if (weight == 0) revert AlreadyVoted(proposalId, msg.sender);

        uint256[] memory unitIds = new uint256[](weight);
        for (uint256 i = 0; i < weight; ++i) unitIds[i] = voted[i];

        Tally storage tally = _tallies[proposalId];
        if (inFavour) tally.forVotes += weight;
        else tally.againstVotes += weight;

        if (!walletHasVoted[proposalId][msg.sender]) {
            walletHasVoted[proposalId][msg.sender] = true;
            ++voterCount[proposalId];
        }

        emit VoteCast(proposalId, msg.sender, inFavour, weight, unitIds);
    }

    /// @notice FR20. Where `proposalId` stands now. Quorum decides only when
    /// voting closes — at the end of the window if it was reached, at the end
    /// of the extension if not, when it is waived. Either way the proposal
    /// passes only on more units for than against, so a tie fails and a
    /// proposal nobody voted on fails, even after the waiver (s 97(4)).
    function state(uint256 proposalId) public view returns (ProposalState) {
        Proposal storage stored = _proposals[proposalId];
        if (stored.createdAt == 0) revert UnknownProposal(proposalId);

        uint256 windowEnd = stored.createdAt + VOTING_PERIOD;
        if (block.timestamp < windowEnd) return ProposalState.Open;
        // No vote can be cast between the window closing and the first vote
        // in the extension, so until then the tally is the tally at close.
        bool extended = _votedInExtension[proposalId] || !quorumReached(proposalId);
        if (extended && block.timestamp < windowEnd + EXTENSION) return ProposalState.Extended;

        Tally storage tally = _tallies[proposalId];
        if (tally.forVotes <= tally.againstVotes) return ProposalState.Failed;

        (, , bytes32 operationId) = operation(proposalId);
        if (timelock.isOperationDone(operationId)) return ProposalState.Executed;
        if (timelock.isOperation(operationId)) return ProposalState.Queued;
        return ProposalState.Passed;
    }

    /// @notice FR22. Schedule a passed proposal's one operation on the
    /// timelock. Anyone may call it. The operation runs no sooner than
    /// `TIMELOCK_DELAY` later (FR21), and only through `execute`.
    /// @return eta The time from which the operation may run.
    function queue(uint256 proposalId) external returns (uint256 eta) {
        ProposalState current = state(proposalId);
        if (current == ProposalState.Queued || current == ProposalState.Executed) {
            revert AlreadyQueued(proposalId);
        }
        if (current != ProposalState.Passed) revert NotPassed(proposalId, current);

        (address target, bytes memory data, ) = operation(proposalId);
        timelock.schedule(target, 0, data, bytes32(0), bytes32(proposalId), TIMELOCK_DELAY);
        eta = block.timestamp + TIMELOCK_DELAY;
        emit ProposalQueued(proposalId, eta);
    }

    /// @notice FR22. Run a queued proposal's operation once the timelock's
    /// delay has elapsed. Anyone may call it; the timelock accepts it from
    /// this contract alone, so the checks here cannot be bypassed — a `Work`
    /// proposal also needs the firm's attestation (FR25, ADR-015). Emits none
    /// of the eleven events itself: its effect is `PayeeAdmitted` or
    /// `PaymentReleased` (doc/design/spec.md §6).
    function execute(uint256 proposalId) external {
        ProposalState current = state(proposalId);
        if (current == ProposalState.Executed) revert AlreadyExecuted(proposalId);
        if (current != ProposalState.Queued) revert NotQueued(proposalId, current);

        (address target, bytes memory data, bytes32 operationId) = operation(proposalId);
        _requireReady(proposalId, operationId);
        if (_proposals[proposalId].kind == ProposalKind.Work && !attested[proposalId]) {
            revert NotAttested(proposalId);
        }
        timelock.execute(target, 0, data, bytes32(0), bytes32(proposalId));
    }

    /// @notice FR25, FR26. The firm asserts that a passed `Work` proposal's
    /// work is complete, committing its evidence by hash. Nothing sits between
    /// this and payment: no owner approval and no further wait (ADR-011).
    /// It pays nothing by itself — anyone may then call `execute`, which
    /// releases the whole limit (behavioural view, phase 4).
    ///
    /// Refused for a proposal that never passed (B6), so an attestation cannot
    /// manufacture an approval; and before the timelock's delay has elapsed,
    /// because attestation sits after the timelock (R2). No contract can check
    /// the claim itself: a false attestation still releases payment, the
    /// limit QAS-11 states.
    function attest(uint256 proposalId, bytes32 evidenceHash) external onlyFirm {
        if (evidenceHash == bytes32(0)) revert EvidenceHashIsZero();
        ProposalState current = state(proposalId);
        if (_proposals[proposalId].kind != ProposalKind.Work) revert NotWorkProposal(proposalId);
        if (attested[proposalId]) revert AlreadyAttested(proposalId);
        if (current == ProposalState.Passed) revert NotQueued(proposalId, current);
        if (current != ProposalState.Queued) revert NotPassed(proposalId, current);

        (, , bytes32 operationId) = operation(proposalId);
        _requireReady(proposalId, operationId);

        attested[proposalId] = true;
        emit WorkAttested(proposalId, msg.sender, evidenceHash);
    }

    function _requireReady(uint256 proposalId, bytes32 operationId) private view {
        if (!timelock.isOperationReady(operationId)) {
            revert NotReady(proposalId, timelock.getTimestamp(operationId));
        }
    }

    /// @notice The one operation a proposal schedules (ADR-015, amendment of
    /// 02-10-2026): `PayeeRegistry.admit` for an `Admit` proposal, and
    /// `Treasury.release` of the whole limit for a `Work` proposal. Salted with
    /// the proposal id, so the timelock schedules it once. `target` is never
    /// the timelock.
    function operation(
        uint256 proposalId
    ) public view returns (address target, bytes memory data, bytes32 operationId) {
        Proposal storage stored = _proposals[proposalId];
        if (stored.createdAt == 0) revert UnknownProposal(proposalId);

        if (stored.kind == ProposalKind.Admit) {
            target = address(payees);
            data = abi.encodeCall(
                IAdmit.admit,
                (stored.payee, proposalId, stored.description, stored.companyId)
            );
        } else {
            target = address(treasury);
            data = abi.encodeCall(
                IRelease.release,
                (stored.fund, stored.payee, stored.limit, proposalId)
            );
        }
        operationId = timelock.hashOperation(target, 0, data, bytes32(0), bytes32(proposalId));
    }

    /// @notice Whether the votes cast on `proposalId` so far meet both halves
    /// of quorum: units for and against together are at least a quarter of
    /// its principal units, rounded up, and at least two distinct wallets
    /// cast them. False for an unknown id.
    function quorumReached(uint256 proposalId) public view returns (bool) {
        Tally storage tally = _tallies[proposalId];
        uint256 unitsVoted = tally.forVotes + tally.againstVotes;
        return
            unitsVoted * QUORUM_UNIT_DIVISOR >= _proposals[proposalId].principalUnits &&
            voterCount[proposalId] >= QUORUM_MIN_VOTERS;
    }

    /// @notice Votes cast on `proposalId` so far, by unit.
    function tallyOf(uint256 proposalId) external view returns (Tally memory) {
        return _tallies[proposalId];
    }

    /// @notice The stored proposal. Reverts on nothing: an unknown id returns
    /// a zeroed struct, which `createdAt == 0` identifies.
    function proposal(uint256 proposalId) external view returns (Proposal memory) {
        return _proposals[proposalId];
    }

    /// @notice Narrow Treasury read surface for a work proposal's payment terms.
    /// Unknown proposal ids return `exists == false`.
    function approvedSpend(
        uint256 proposalId
    ) external view returns (bool exists, Fund fund, uint256 limit, address payee) {
        Proposal storage stored = _proposals[proposalId];
        exists = stored.createdAt != 0 && stored.kind == ProposalKind.Work;
        fund = stored.fund;
        limit = stored.limit;
        payee = stored.payee;
    }

    function _store(
        ProposalKind kind,
        address payee,
        Fund fund,
        uint256 limit,
        bytes32 quoteHash,
        string memory description,
        string memory companyId
    ) private returns (uint256 proposalId) {
        proposalId = ++proposalCount;
        uint256 principalUnits = members.boundUnitCount();
        _proposals[proposalId] = Proposal({
            kind: kind,
            payee: payee,
            fund: fund,
            createdAt: uint64(block.timestamp),
            limit: limit,
            principalUnits: principalUnits,
            quoteHash: quoteHash,
            description: description,
            companyId: companyId
        });
        emit ProposalCreated(
            proposalId,
            kind,
            payee,
            limit,
            fund,
            quoteHash,
            description,
            principalUnits,
            companyId
        );
    }
}
