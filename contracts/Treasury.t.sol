// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {Test} from "forge-std/Test.sol";
import {Fund} from "./interfaces/IRelease.sol";
import {Treasury} from "./Treasury.sol";
import {MockNZD} from "./MockNZD.sol";

contract TreasuryTest is Test {
    event Deposited(uint256 amount, uint256 operatingAmount, uint256 maintenanceAmount);

    Treasury internal treasury;
    MockNZD internal settlementAsset;
    address internal ledger = makeAddr("ledger");
    address internal stranger = makeAddr("stranger");

    function setUp() public {
        treasury = new Treasury(8000);
        treasury.grantRole(treasury.DEPOSITOR_ROLE(), ledger);
        settlementAsset = new MockNZD();
        treasury.setSettlementAsset(address(settlementAsset));
        settlementAsset.mint(ledger, 2_000e18 + 1);
    }

    function test_DepositSplitsReceiptAcrossBothFunds() public {
        vm.prank(ledger);
        settlementAsset.approve(address(treasury), 1_000e18);
        vm.prank(ledger);
        treasury.deposit(1_000e18);

        assertEq(treasury.balanceOf(Fund.Operating), 800e18);
        assertEq(treasury.balanceOf(Fund.LongTermMaintenance), 200e18);
        assertEq(settlementAsset.balanceOf(address(treasury)), 1_000e18);
    }

    function test_DepositOnlyByLevyLedger() public {
        vm.expectRevert(abi.encodeWithSelector(Treasury.UnauthorizedLevyLedger.selector, stranger));
        vm.prank(stranger);
        treasury.deposit(1e18);
    }

    function test_RejectsOutOfRangeSplit() public {
        vm.expectRevert(abi.encodeWithSelector(Treasury.InvalidFundSplit.selector, 10_001));
        new Treasury(10_001);
    }

    function test_DepositorRoleCanBeGrantedAfterDeployment() public {
        Treasury configured = new Treasury(8000);

        configured.grantRole(configured.DEPOSITOR_ROLE(), ledger);

        assertTrue(configured.hasRole(configured.DEPOSITOR_ROLE(), ledger));
    }

    function test_DepositRejectsMissingSettlementAsset() public {
        Treasury configured = new Treasury(8000);
        configured.grantRole(configured.DEPOSITOR_ROLE(), ledger);

        vm.expectRevert(abi.encodeWithSelector(Treasury.SettlementTransferFailed.selector, 1e18));
        vm.prank(ledger);
        configured.deposit(1e18);
    }

    /// FR8 as a property: every receipt is fully allocated, and operating gets
    /// exactly its share rounded down.
    function testFuzz_SplitConservesEveryReceipt(uint256 amount, uint256 ratioBps) public {
        ratioBps = bound(ratioBps, 0, 10_000);
        amount = bound(amount, 0, type(uint128).max);

        Treasury configured = new Treasury(ratioBps);
        configured.grantRole(configured.DEPOSITOR_ROLE(), ledger);
        configured.setSettlementAsset(address(settlementAsset));
        settlementAsset.mint(ledger, amount);

        vm.startPrank(ledger);
        settlementAsset.approve(address(configured), amount);
        configured.deposit(amount);
        vm.stopPrank();

        uint256 operating = configured.balanceOf(Fund.Operating);
        uint256 maintenance = configured.balanceOf(Fund.LongTermMaintenance);
        assertEq(operating + maintenance, amount);
        assertEq(operating, (amount * ratioBps) / 10_000);
    }

    function test_ReceiptsAccumulateAcrossACycle() public {
        vm.startPrank(ledger);
        settlementAsset.approve(address(treasury), 1_500e18 + 1);
        treasury.deposit(1_000e18);
        treasury.deposit(500e18);
        treasury.deposit(1);
        vm.stopPrank();

        assertEq(treasury.balanceOf(Fund.Operating), 1_200e18);
        assertEq(treasury.balanceOf(Fund.LongTermMaintenance), 300e18 + 1);
    }

    function test_DepositEmitsTheSplit() public {
        vm.prank(ledger);
        settlementAsset.approve(address(treasury), 1_000e18);
        vm.expectEmit(address(treasury));
        emit Deposited(1_000e18, 800e18, 200e18);
        vm.prank(ledger);
        treasury.deposit(1_000e18);
    }

    function test_BoundaryRatiosAreAccepted() public {
        assertEq(new Treasury(0).operatingRatioBps(), 0);
        assertEq(new Treasury(10_000).operatingRatioBps(), 10_000);
    }
}
