// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {LevyLedger} from "./LevyLedger.sol";
import {MockNZD} from "./MockNZD.sol";
import {Treasury} from "./Treasury.sol";
import {Fund} from "./interfaces/IRelease.sol";
import {GovernanceStub} from "./stubs/GovernanceStub.sol";
import {PayeeRegistryStub} from "./stubs/PayeeRegistryStub.sol";

/// Issue #58 — FR5–FR9, NFR7, ADR-016. Runs against the real Treasury, so a
/// payment is shown reaching both funds through `Treasury.deposit`.
contract LevyLedgerTest is Test {
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
    address internal owner = makeAddr("owner");
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
        address predicted = vm.computeCreateAddress(address(this), vm.getNonce(address(this)) + 1);
        treasury = new Treasury(
            8_000,
            governance,
            makeAddr("timelock"),
            predicted,
            payees,
            address(token)
        );
        ledger = new LevyLedger(address(treasury), unitIds, amounts, dueDates);
        assertEq(address(ledger), predicted);
        assertEq(treasury.getRoleMember(treasury.DEPOSITOR_ROLE(), 0), address(ledger));

        token.mint(owner, 10_000e18);
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

    // --- Construction ---

    function test_ReadsTheSettlementAssetFromTreasury() public view {
        assertEq(address(ledger.settlementAsset()), address(token));
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
        new LevyLedger(address(0), new uint256[](0), new uint256[](0), new uint256[](0));
    }

    function test_RejectsScheduleOfUnequalLengths() public {
        vm.expectRevert(
            abi.encodeWithSelector(LevyLedger.ScheduleLengthMismatch.selector, 1, 2, 1)
        );
        new LevyLedger(address(treasury), new uint256[](1), new uint256[](2), new uint256[](1));
    }

    // --- issueCharges: FR5, FR6, B1 ---

    /// Refusal B1 (spec §7): permissionless triggering is safe. Any caller, at
    /// any moment before the due date, is refused with its own named error
    /// (NFR9); `test_AnyCallerIssuesOnTheDueDate` is the other half.
    function testFuzz_IssuingBeforeTheDueDateReverts(address caller, uint256 timestamp) public {
        vm.warp(bound(timestamp, 0, DUE - 1));
        vm.expectRevert(abi.encodeWithSelector(LevyLedger.ChargeNotDue.selector, 0, DUE));
        vm.prank(caller);
        ledger.issueCharges(_ids(0));
    }

    function test_AnyCallerIssuesOnTheDueDate() public {
        vm.warp(DUE);
        uint256[] memory ids = new uint256[](2);
        (ids[0], ids[1]) = (0, 1);

        vm.expectEmit(address(ledger));
        emit ChargeIssued(0, 1, 1_000e18, DUE);
        vm.expectEmit(address(ledger));
        emit ChargeIssued(1, 2, 500e18, DUE);
        vm.prank(stranger);
        ledger.issueCharges(ids);

        (, , , bool issued, ) = ledger.charges(1);
        assertTrue(issued);
    }

    function test_OneChargeNotDueRevertsTheWholeBatch() public {
        vm.warp(DUE);
        uint256[] memory ids = new uint256[](2);
        (ids[0], ids[1]) = (0, 2);
        vm.expectRevert(abi.encodeWithSelector(LevyLedger.ChargeNotDue.selector, 2, LATER));
        ledger.issueCharges(ids);
    }

    function test_IssuingTwiceReverts() public {
        vm.warp(DUE);
        ledger.issueCharges(_ids(0));
        vm.expectRevert(abi.encodeWithSelector(LevyLedger.ChargeAlreadyIssued.selector, 0));
        ledger.issueCharges(_ids(0));
    }

    function test_IssuingAnUnknownChargeReverts() public {
        vm.expectRevert(abi.encodeWithSelector(LevyLedger.UnknownCharge.selector, 3));
        ledger.issueCharges(_ids(3));
    }

    // --- payLevy: FR7, FR8, ADR-016 ---

    function test_ThirdPartyPaymentCreditsTheUnitAndSplitsAcrossFunds() public {
        vm.warp(DUE);
        ledger.issueCharges(_ids(0));

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
        ledger.issueCharges(_ids(0));
        assertFalse(ledger.arrearsOf(1));
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

    function test_ArrearsBeginsOnlyAfterTheDueDate() public {
        vm.warp(DUE);
        ledger.issueCharges(_ids(0));
        assertFalse(ledger.arrearsOf(1), "on time at the due date itself");

        vm.warp(DUE + 1);
        assertTrue(ledger.arrearsOf(1));
        assertFalse(ledger.arrearsOf(2), "unit 2's charge is not issued");

        vm.prank(stranger);
        ledger.payLevy(0);
        assertFalse(ledger.arrearsOf(1), "resolved by payment");
    }

    function test_AChargeNobodyIssuedIsNeverInArrears() public {
        vm.warp(LATER + 365 days);
        assertFalse(ledger.arrearsOf(1));
        assertFalse(ledger.arrearsOf(2));
    }

    function test_OneUnpaidChargeKeepsTheUnitInArrears() public {
        vm.prank(owner);
        ledger.payLevy(0);
        vm.warp(LATER + 1);
        uint256[] memory ids = new uint256[](2);
        (ids[0], ids[1]) = (0, 2);
        ledger.issueCharges(ids);
        assertTrue(ledger.arrearsOf(1), "charge 2 is unpaid");
    }
}
