// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {Governance} from "./Governance.sol";
import {GovernanceLoopSetup} from "./GovernanceLoopSetup.t.sol";
import {Fund} from "./interfaces/IRelease.sol";

/// @notice Refusal tests on `Governance`'s own checks (spec §7), on the real
/// contracts: B2 (#61) and B8 (#67). B6 sits with the attestation tests in
/// `GovernanceAttest.t.sol`.
contract GovernanceRefusalsTest is GovernanceLoopSetup {
    bytes32 internal constant QUOTE = keccak256("quote: roof repair");

    /// How far a candidate vendor's own admission got before the firm names
    /// it in a work proposal. None of these puts it on the approved list.
    enum AdmissionStage {
        NeverProposed,
        VoteOpen,
        PassedNotQueued,
        QueuedWaiting,
        ReadyNotExecuted
    }

    function _bringAdmissionTo(address candidate, AdmissionStage stage) internal {
        if (stage == AdmissionStage.NeverProposed) return;
        vm.prank(firm);
        uint256 admissionId = governance.propose(candidate, "Test Vendor Ltd", "TEST-0001");
        if (stage == AdmissionStage.VoteOpen) return;
        _pass(admissionId);
        if (stage == AdmissionStage.PassedNotQueued) return;
        uint256 eta = governance.queue(admissionId);
        if (stage == AdmissionStage.ReadyNotExecuted) vm.warp(eta);
    }

    // --- Refusal test B2: a work proposal names an unapproved vendor --------

    /// B2 (spec §7), FR18, G2 at proposal time. Whatever vendor the firm names
    /// that the owners have not admitted — at any stage of that vendor's own
    /// admission short of execution — with any limit and either fund, the
    /// proposal is refused with `PayeeNotRegistered`, a named error of its own
    /// (NFR9), and no proposal is created. Nearly approved is not approved: a
    /// vendor is on the list only once the owners' admission has executed.
    /// `Treasury.release` checks again at payment time (B2′). The hand-picked
    /// `test_ProposeWorkRefusesUnregisteredVendor` from #53 stays as the guard's own test.
    function testFuzz_ProposeWorkWithUnapprovedVendorReverts(
        address candidate,
        uint256 limit,
        uint8 fundSeed,
        uint8 stageSeed
    ) public {
        _admitVendor();
        vm.assume(candidate != vendor && candidate != address(0));
        Fund fund = Fund(bound(fundSeed, 0, 1));
        AdmissionStage stage = AdmissionStage(bound(stageSeed, 0, 4));
        _bringAdmissionTo(candidate, stage);
        assertFalse(payees.isRegistered(candidate));
        uint256 proposalsBefore = governance.proposalCount();

        vm.prank(firm);
        vm.expectRevert(abi.encodeWithSelector(Governance.PayeeNotRegistered.selector, candidate));
        governance.propose("Roof repair", limit, fund, candidate, QUOTE);

        assertEq(governance.proposalCount(), proposalsBefore);
    }

    /// The other half: once the owners' admission has executed, the same
    /// proposal is accepted.
    function test_ProposeWorkAcceptsVendorOnceAdmissionExecutes() public {
        _admitVendor();

        vm.prank(firm);
        uint256 proposalId = governance.propose(
            "Roof repair",
            LIMIT,
            Fund.Operating,
            vendor,
            QUOTE
        );

        assertEq(governance.proposal(proposalId).payee, vendor);
        assertEq(uint8(governance.proposal(proposalId).kind), uint8(Governance.ProposalKind.Work));
    }

    // --- Refusal test B8: the voter is not a bound owner wallet -------------

    /// B8 (spec §7), FR2. Any wallet that owns no unit in the register —
    /// voting either way, at any moment while the vote is open, in the 14-day
    /// window or the 7-day extension — is refused with `NotBoundOwner`, a
    /// named error of its own (NFR9), and nothing is counted: no units, no
    /// voter. `castVote` takes no unit ids from the caller; it reads them from
    /// the register, so eligibility comes from the register, not the
    /// interface. The hand-picked `test_UnboundWalletRefused` from #54, on a
    /// stub register, stays as the guard's own test.
    function testFuzz_CastVoteFromUnboundWalletReverts(
        address caller,
        bool inFavour,
        uint256 elapsed
    ) public {
        vm.assume(caller != alice && caller != bob && caller != carol);
        vm.prank(firm);
        uint256 proposalId = governance.propose(vendor, "Test Vendor Ltd", "TEST-0001");
        // Nobody votes, so quorum is never met and voting stays open for the
        // window and the extension.
        vm.warp(block.timestamp + bound(elapsed, 0, 21 days - 1));
        Governance.ProposalState current = governance.state(proposalId);
        assertTrue(
            current == Governance.ProposalState.Open || current == Governance.ProposalState.Extended
        );

        vm.prank(caller);
        vm.expectRevert(abi.encodeWithSelector(Governance.NotBoundOwner.selector, caller));
        governance.castVote(proposalId, inFavour);

        assertEq(governance.tallyOf(proposalId).forVotes, 0);
        assertEq(governance.tallyOf(proposalId).againstVotes, 0);
        assertEq(governance.voterCount(proposalId), 0);
        assertFalse(governance.walletHasVoted(proposalId, caller));
    }

    /// The other half: a bound owner votes, with every unit the register
    /// gives it.
    function test_BoundOwnerVotesWithEveryUnitItHolds() public {
        vm.prank(firm);
        uint256 proposalId = governance.propose(vendor, "Test Vendor Ltd", "TEST-0001");

        vm.prank(alice);
        assertEq(governance.castVote(proposalId, true), 2);

        assertEq(governance.tallyOf(proposalId).forVotes, 2);
        assertTrue(governance.unitHasVoted(proposalId, 1));
        assertTrue(governance.unitHasVoted(proposalId, 2));
        assertEq(governance.voterCount(proposalId), 1);
    }
}
