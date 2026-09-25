// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {Fund} from "./interfaces/IRelease.sol";
import {IPayeeQuery} from "./interfaces/IPayeeQuery.sol";

/// @notice Proposals, voting, quorum, queueing and attestation for one
/// building (docs/spec.md §4). Written for this project rather than extending
/// OpenZeppelin's `Governor`, whose purpose is the general execution path this
/// design removes (ADR-013). A proposal carries terms — a payee, a limit, a
/// fund — and never a target address or calldata (ADR-001).
///
/// This revision is issue #53: raising proposals. Voting (#54), the window and
/// quorum (#55), the timelock (#56) and attestation (#57) follow.
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

    /// @notice The management firm's key: the only address that may propose.
    /// Fixed at deployment — there is no admin to rotate it, so a stolen key
    /// is bounded by the guards downstream rather than by revocation (QAS-8).
    address public immutable firm;

    /// @notice The approved-vendor list, read at proposal time (G2).
    IPayeeQuery public immutable payees;

    /// @notice The number of proposals raised. Ids run from 1, so 0 never
    /// names a real proposal.
    uint256 public proposalCount;

    mapping(uint256 proposalId => Proposal) private _proposals;

    /// @notice Carries every stored field, so a proposal can be rebuilt from
    /// the log alone without a storage read (CLAUDE.md rule 6, QAS-4).
    event ProposalCreated(
        uint256 indexed proposalId,
        ProposalKind kind,
        address indexed payee,
        uint256 limit,
        Fund fund,
        bytes32 quoteHash,
        string description
    );

    error FirmIsZero();
    error PayeeRegistryIsZero();
    error VendorIsZero();
    error NotFirm(address caller);
    /// B2: a work proposal names a vendor the owners have not admitted.
    error PayeeNotRegistered(address payee);

    constructor(address firm_, IPayeeQuery payees_) {
        if (firm_ == address(0)) revert FirmIsZero();
        if (address(payees_) == address(0)) revert PayeeRegistryIsZero();
        firm = firm_;
        payees = payees_;
    }

    modifier onlyFirm() {
        if (msg.sender != firm) revert NotFirm(msg.sender);
        _;
    }

    /// @notice FR16. Propose admitting `vendor` to the approved list. The
    /// vendor is admitted only if the owners vote for it and the proposal
    /// executes; raising it changes nothing.
    function proposeAdmit(address vendor) external onlyFirm returns (uint256 proposalId) {
        if (vendor == address(0)) revert VendorIsZero();
        proposalId = _store(ProposalKind.Admit, vendor, Fund.Operating, 0, bytes32(0), "");
    }

    /// @notice FR17, FR18. Propose work paid to `vendor` from `fund`, up to
    /// `limit`. Refused at creation if the vendor is not on the approved list
    /// (B2); the treasury checks again at payment time (B2′).
    /// @param quoteHash Commits the vendor's quote, which stays off the chain.
    function proposeWork(
        string calldata description,
        uint256 limit,
        Fund fund,
        address vendor,
        bytes32 quoteHash
    ) external onlyFirm returns (uint256 proposalId) {
        if (!payees.isRegistered(vendor)) revert PayeeNotRegistered(vendor);
        proposalId = _store(ProposalKind.Work, vendor, fund, limit, quoteHash, description);
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
