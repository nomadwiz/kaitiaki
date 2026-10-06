// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {Governance} from "./Governance.sol";
import {LevyLedger} from "./LevyLedger.sol";
import {MembershipRegistry} from "./MembershipRegistry.sol";
import {PayeeRegistry} from "./PayeeRegistry.sol";
import {Treasury} from "./Treasury.sol";
import {MockNZD} from "./MockNZD.sol";
import {Fund, IRelease} from "./interfaces/IRelease.sol";

/// @notice Issue #68. Scenario tests: the loop end to end, in the 40-unit
/// reference building, on all six real contracts wired as they are deployed
/// (doc/design/spec.md §4, §7). Where the refusal tests each prove one guard,
/// these run the system as a building would use it: levies in, a vote, the
/// timelock, the firm's attestation, a payment out. FR5–FR8, FR16–FR22, FR25,
/// FR35; NFR5. Time moves with `vm.warp`, so a loop that takes six weeks on a
/// real network runs here in one test.
contract LoopScenariosTest is Test {
    MockNZD internal token;
    MembershipRegistry internal members;
    PayeeRegistry internal payees;
    Treasury internal treasury;
    LevyLedger internal ledger;
    Governance internal governance;
    TimelockController internal timelock;

    address internal firm = makeAddr("firm");
    address internal roofer = makeAddr("roofer");
    address internal stranger = makeAddr("stranger");
    address internal alice = makeAddr("alice"); // units 1–8
    address internal bob = makeAddr("bob"); // unit 9
    address internal carol = makeAddr("carol"); // unit 10
    address internal dave = makeAddr("dave"); // units 11–20
    address internal others = makeAddr("others"); // units 21–40

    uint256 internal constant UNITS = 40;
    uint256 internal constant LEVY = 1_000e18; // per unit, one charge each
    uint256 internal constant ROOF_LIMIT = 5_000e18;
    bytes32 internal constant QUOTE = keccak256("quote: roof repair, 5,000 NZD");
    bytes32 internal constant EVIDENCE = keccak256("photos and invoice: roof repair");

    uint256 internal due;

    function setUp() public {
        token = new MockNZD();
        members = new MembershipRegistry(address(this));
        _bind(alice, 1, 8);
        _bind(bob, 9, 9);
        _bind(carol, 10, 10);
        _bind(dave, 11, 20);
        _bind(others, 21, 40);

        // One levy charge per unit, all due in a week. Charge i is unit i + 1's.
        due = block.timestamp + 7 days;
        uint256[] memory unitIds = new uint256[](UNITS);
        uint256[] memory amounts = new uint256[](UNITS);
        uint256[] memory dueDates = new uint256[](UNITS);
        for (uint256 i = 0; i < UNITS; ++i) {
            (unitIds[i], amounts[i], dueDates[i]) = (i + 1, LEVY, due);
        }

        // Two construction cycles — Treasury and LevyLedger, Governance and
        // the timelock — so three addresses are worked out from this
        // contract's nonce before anything is deployed.
        uint64 nonce = vm.getNonce(address(this));
        address ledgerAt = vm.computeCreateAddress(address(this), nonce + 2);
        address governanceAt = vm.computeCreateAddress(address(this), nonce + 3);
        address timelockAt = vm.computeCreateAddress(address(this), nonce + 4);

        payees = new PayeeRegistry(timelockAt);
        treasury = new Treasury(
            8_000,
            governanceAt,
            timelockAt,
            ledgerAt,
            address(payees),
            address(token)
        );
        ledger = new LevyLedger(address(treasury), unitIds, amounts, dueDates);
        governance = new Governance(
            firm,
            payees,
            members,
            TimelockController(payable(timelockAt)),
            IRelease(address(treasury))
        );
        address[] memory onlyGovernance = new address[](1);
        onlyGovernance[0] = address(governance);
        timelock = new TimelockController(7 days, onlyGovernance, onlyGovernance, address(0));

        assertEq(address(ledger), ledgerAt);
        assertEq(address(governance), governanceAt);
        assertEq(address(timelock), timelockAt);
    }

    // --- Steps of the loop ---------------------------------------------------

    function _bind(address owner, uint256 first, uint256 last) internal {
        for (uint256 unitId = first; unitId <= last; ++unitId) members.bindUnit(unitId, owner);
    }

    /// Anyone issues every charge once it is due (FR5, FR6).
    function _issueAll() internal {
        vm.warp(due);
        uint256[] memory ids = new uint256[](UNITS);
        for (uint256 i = 0; i < UNITS; ++i) ids[i] = i;
        vm.prank(stranger);
        ledger.issueCharges(ids);
    }

    /// `owner` pays the charges of units `first` to `last` (FR7).
    function _pay(address owner, uint256 first, uint256 last) internal {
        uint256 total = (last - first + 1) * LEVY;
        token.mint(owner, total);
        vm.startPrank(owner);
        token.approve(address(ledger), total);
        for (uint256 unitId = first; unitId <= last; ++unitId) ledger.payLevy(unitId - 1);
        vm.stopPrank();
    }

    /// The whole building pays this cycle's levies.
    function _collectLevies() internal {
        _issueAll();
        _pay(alice, 1, 8);
        _pay(bob, 9, 9);
        _pay(carol, 10, 10);
        _pay(dave, 11, 20);
        _pay(others, 21, 40);
    }

    function _vote(address owner, uint256 proposalId, bool inFavour) internal {
        vm.prank(owner);
        governance.castVote(proposalId, inFavour);
    }

    /// Alice and Dave vote for: 18 units of 40, two wallets, so quorum is met.
    function _ownersApprove(uint256 proposalId) internal {
        _vote(alice, proposalId, true);
        _vote(dave, proposalId, true);
    }

    function _windowCloses(uint256 proposalId) internal {
        vm.warp(governance.proposal(proposalId).createdAt + 14 days);
    }

    /// Anyone queues a passed proposal and waits out the timelock.
    function _queueAndWait(uint256 proposalId) internal {
        vm.prank(stranger);
        vm.warp(governance.queue(proposalId));
    }

    /// The owners admit the roofer to the approved list: the first vote.
    function _admitRoofer() internal {
        vm.prank(firm);
        uint256 admissionId = governance.propose(roofer, "Test Vendor Ltd", "TEST-0001");
        _ownersApprove(admissionId);
        _windowCloses(admissionId);
        _queueAndWait(admissionId);
        vm.prank(stranger);
        governance.execute(admissionId);
        assertTrue(payees.isRegistered(roofer));
    }

    function _proposeRoof() internal returns (uint256 proposalId) {
        vm.prank(firm);
        proposalId = governance.propose(
            "Roof repair",
            ROOF_LIMIT,
            Fund.LongTermMaintenance,
            roofer,
            QUOTE
        );
    }

    // --- Scenario 1: a full levy cycle (FR5–FR8) -----------------------------

    /// Charges fall due; a stranger issues them; 39 of 40 units pay; each
    /// receipt is split 80/20 into the operating and long-term maintenance
    /// funds; the one unit that never paid is in arrears once the due date
    /// has passed, and no other unit is.
    function test_FullLevyCycle() public {
        _issueAll();
        _pay(alice, 1, 8);
        _pay(bob, 9, 9);
        _pay(dave, 11, 20);
        _pay(others, 21, 40);
        // Carol never pays for unit 10.

        uint256 collected = 39 * LEVY;
        assertEq(token.balanceOf(address(treasury)), collected);
        assertEq(treasury.balanceOf(Fund.Operating), (collected * 8_000) / 10_000);
        assertEq(treasury.balanceOf(Fund.LongTermMaintenance), (collected * 2_000) / 10_000);

        vm.warp(due + 1);
        assertTrue(ledger.arrearsOf(10));
        for (uint256 unitId = 1; unitId <= UNITS; ++unitId) {
            if (unitId != 10) assertFalse(ledger.arrearsOf(unitId));
        }
    }

    // --- Scenario 2: a proposal from draft to payment (FR16–FR22, FR25; NFR5)

    /// The loop end to end: levies in; the owners admit a roofer; the firm
    /// proposes the roof repair; the owners approve it — the second vote; then
    /// the timelock, the firm's attestation and the payment, with no owner
    /// transaction after that vote (NFR5). Every step after it is taken by
    /// the firm or by a stranger, and the event log over those steps shows no
    /// vote and no owner-attributable event — and the roofer is still paid.
    function test_ProposalFromDraftToPaymentWithNoOwnerActionAfterTheVotes() public {
        _collectLevies();
        uint256 maintenanceBefore = treasury.balanceOf(Fund.LongTermMaintenance);
        _admitRoofer();

        uint256 roofId = _proposeRoof();
        _ownersApprove(roofId); // the second vote

        // From here on, no owner acts.
        vm.recordLogs();
        _windowCloses(roofId);
        _queueAndWait(roofId);
        vm.prank(firm);
        governance.attest(roofId, EVIDENCE);
        vm.prank(stranger);
        governance.execute(roofId);
        Vm.Log[] memory afterVotes = vm.getRecordedLogs();

        assertEq(token.balanceOf(roofer), ROOF_LIMIT);
        assertEq(treasury.balanceOf(Fund.LongTermMaintenance), maintenanceBefore - ROOF_LIMIT);
        assertEq(uint8(governance.state(roofId)), uint8(Governance.ProposalState.Executed));

        bool paid;
        for (uint256 i = 0; i < afterVotes.length; ++i) {
            bytes32 topic = afterVotes[i].topics[0];
            assertTrue(topic != Governance.VoteCast.selector, "no vote after the second vote");
            assertTrue(topic != LevyLedger.LevyPaid.selector, "no owner payment either");
            if (topic == Treasury.PaymentReleased.selector) paid = true;
        }
        assertTrue(paid, "PaymentReleased is in the log");
    }

    // --- Scenario 3: a rejected proposal -------------------------------------

    /// Dave's 10 units against outweigh Alice's 8 for. The proposal fails,
    /// and nothing can move it on: it cannot be queued or attested, and a
    /// year later the treasury still holds every cent.
    function test_RejectedProposalIsNeverPaid() public {
        _collectLevies();
        _admitRoofer();
        uint256 roofId = _proposeRoof();
        uint256 maintenanceBefore = treasury.balanceOf(Fund.LongTermMaintenance);

        _vote(alice, roofId, true);
        _vote(dave, roofId, false);
        _windowCloses(roofId);
        assertEq(uint8(governance.state(roofId)), uint8(Governance.ProposalState.Failed));

        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(
                Governance.NotPassed.selector,
                roofId,
                Governance.ProposalState.Failed
            )
        );
        governance.queue(roofId);

        vm.prank(firm);
        vm.expectRevert(
            abi.encodeWithSelector(
                Governance.NotPassed.selector,
                roofId,
                Governance.ProposalState.Failed
            )
        );
        governance.attest(roofId, EVIDENCE);

        vm.warp(block.timestamp + 365 days);
        assertEq(uint8(governance.state(roofId)), uint8(Governance.ProposalState.Failed));
        assertEq(token.balanceOf(roofer), 0);
        assertEq(treasury.balanceOf(Fund.LongTermMaintenance), maintenanceBefore);
    }

    // --- Scenario 4: a vote from an unbound wallet ---------------------------

    /// A stranger tries to vote in the middle of a real vote. It is refused,
    /// counts for nothing, and the owners' vote carries on and pays as usual.
    function test_UnboundWalletCannotVoteAndTheLoopCarriesOn() public {
        _collectLevies();
        _admitRoofer();
        uint256 roofId = _proposeRoof();

        _vote(alice, roofId, true);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Governance.NotBoundOwner.selector, stranger));
        governance.castVote(roofId, true);
        _vote(dave, roofId, true);

        assertEq(governance.tallyOf(roofId).forVotes, 18);
        assertEq(governance.voterCount(roofId), 2);
        assertFalse(governance.walletHasVoted(roofId, stranger));

        _windowCloses(roofId);
        _queueAndWait(roofId);
        vm.prank(firm);
        governance.attest(roofId, EVIDENCE);
        vm.prank(stranger);
        governance.execute(roofId);
        assertEq(token.balanceOf(roofer), ROOF_LIMIT);
    }

    // --- Scenario 5: one owner, after the quorum extension -------------------

    /// Expected to succeed — the finding in doc/design/sad.md §2.5, not a
    /// defect. Bob, one unit of forty, is the only voter. Quorum is not met,
    /// so the window extends by 7 days; quorum is then waived, and Bob's one
    /// vote passes a 5,000 NZD payment that is queued, attested and paid.
    function test_SingleOwnerPassesAPaymentAfterTheExtension() public {
        _collectLevies();
        _admitRoofer();
        uint256 roofId = _proposeRoof();

        _vote(bob, roofId, true);
        _windowCloses(roofId);
        assertFalse(governance.quorumReached(roofId));
        assertEq(uint8(governance.state(roofId)), uint8(Governance.ProposalState.Extended));

        vm.warp(governance.proposal(roofId).createdAt + 21 days);
        assertEq(uint8(governance.state(roofId)), uint8(Governance.ProposalState.Passed));

        _queueAndWait(roofId);
        vm.prank(firm);
        governance.attest(roofId, EVIDENCE);
        vm.prank(stranger);
        governance.execute(roofId);

        assertEq(token.balanceOf(roofer), ROOF_LIMIT);
        assertEq(governance.tallyOf(roofId).forVotes, 1);
    }
}
