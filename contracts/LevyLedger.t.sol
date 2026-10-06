// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {Test, Vm} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {LevyLedger} from "./LevyLedger.sol";
import {MockNZD} from "./MockNZD.sol";
import {Treasury} from "./Treasury.sol";
import {Fund} from "./interfaces/IRelease.sol";
import {GovernanceStub} from "./stubs/GovernanceStub.sol";
import {MembershipRegistryStub} from "./stubs/MembershipRegistryStub.sol";
import {PayeeRegistryStub} from "./stubs/PayeeRegistryStub.sol";

/// Issues #58 and #173 — FR5, FR7–FR9, ADR-016, ADR-020. Runs against the
/// real Treasury, so a payment is shown reaching both funds through
/// `Treasury.deposit`.
contract LevyLedgerTest is Test {
    event ChargeScheduled(
        uint256 indexed chargeId,
        uint256 indexed unitId,
        uint256 amount,
        uint256 dueDate
    );
    event ChargeIssued(
        uint256 indexed chargeId,
        uint256 indexed unitId,
        uint256 amount,
        uint256 dueDate
    );
    event LevyPaid(
        uint256 indexed chargeId,
        uint256 indexed unitId,
        address indexed payer,
        uint256 amount
    );

    uint256 internal constant DUE = 1_800_000_000;
    uint256 internal constant LATER = DUE + 90 days;

    LevyLedger internal ledger;
    Treasury internal treasury;
    MockNZD internal token;
    MembershipRegistryStub internal members;
    address internal firm = makeAddr("firm");
    /// Unit 1's owner, who has approved the ledger: direct debit is set up.
    address internal owner = makeAddr("owner");
    /// Unit 2's owner, who holds funds but has approved nothing.
    address internal holdout = makeAddr("holdout");
    address internal stranger = makeAddr("stranger");

    function setUp() public {
        token = new MockNZD();
        // Charge 0: unit 1, due DUE. Charge 1: unit 2, due DUE. Charge 2:
        // unit 1 again, due LATER.
        uint256[] memory unitIds = new uint256[](3);
        uint256[] memory amounts = new uint256[](3);
        uint256[] memory dueDates = new uint256[](3);
        (unitIds[0], amounts[0], dueDates[0]) = (1, 1_000e18, DUE);
        (unitIds[1], amounts[1], dueDates[1]) = (2, 500e18, DUE);
        (unitIds[2], amounts[2], dueDates[2]) = (1, 1_000e18, LATER);

        // The construction cycle: Treasury first, naming the ledger's address
        // before it exists (spec §4).
        address governance = address(new GovernanceStub());
        address payees = address(new PayeeRegistryStub());
        members = new MembershipRegistryStub();
        members.bindUnit(1, owner);
        members.bindUnit(2, holdout);
        address predicted = vm.computeCreateAddress(address(this), vm.getNonce(address(this)) + 1);
        treasury = new Treasury(
            8_000,
            governance,
            makeAddr("timelock"),
            predicted,
            payees,
            address(token)
        );
        ledger = new LevyLedger(address(treasury), members, firm, unitIds, amounts, dueDates);
        assertEq(address(ledger), predicted);
        assertEq(treasury.getRoleMember(treasury.DEPOSITOR_ROLE(), 0), address(ledger));

        token.mint(owner, 10_000e18);
        token.mint(holdout, 10_000e18);
        token.mint(stranger, 10_000e18);
        vm.prank(owner);
        token.approve(address(ledger), type(uint256).max);
        vm.prank(stranger);
        token.approve(address(ledger), type(uint256).max);
    }

    function _ids(uint256 a) internal pure returns (uint256[] memory ids) {
        ids = new uint256[](1);
        ids[0] = a;
    }

    function _collect(uint256 chargeId) internal {
        vm.prank(firm);
        ledger.collect(_ids(chargeId));
    }

    function _paid(uint256 chargeId) internal view returns (bool paid) {
        (, , , , paid) = ledger.charges(chargeId);
    }

    // --- Construction ---

    function test_ReadsTheSettlementAssetFromTreasury() public view {
        assertEq(address(ledger.settlementAsset()), address(token));
        assertEq(address(ledger.members()), address(members));
        assertEq(ledger.firm(), firm);
        (uint256 unitId, uint256 amount, uint256 dueDate, bool issued, bool paid) = ledger.charges(
            2
        );
        assertEq(unitId, 1);
        assertEq(amount, 1_000e18);
        assertEq(dueDate, LATER);
        assertFalse(issued);
        assertFalse(paid);
    }

    function test_RejectsZeroTreasury() public {
        vm.expectRevert(LevyLedger.TreasuryIsZero.selector);
        new LevyLedger(address(0), members, firm, new uint256[](0), new uint256[](0), new uint256[](0));
    }

    function test_RejectsZeroMembershipRegistry() public {
        vm.expectRevert(LevyLedger.MembershipRegistryIsZero.selector);
        new LevyLedger(
            address(treasury),
            MembershipRegistryStub(address(0)),
            firm,
            new uint256[](0),
            new uint256[](0),
            new uint256[](0)
        );
    }

    function test_RejectsZeroFirm() public {
        vm.expectRevert(LevyLedger.FirmIsZero.selector);
        new LevyLedger(
            address(treasury),
            members,
            address(0),
            new uint256[](0),
            new uint256[](0),
            new uint256[](0)
        );
    }

    function test_RejectsScheduleOfUnequalLengths() public {
        vm.expectRevert(
            abi.encodeWithSelector(LevyLedger.ScheduleLengthMismatch.selector, 1, 2, 1)
        );
        new LevyLedger(
            address(treasury),
            members,
            firm,
            new uint256[](1),
            new uint256[](2),
            new uint256[](1)
        );
    }

    function test_ConstructionEmitsOneChargeScheduledPerCharge() public {
        uint256[] memory unitIds = new uint256[](3);
        uint256[] memory amounts = new uint256[](3);
        uint256[] memory dueDates = new uint256[](3);
        (unitIds[0], amounts[0], dueDates[0]) = (1, 1_000e18, DUE);
        (unitIds[1], amounts[1], dueDates[1]) = (2, 500e18, DUE);
        (unitIds[2], amounts[2], dueDates[2]) = (1, 1_000e18, LATER);
        address predicted = vm.computeCreateAddress(address(this), vm.getNonce(address(this)));
        for (uint256 i = 0; i < 3; ++i) {
            vm.expectEmit(predicted);
            emit ChargeScheduled(i, unitIds[i], amounts[i], dueDates[i]);
        }
        new LevyLedger(address(treasury), members, firm, unitIds, amounts, dueDates);
    }

    // --- collect: FR5, B1, ADR-020 ---

    /// Refusal B1 (spec §7): nobody may collect early. The firm, at any moment
    /// before the due date, is refused with its own named error (NFR9).
    function testFuzz_CollectingBeforeTheDueDateReverts(uint256 timestamp) public {
        vm.warp(bound(timestamp, 0, DUE - 1));
        vm.expectRevert(abi.encodeWithSelector(LevyLedger.ChargeNotDue.selector, 0, DUE));
        _collect(0);
    }

    /// ADR-020: only the firm collects, even once the charge is due.
    function testFuzz_OnlyTheFirmCollects(address caller) public {
        vm.assume(caller != firm);
        vm.warp(DUE);
        vm.expectRevert(abi.encodeWithSelector(LevyLedger.NotFirm.selector, caller));
        vm.prank(caller);
        ledger.collect(_ids(0));
    }

    function test_CollectingPullsFromTheBoundOwnerAndCreditsTheUnit() public {
        vm.warp(DUE);
        vm.expectEmit(address(ledger));
        emit ChargeIssued(0, 1, 1_000e18, DUE);
        vm.expectEmit(address(ledger));
        emit LevyPaid(0, 1, owner, 1_000e18);
        _collect(0);

        assertTrue(_paid(0));
        assertEq(token.balanceOf(owner), 9_000e18);
        assertEq(treasury.balanceOf(Fund.Operating), 800e18);
        assertEq(treasury.balanceOf(Fund.LongTermMaintenance), 200e18);
        vm.warp(DUE + 1);
        assertFalse(ledger.arrearsOf(1));
    }

    function test_CollectingWithoutApprovalIssuesAndTakesNothing() public {
        vm.warp(DUE);
        vm.recordLogs();
        _collect(1);

        assertEq(vm.getRecordedLogs().length, 1, "ChargeIssued only");
        (, , , bool issued, bool paid) = ledger.charges(1);
        assertTrue(issued);
        assertFalse(paid);
        assertEq(token.balanceOf(holdout), 10_000e18);
        vm.warp(DUE + 1);
        assertTrue(ledger.arrearsOf(2));
    }

    function test_CollectingWithTooLittleBalanceIssuesAndTakesNothing() public {
        vm.prank(owner);
        token.transfer(stranger, 9_500e18);
        vm.warp(DUE);
        _collect(0);

        assertFalse(_paid(0));
        assertEq(token.balanceOf(owner), 500e18);
        vm.warp(DUE + 1);
        assertTrue(ledger.arrearsOf(1));
    }

    function test_ARetryAfterApprovalPaysWithoutIssuingAgain() public {
        vm.warp(DUE);
        _collect(1);
        vm.prank(holdout);
        token.approve(address(ledger), 500e18);

        vm.warp(DUE + 1 days);
        vm.recordLogs();
        _collect(1);

        assertTrue(_paid(1));
        assertFalse(ledger.arrearsOf(2));
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i = 0; i < logs.length; ++i) {
            assertTrue(logs[i].topics[0] != ChargeIssued.selector, "issued once");
        }
    }

    function test_OneChargeNotDueRevertsTheWholeBatch() public {
        vm.warp(DUE);
        uint256[] memory ids = new uint256[](2);
        (ids[0], ids[1]) = (0, 2);
        vm.expectRevert(abi.encodeWithSelector(LevyLedger.ChargeNotDue.selector, 2, LATER));
        vm.prank(firm);
        ledger.collect(ids);
    }

    /// ADR-020: an owner who paid early does not block the firm's batch.
    function test_CollectingSkipsAPaidChargeAndCollectsTheRest() public {
        vm.prank(owner);
        ledger.payLevy(0);
        vm.prank(holdout);
        token.approve(address(ledger), 500e18);
        vm.warp(DUE);
        uint256[] memory ids = new uint256[](2);
        (ids[0], ids[1]) = (0, 1);
        vm.recordLogs();
        vm.prank(firm);
        ledger.collect(ids);

        (, , , bool issued, ) = ledger.charges(0);
        assertFalse(issued, "the paid charge is left alone");
        assertTrue(_paid(1));
        assertEq(token.balanceOf(owner), 9_000e18, "paid once, by hand");
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i = 0; i < logs.length; ++i) {
            if (logs[i].emitter == address(ledger) && logs[i].topics[0] == ChargeIssued.selector) {
                assertEq(uint256(logs[i].topics[1]), 1, "only charge 1 is issued");
            }
        }
    }

    function test_CollectingAnUnknownChargeReverts() public {
        vm.expectRevert(abi.encodeWithSelector(LevyLedger.UnknownCharge.selector, 3));
        _collect(3);
    }

    // --- payLevy: FR7, FR8, ADR-016 ---

    function test_ThirdPartyPaymentCreditsTheUnitAndSplitsAcrossFunds() public {
        vm.warp(DUE);

        vm.expectEmit(address(ledger));
        emit LevyPaid(0, 1, stranger, 1_000e18);
        vm.prank(stranger);
        ledger.payLevy(0);

        (, , , , bool paid) = ledger.charges(0);
        assertTrue(paid);
        assertEq(treasury.balanceOf(Fund.Operating), 800e18);
        assertEq(treasury.balanceOf(Fund.LongTermMaintenance), 200e18);
        assertEq(token.balanceOf(address(treasury)), 1_000e18);
        assertEq(token.balanceOf(address(ledger)), 0);
        assertEq(token.allowance(address(ledger), address(treasury)), 0);
        assertEq(token.balanceOf(stranger), 9_000e18);
    }

    function test_AChargeMayBePaidBeforeItIsIssued() public {
        vm.warp(DUE - 7 days);
        vm.prank(owner);
        ledger.payLevy(0);

        vm.warp(DUE + 1);
        assertFalse(ledger.arrearsOf(1));
        (, , , bool issued, ) = ledger.charges(0);
        assertFalse(issued, "the firm has nothing left to collect");
    }

    function test_PayingTwiceReverts() public {
        vm.prank(owner);
        ledger.payLevy(1);
        vm.expectRevert(abi.encodeWithSelector(LevyLedger.ChargeAlreadyPaid.selector, 1));
        vm.prank(stranger);
        ledger.payLevy(1);
    }

    function test_PayingAnUnknownChargeReverts() public {
        vm.expectRevert(abi.encodeWithSelector(LevyLedger.UnknownCharge.selector, 3));
        vm.prank(owner);
        ledger.payLevy(3);
    }

    function test_PaymentRejectsAFailedTransfer() public {
        vm.mockCall(
            address(token),
            abi.encodeWithSelector(IERC20.transferFrom.selector, owner, address(ledger), 1_000e18),
            abi.encode(false)
        );
        vm.expectRevert(
            abi.encodeWithSelector(LevyLedger.LevyTransferFailed.selector, owner, 1_000e18)
        );
        vm.prank(owner);
        ledger.payLevy(0);
    }

    function test_PaymentRejectsAFailedApproval() public {
        vm.mockCall(
            address(token),
            abi.encodeWithSelector(IERC20.approve.selector, address(treasury), 1_000e18),
            abi.encode(false)
        );
        vm.expectRevert(
            abi.encodeWithSelector(LevyLedger.TreasuryApprovalFailed.selector, 1_000e18)
        );
        vm.prank(owner);
        ledger.payLevy(0);
    }

    // --- arrearsOf: FR9, ADR-016 ---

    /// A failed collection, then the owner pays by hand: `payLevy` clears it.
    function test_ArrearsBeginsOnlyAfterTheDueDate() public {
        vm.warp(DUE);
        _collect(1);
        assertFalse(ledger.arrearsOf(2), "on time at the due date itself");

        vm.warp(DUE + 1);
        assertTrue(ledger.arrearsOf(2));
        assertFalse(ledger.arrearsOf(1), "unit 1's charge is not collected");

        vm.prank(stranger);
        ledger.payLevy(1);
        assertFalse(ledger.arrearsOf(2), "resolved by payment");
    }

    /// ADR-020's admitted gap: a charge the firm never collects is never
    /// arrears, however late.
    function test_AChargeNobodyCollectedIsNeverInArrears() public {
        vm.warp(LATER + 365 days);
        assertFalse(ledger.arrearsOf(1));
        assertFalse(ledger.arrearsOf(2));
    }

    function test_OneUnpaidChargeKeepsTheUnitInArrears() public {
        vm.prank(owner);
        ledger.payLevy(0);
        vm.prank(owner);
        token.transfer(stranger, 9_000e18);
        vm.warp(LATER);
        _collect(2);
        vm.warp(LATER + 1);
        assertTrue(ledger.arrearsOf(1), "charge 2 is unpaid");
    }
}
