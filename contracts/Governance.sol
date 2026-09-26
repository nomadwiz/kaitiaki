// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {Fund} from "./interfaces/IRelease.sol";
import {IPayeeQuery} from "./interfaces/IPayeeQuery.sol";
import {IMembershipQuery} from "./interfaces/IMembershipQuery.sol";

/// @notice Proposals, voting, quorum, queueing and attestation for one
/// building (docs/spec.md §4). Written for this project rather than extending
/// OpenZeppelin's `Governor`, whose purpose is the general execution path this
/// design removes (ADR-013). A proposal carries terms — a payee, a limit, a
/// fund — and never a target address or calldata (ADR-001).
///
/// One function name, `propose`, overloaded for the two kinds — the name the
/// spec, the views and the figures use throughout.
///
/// Built so far: raising proposals (#53) and voting on them (#54). The window
/// and quorum (#55), the timelock (#56) and attestation (#57) follow.
contract Governance {
    /// @notice The two kinds of proposal in the built loop. `Admit` puts a
    /// vendor on the approved list (FR16); `Work` spends against it (FR17).
    enum ProposalKind {
        Admit,
        Work
    }

    /// @notice Everything docs/decisions/views/information-view.md §2.1 lists
    /// for a proposal. `limit`, `fund`, `description` and `quoteHash` are
    /// unused by an `Admit` proposal and left zero.
    struct Proposal {
        ProposalKind kind;
        address payee;
        Fund fund;
        uint64 createdAt;
        uint256 limit;
        bytes32 quoteHash;
        string description;
    }

    /// @notice Votes cast so far, weighted by unit (FR19).
    struct Tally {
        uint256 forVotes;
        uint256 againstVotes;
    }

    /// @notice The management firm's key: the only address that may propose.
    /// Fixed at deployment — there is no admin to rotate it, so a stolen key
    /// is bounded by the guards downstream rather than by revocation (QAS-8).
    address public immutable firm;

    /// @notice The approved-vendor list, read at proposal time (G2).
    IPayeeQuery public immutable payees;

    /// @notice The unit register. Voting eligibility is read from here, never
    /// from anything the voter supplies (FR2, B8).
    IMembershipQuery public immutable members;

    /// @notice The number of proposals raised. Ids run from 1, so 0 never
    /// names a real proposal.
    uint256 public proposalCount;

    mapping(uint256 proposalId => Proposal) private _proposals;
    mapping(uint256 proposalId => Tally) private _tallies;

    /// @notice Whether a unit has voted on a proposal. Kept per unit, not per
    /// wallet, so a unit that changes hands mid-vote still votes only once.
    mapping(uint256 proposalId => mapping(uint256 unitId => bool)) public unitHasVoted;

    /// @notice Carries every stored field except `createdAt`, which is the
    /// block timestamp of this log, so a proposal can be rebuilt from the log
    /// alone without a storage read (CLAUDE.md rule 6, QAS-4).
    event ProposalCreated(
        uint256 indexed proposalId,
        ProposalKind kind,
        address indexed payee,
        uint256 limit,
        Fund fund,
        bytes32 quoteHash,
        string description
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

    error FirmIsZero();
    error PayeeRegistryIsZero();
    error MembershipRegistryIsZero();
    error VendorIsZero();
    error NotFirm(address caller);
    /// B2: a work proposal names a vendor the owners have not admitted.
    error PayeeNotRegistered(address payee);
    error UnknownProposal(uint256 proposalId);
    /// B8: the caller is not the bound owner of any unit.
    error NotBoundOwner(address caller);
    /// Every unit the caller owns has already voted on this proposal.
    error AlreadyVoted(uint256 proposalId, address voter);

    constructor(address firm_, IPayeeQuery payees_, IMembershipQuery members_) {
        if (firm_ == address(0)) revert FirmIsZero();
        if (address(payees_) == address(0)) revert PayeeRegistryIsZero();
        if (address(members_) == address(0)) revert MembershipRegistryIsZero();
        firm = firm_;
        payees = payees_;
        members = members_;
    }

    modifier onlyFirm() {
        if (msg.sender != firm) revert NotFirm(msg.sender);
        _;
    }

    /// @notice FR16. Propose admitting `vendor` to the approved list. The
    /// vendor is admitted only if the owners vote for it and the proposal
    /// executes; raising it changes nothing.
    function propose(address vendor) external onlyFirm returns (uint256 proposalId) {
        if (vendor == address(0)) revert VendorIsZero();
        proposalId = _store(ProposalKind.Admit, vendor, Fund.Operating, 0, bytes32(0), "");
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
        proposalId = _store(ProposalKind.Work, vendor, fund, limit, quoteHash, description);
    }

    /// @notice FR2, FR19. Vote on `proposalId` with every unit the caller
    /// owns that has not yet voted on it — one vote per unit per proposal
    /// (ADR-003). Each call votes all such units the same way; a later call
    /// votes only units acquired since, in whichever direction it names.
    /// Eligibility is checked unit by unit against the register (B8).
    /// @return weight The number of units this call voted with.
    function castVote(uint256 proposalId, bool inFavour) external returns (uint256 weight) {
        if (_proposals[proposalId].createdAt == 0) revert UnknownProposal(proposalId);

        uint256[] memory held = members.unitsOf(msg.sender);
        uint256[] memory voted = new uint256[](held.length);
        bool ownsAny;
        for (uint256 i = 0; i < held.length; ++i) {
            uint256 unitId = held[i];
            if (!members.isOwner(unitId, msg.sender)) continue;
            ownsAny = true;
            if (unitHasVoted[proposalId][unitId]) continue;
            unitHasVoted[proposalId][unitId] = true;
            voted[weight++] = unitId;
        }
        if (!ownsAny) revert NotBoundOwner(msg.sender);
        if (weight == 0) revert AlreadyVoted(proposalId, msg.sender);

        uint256[] memory unitIds = new uint256[](weight);
        for (uint256 i = 0; i < weight; ++i) unitIds[i] = voted[i];

        Tally storage tally = _tallies[proposalId];
        if (inFavour) tally.forVotes += weight;
        else tally.againstVotes += weight;

        emit VoteCast(proposalId, msg.sender, inFavour, weight, unitIds);
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

    function _store(
        ProposalKind kind,
        address payee,
        Fund fund,
        uint256 limit,
        bytes32 quoteHash,
        string memory description
    ) private returns (uint256 proposalId) {
        proposalId = ++proposalCount;
        _proposals[proposalId] = Proposal({
            kind: kind,
            payee: payee,
            fund: fund,
            createdAt: uint64(block.timestamp),
            limit: limit,
            quoteHash: quoteHash,
            description: description
        });
        emit ProposalCreated(proposalId, kind, payee, limit, fund, quoteHash, description);
    }
}
