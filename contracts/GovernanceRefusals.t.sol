// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {Governance} from "./Governance.sol";
import {GovernanceLoopSetup} from "./GovernanceLoopSetup.t.sol";
import {Fund} from "./interfaces/IRelease.sol";

/// @notice Refusal tests on `Governance`'s own checks (spec §7), on the real
/// contracts: B2 (#61). B6 sits with the attestation tests in
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
        uint256 admissionId = governance.propose(candidate);
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
    /// `Treasury.release` checks again at payment time (B2′). Replaces the
    /// hand-picked `test_ProposeWorkRefusesUnregisteredVendor` from #53.
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
}
