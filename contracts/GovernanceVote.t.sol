// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {Test} from "forge-std/Test.sol";
import {Governance} from "./Governance.sol";
import {Fund} from "./interfaces/IRelease.sol";
import {PayeeRegistryStub} from "./stubs/PayeeRegistryStub.sol";
import {MembershipRegistryStub} from "./stubs/MembershipRegistryStub.sol";

/// @notice Issue #54. Voting: FR2 (only bound wallets vote), FR19 (weight is
/// units held), one vote per unit per proposal (ADR-003). The refusal test B8
/// itself is issue #67; the unbound-wallet case here only proves the guard.
contract GovernanceVoteTest is Test {
    Governance internal governance;
    PayeeRegistryStub internal payees;
    MembershipRegistryStub internal members;

    address internal firm = makeAddr("firm");
    address internal vendor = makeAddr("vendor");
    address internal alice = makeAddr("alice"); // owns units 1 and 2
    address internal bob = makeAddr("bob"); // owns unit 3
    address internal stranger = makeAddr("stranger");

    uint256 internal proposalId;

    event VoteCast(
        uint256 indexed proposalId,
        address indexed voter,
        bool inFavour,
        uint256 weight,
        uint256[] unitIds
    );

    function setUp() public {
        payees = new PayeeRegistryStub();
        members = new MembershipRegistryStub();
        governance = new Governance(firm, payees, members);

        members.bindUnit(1, alice);
        members.bindUnit(2, alice);
        members.bindUnit(3, bob);

        vm.prank(firm);
        proposalId = governance.propose(vendor);
    }

    // --- FR2: only bound wallets vote ----------------------------------------

    function test_BoundOwnerVotes() public {
        vm.prank(bob);
        uint256 weight = governance.castVote(proposalId, true);

        assertEq(weight, 1);
        assertTrue(governance.unitHasVoted(proposalId, 3));
        assertEq(governance.tallyOf(proposalId).forVotes, 1);
        assertEq(governance.tallyOf(proposalId).againstVotes, 0);
    }

    function test_UnboundWalletRefused() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Governance.NotBoundOwner.selector, stranger));
        governance.castVote(proposalId, true);
    }

    /// Eligibility is `isOwner`, not merely appearing in `unitsOf`: a wallet
    /// whose unit has been rebound to someone else no longer votes with it.
    function test_UnitRebindMovesTheVote() public {
        members.bindUnit(3, alice); // unit 3 now belongs to alice

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(Governance.NotBoundOwner.selector, bob));
        governance.castVote(proposalId, true);

        vm.prank(alice);
        assertEq(governance.castVote(proposalId, true), 3);
    }

    // --- FR19: weight is the number of units held ----------------------------

    function test_WeightIsUnitsHeld() public {
        vm.prank(alice);
        assertEq(governance.castVote(proposalId, false), 2);

        vm.prank(bob);
        governance.castVote(proposalId, true);

        Governance.Tally memory t = governance.tallyOf(proposalId);
        assertEq(t.forVotes, 1);
        assertEq(t.againstVotes, 2);
    }

    // --- One vote per unit per proposal --------------------------------------

    function test_SecondVoteRefused() public {
        vm.startPrank(alice);
        governance.castVote(proposalId, true);
        vm.expectRevert(
            abi.encodeWithSelector(Governance.AlreadyVoted.selector, proposalId, alice)
        );
        governance.castVote(proposalId, false);
        vm.stopPrank();
    }

    /// A unit that has voted keeps its vote when it changes hands: the new
    /// owner cannot vote with it again.
    function test_TransferredUnitCannotVoteTwice() public {
        vm.prank(bob);
        governance.castVote(proposalId, true);

        address carol = makeAddr("carol");
        members.bindUnit(3, carol);

        vm.prank(carol);
        vm.expectRevert(
            abi.encodeWithSelector(Governance.AlreadyVoted.selector, proposalId, carol)
        );
        governance.castVote(proposalId, false);
    }

    /// A wallet that gains an unvoted unit after voting may vote with that
    /// unit only.
    function test_NewlyAcquiredUnitVotesOnce() public {
        vm.prank(alice);
        governance.castVote(proposalId, true);

        members.bindUnit(4, alice);
        vm.prank(alice);
        assertEq(governance.castVote(proposalId, true), 1);
        assertEq(governance.tallyOf(proposalId).forVotes, 3);
    }

    /// A unit listed twice by the register still carries one vote.
    function test_DuplicateUnitEntryCountsOnce() public {
        members.bindUnit(3, bob); // unitsOf(bob) is now [3, 3]

        vm.prank(bob);
        assertEq(governance.castVote(proposalId, true), 1);
        assertEq(governance.tallyOf(proposalId).forVotes, 1);
    }

    /// The vote belongs to the unit: one wallet may appear in the log voting
    /// both ways, with different units (review of #89).
    function test_WalletMayVoteBothWaysWithDifferentUnits() public {
        vm.prank(alice);
        governance.castVote(proposalId, true); // units 1, 2

        members.bindUnit(4, alice);
        vm.prank(alice);
        governance.castVote(proposalId, false); // unit 4

        Governance.Tally memory t = governance.tallyOf(proposalId);
        assertEq(t.forVotes, 2);
        assertEq(t.againstVotes, 1);
    }

    function test_VotesAreSeparatePerProposal() public {
        payees.admit(vendor);
        vm.prank(firm);
        uint256 work = governance.propose("Roof", 1e18, Fund.Operating, vendor, bytes32(0));

        vm.startPrank(bob);
        governance.castVote(proposalId, true);
        assertEq(governance.castVote(work, false), 1);
        vm.stopPrank();
    }

    // --- Proposal must exist -------------------------------------------------

    function test_UnknownProposalRefused() public {
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(Governance.UnknownProposal.selector, 99));
        governance.castVote(99, true);
    }

    // --- Event ---------------------------------------------------------------

    function test_VoteCastCarriesWalletDirectionAndUnits() public {
        uint256[] memory units = new uint256[](2);
        units[0] = 1;
        units[1] = 2;

        vm.expectEmit(address(governance));
        emit VoteCast(proposalId, alice, false, 2, units);
        vm.prank(alice);
        governance.castVote(proposalId, false);
    }
}
