// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {Governance} from "./Governance.sol";
import {GovernanceLoopSetup} from "./GovernanceLoopSetup.t.sol";
import {Fund} from "./interfaces/IRelease.sol";

/// @notice Issue #57. The firm's attestation, and payment on it: FR25, FR26;
/// ADR-011. The firm attests a passed `Work` proposal once the timelock's 7
/// days have elapsed (behavioural view, R2), and anyone may then execute,
/// which releases the whole limit with no owner step in between (R3, R4).
/// Refusal test B6 (#66) is here too; QAS-11 is #93. Every contract here is
/// the real one.
contract GovernanceAttestTest is GovernanceLoopSetup {
    bytes32 internal constant EVIDENCE = keccak256("photos and invoice: roof repair");

    event WorkAttested(uint256 indexed proposalId, address indexed attester, bytes32 evidenceHash);
    event PaymentReleased(
        Fund indexed fund,
        address indexed payee,
        uint256 amount,
        uint256 proposalId
    );

    function _attest(uint256 proposalId) internal {
        vm.prank(firm);
        governance.attest(proposalId, EVIDENCE);
    }

    // --- FR25: attestation releases payment ----------------------------------

    /// The loop end to end: attest, then anyone executes, and the vendor is
    /// paid the whole limit from the approved fund.
    function test_AttestThenAnyoneExecutesPaysTheWholeLimit() public {
        uint256 proposalId = _readyWork();
        uint256 operatingBefore = treasury.balanceOf(Fund.Operating);

        vm.expectEmit(address(governance));
        emit WorkAttested(proposalId, firm, EVIDENCE);
        _attest(proposalId);

        assertTrue(governance.attested(proposalId));
        // Attesting pays nothing by itself; execution does.
        assertEq(token.balanceOf(vendor), 0);

        vm.expectEmit(address(treasury));
        emit PaymentReleased(Fund.Operating, vendor, LIMIT, proposalId);
        vm.prank(stranger);
        governance.execute(proposalId);

        assertEq(token.balanceOf(vendor), LIMIT);
        assertEq(treasury.balanceOf(Fund.Operating), operatingBefore - LIMIT);
        assertEq(treasury.released(proposalId), LIMIT);
        assertEq(_state(proposalId), uint8(Governance.ProposalState.Executed));
    }

    /// No waiting period follows attestation: execution in the same block
    /// pays (FR25).
    function test_PaymentNeedsNoWaitAfterAttestation() public {
        uint256 proposalId = _readyWork();
        _attest(proposalId);

        vm.prank(vendor);
        governance.execute(proposalId);

        assertEq(token.balanceOf(vendor), LIMIT);
    }

    // --- Who may attest ------------------------------------------------------

    function testFuzz_AttestRefusesNonFirm(address caller) public {
        vm.assume(caller != firm);
        uint256 proposalId = _readyWork();

        vm.prank(caller);
        vm.expectRevert(abi.encodeWithSelector(Governance.NotFirm.selector, caller));
        governance.attest(proposalId, EVIDENCE);
    }

    // --- Refusal test B6: attestation cannot manufacture an approval --------

    /// B6 (spec §7), FR26. However a work proposal fails to pass — nobody
    /// votes, a majority votes against, the vote ties, or a majority is for it
    /// but the window is still open — and at any moment from its creation to
    /// more than a year later, the firm's attestation is refused with
    /// `NotPassed`, a named error of its own (NFR9), and nothing is paid. It
    /// replaces the two hand-picked never-passed tests from #57.
    function testFuzz_AttestOnProposalNeverPassedReverts(uint8 outcome, uint256 elapsed) public {
        uint256 proposalId = _workProposal();
        outcome = uint8(bound(outcome, 0, 3));
        if (outcome == 1) {
            // Majority against: alice's 2 units against, bob's 1 for.
            _vote(proposalId, alice, false);
            _vote(proposalId, bob, true);
        } else if (outcome == 2) {
            // A tie: alice's 2 units for, bob's and carol's 2 against.
            _vote(proposalId, alice, true);
            _vote(proposalId, bob, false);
            _vote(proposalId, carol, false);
        } else if (outcome == 3) {
            // A majority for, asked before the 14-day window has closed.
            _vote(proposalId, alice, true);
            _vote(proposalId, bob, true);
        }
        uint256 latest = outcome == 3 ? 14 days - 1 : 400 days;
        vm.warp(block.timestamp + bound(elapsed, 0, latest));

        Governance.ProposalState current = governance.state(proposalId);
        assertTrue(current != Governance.ProposalState.Passed);

        vm.prank(firm);
        vm.expectRevert(abi.encodeWithSelector(Governance.NotPassed.selector, proposalId, current));
        governance.attest(proposalId, EVIDENCE);

        assertFalse(governance.attested(proposalId));
        assertEq(token.balanceOf(vendor), 0);
        assertEq(treasury.released(proposalId), 0);
    }

    function _vote(uint256 proposalId, address voter, bool inFavour) internal {
        vm.prank(voter);
        governance.castVote(proposalId, inFavour);
    }

    // --- R2: attestation sits after the timelock -----------------------------

    function test_AttestRefusesPassedProposalNotYetQueued() public {
        uint256 proposalId = _passedWork();

        vm.prank(firm);
        vm.expectRevert(
            abi.encodeWithSelector(
                Governance.NotQueued.selector,
                proposalId,
                Governance.ProposalState.Passed
            )
        );
        governance.attest(proposalId, EVIDENCE);
    }

    function testFuzz_AttestRefusesBeforeTheDelayElapses(uint256 elapsed) public {
        elapsed = bound(elapsed, 0, 7 days - 1);
        uint256 proposalId = _passedWork();
        uint256 eta = governance.queue(proposalId);
        vm.warp(block.timestamp + elapsed);

        vm.prank(firm);
        vm.expectRevert(abi.encodeWithSelector(Governance.NotReady.selector, proposalId, eta));
        governance.attest(proposalId, EVIDENCE);
    }

    // --- What may be attested ------------------------------------------------

    function test_AttestRefusesAdmitProposal() public {
        uint256 proposalId = _passedAdmit();
        vm.warp(governance.queue(proposalId));

        vm.prank(firm);
        vm.expectRevert(abi.encodeWithSelector(Governance.NotWorkProposal.selector, proposalId));
        governance.attest(proposalId, EVIDENCE);
    }

    /// One release per proposal, so one attestation — before payment and after.
    function test_AttestRefusesSecondAttestation() public {
        uint256 proposalId = _readyWork();
        _attest(proposalId);

        vm.prank(firm);
        vm.expectRevert(abi.encodeWithSelector(Governance.AlreadyAttested.selector, proposalId));
        governance.attest(proposalId, EVIDENCE);

        governance.execute(proposalId);

        vm.prank(firm);
        vm.expectRevert(abi.encodeWithSelector(Governance.AlreadyAttested.selector, proposalId));
        governance.attest(proposalId, EVIDENCE);
    }

    function test_AttestRefusesZeroEvidenceHash() public {
        uint256 proposalId = _readyWork();

        vm.prank(firm);
        vm.expectRevert(Governance.EvidenceHashIsZero.selector);
        governance.attest(proposalId, bytes32(0));
    }

    function test_AttestRefusesUnknownProposal() public {
        vm.prank(firm);
        vm.expectRevert(abi.encodeWithSelector(Governance.UnknownProposal.selector, 42));
        governance.attest(42, EVIDENCE);
    }
}
