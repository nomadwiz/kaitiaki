// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {Test} from "forge-std/Test.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {Governance} from "./Governance.sol";
import {IRelease} from "./interfaces/IRelease.sol";
import {PayeeRegistryStub} from "./stubs/PayeeRegistryStub.sol";
import {MembershipRegistryStub} from "./stubs/MembershipRegistryStub.sol";
import {LevyLedgerStub} from "./stubs/LevyLedgerStub.sol";

/// @notice Issue #55. FR20: the 14-day window, quorum, the 7-day extension and
/// the waiver (doc/design/spec.md §5; ADR-003, amendment of 30-09-2026). Set in
/// the reference building — 40 principal units, so quorum is 10 units cast by
/// at least two wallets.
contract GovernanceQuorumTest is Test {
    Governance internal governance;
    PayeeRegistryStub internal payees;
    MembershipRegistryStub internal members;

    address internal firm = makeAddr("firm");
    address internal vendor = makeAddr("vendor");
    address internal alice = makeAddr("alice"); // units 1–8
    address internal bob = makeAddr("bob"); // unit 9
    address internal carol = makeAddr("carol"); // unit 10
    address internal dave = makeAddr("dave"); // units 11–20
    address internal others = makeAddr("others"); // units 21–40

    uint256 internal proposalId;
    uint256 internal start;

    function setUp() public {
        payees = new PayeeRegistryStub();
        members = new MembershipRegistryStub();
        LevyLedgerStub levies = new LevyLedgerStub();
        TimelockController timelock = new TimelockController(
            7 days,
            new address[](0),
            new address[](0),
            address(0)
        );
        governance = new Governance(
            firm,
            payees,
            members,
            levies,
            timelock,
            IRelease(makeAddr("treasury"))
        );

        _bind(alice, 1, 8);
        _bind(bob, 9, 9);
        _bind(carol, 10, 10);
        _bind(dave, 11, 20);
        _bind(others, 21, 40);

        start = block.timestamp;
        vm.prank(firm);
        proposalId = governance.propose(vendor, "Test Vendor Ltd", "TEST-0001");
    }

    function _bind(address holder, uint256 first, uint256 last) internal {
        for (uint256 unitId = first; unitId <= last; ++unitId) members.bindUnit(unitId, holder);
    }

    function _vote(address voter, bool inFavour) internal {
        vm.prank(voter);
        governance.castVote(proposalId, inFavour);
    }

    function _state() internal view returns (Governance.ProposalState) {
        return governance.state(proposalId);
    }

    // --- Parameters (spec §5) ------------------------------------------------

    function test_ParametersAreTheStatutoryValues() public view {
        assertEq(governance.VOTING_PERIOD(), 14 days);
        assertEq(governance.EXTENSION(), 7 days);
        assertEq(governance.QUORUM_UNIT_DIVISOR(), 4);
        assertEq(governance.QUORUM_MIN_VOTERS(), 2);
    }

    // --- The quorum denominator ----------------------------------------------

    function test_PrincipalUnitsStoredAtCreation() public view {
        assertEq(governance.proposal(proposalId).principalUnits, 40);
    }

    /// A unit bound after the proposal was raised votes, but does not raise
    /// the bar quorum is measured against.
    function test_UnitBoundLaterVotesButDoesNotMoveDenominator() public {
        members.bindUnit(41, bob);

        _vote(bob, true);

        assertEq(governance.proposal(proposalId).principalUnits, 40);
        assertEq(governance.tallyOf(proposalId).forVotes, 2);
    }

    // --- Quorum: 25% of principal units ... ----------------------------------

    function test_QuorumNeedsAQuarterOfPrincipalUnits() public {
        _vote(alice, true);
        _vote(bob, true);
        assertFalse(governance.quorumReached(proposalId), "9 of 40 units");

        _vote(carol, true);
        assertTrue(governance.quorumReached(proposalId), "10 of 40 units");
    }

    /// Quorum counts every unit that voted, whichever way it went.
    function test_VotesAgainstCountTowardsQuorum() public {
        _vote(alice, true);
        _vote(bob, false);
        _vote(carol, false);

        assertTrue(governance.quorumReached(proposalId));
    }

    // --- ... and at least two persons ----------------------------------------

    /// One owner holding a quarter of the units cannot make quorum alone
    /// (s 95(1A)).
    function test_QuorumNeedsTwoWallets() public {
        _vote(dave, true);
        assertFalse(governance.quorumReached(proposalId), "10 units, one wallet");

        _vote(bob, true);
        assertTrue(governance.quorumReached(proposalId), "11 units, two wallets");
    }

    /// A wallet that votes again with a unit it gained is still one person.
    function test_WalletCountsOnceTowardsTwoPersons() public {
        _vote(dave, true);
        members.bindUnit(41, dave);
        _vote(dave, true);

        assertEq(governance.voterCount(proposalId), 1);
        assertTrue(governance.walletHasVoted(proposalId, dave));
        assertFalse(governance.quorumReached(proposalId));
    }

    // --- The 14-day window ---------------------------------------------------

    function testFuzz_OpenThroughoutWindow(uint256 elapsed) public {
        elapsed = bound(elapsed, 0, 14 days - 1);
        vm.warp(start + elapsed);

        assertEq(uint8(_state()), uint8(Governance.ProposalState.Open));
        _vote(bob, true);
    }

    function test_PassesWhenWindowClosesWithQuorumAndMajority() public {
        _vote(alice, true);
        _vote(bob, true);
        _vote(carol, false);

        vm.warp(start + 14 days - 1);
        assertEq(uint8(_state()), uint8(Governance.ProposalState.Open));

        vm.warp(start + 14 days);
        assertEq(uint8(_state()), uint8(Governance.ProposalState.Passed));
    }

    function test_FailsWhenMajorityAgainst() public {
        _vote(alice, true);
        _vote(dave, false);

        vm.warp(start + 14 days);
        assertEq(uint8(_state()), uint8(Governance.ProposalState.Failed));
    }

    /// More than 50% of votes cast: a tie is not a majority (s 97(4)).
    function test_TieFails() public {
        _vote(alice, true);
        _vote(bob, true);
        _vote(carol, true);
        _vote(dave, false);
        assertEq(governance.tallyOf(proposalId).forVotes, 10);
        assertEq(governance.tallyOf(proposalId).againstVotes, 10);

        vm.warp(start + 14 days);
        assertEq(uint8(_state()), uint8(Governance.ProposalState.Failed));
    }

    function test_VotingClosesWhenWindowEndsWithQuorum() public {
        _vote(dave, true);
        _vote(bob, true);

        vm.warp(start + 14 days);
        vm.prank(others);
        vm.expectRevert(abi.encodeWithSelector(Governance.VotingClosed.selector, proposalId));
        governance.castVote(proposalId, false);
    }

    // --- The extension, and the waiver ---------------------------------------

    function test_WindowExtendsWithoutQuorum() public {
        _vote(bob, true);

        vm.warp(start + 14 days);
        assertEq(uint8(_state()), uint8(Governance.ProposalState.Extended));
        vm.warp(start + 21 days - 1);
        assertEq(uint8(_state()), uint8(Governance.ProposalState.Extended));

        _vote(carol, true);
        assertEq(governance.tallyOf(proposalId).forVotes, 2);
    }

    /// The finding in doc/design/sad.md §2.5, expected to succeed: after the
    /// waiver one unit of forty passes a proposal nobody else voted on,
    /// whenever in the 21 days it was cast. Not a defect — do not "fix" it.
    function testFuzz_OneUnitPassesAfterExtension(uint256 votedAt) public {
        votedAt = bound(votedAt, 0, 21 days - 1);
        vm.warp(start + votedAt);
        _vote(bob, true);

        vm.warp(start + 21 days);
        assertFalse(governance.quorumReached(proposalId));
        assertEq(uint8(_state()), uint8(Governance.ProposalState.Passed));

        vm.warp(start + 21 days + 365 days);
        assertEq(uint8(_state()), uint8(Governance.ProposalState.Passed), "final");
    }

    /// The waiver lifts quorum, not the need for a vote in favour: an
    /// admission nobody voted on admits nobody (G2).
    function test_NoVotesFailsAfterWaiver() public {
        vm.warp(start + 14 days);
        assertEq(uint8(_state()), uint8(Governance.ProposalState.Extended));

        vm.warp(start + 21 days);
        assertEq(uint8(_state()), uint8(Governance.ProposalState.Failed));
    }

    function test_TieFailsAfterWaiver() public {
        _vote(bob, true);
        _vote(carol, false);

        vm.warp(start + 21 days);
        assertEq(uint8(_state()), uint8(Governance.ProposalState.Failed));
    }

    /// Reaching quorum inside the extension does not end it early: the
    /// window already closed without quorum, so the proposal is decided at
    /// the end of the extension, on every vote cast by then.
    function test_ExtensionRunsItsCourseOnceQuorumReachedInIt() public {
        _vote(bob, true);

        vm.warp(start + 15 days);
        _vote(dave, false);
        assertTrue(governance.quorumReached(proposalId));
        assertEq(uint8(_state()), uint8(Governance.ProposalState.Extended));

        vm.warp(start + 21 days - 1);
        _vote(carol, true);

        vm.warp(start + 21 days);
        assertEq(uint8(_state()), uint8(Governance.ProposalState.Failed), "2 for, 10 against");
    }

    function test_VotingClosesWhenExtensionEnds() public {
        _vote(bob, true);

        vm.warp(start + 21 days);
        vm.prank(carol);
        vm.expectRevert(abi.encodeWithSelector(Governance.VotingClosed.selector, proposalId));
        governance.castVote(proposalId, true);
    }

    // --- Unknown proposals ---------------------------------------------------

    function test_StateOfUnknownProposalReverts() public {
        vm.expectRevert(abi.encodeWithSelector(Governance.UnknownProposal.selector, 42));
        governance.state(42);
    }

    function test_UnknownProposalHasNoQuorum() public view {
        assertFalse(governance.quorumReached(42));
    }
}
