// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {Test} from "forge-std/Test.sol";
import {Fund} from "./interfaces/IRelease.sol";
import {Treasury} from "./Treasury.sol";

contract TreasuryTest is Test {
    Treasury internal treasury;
    address internal ledger = makeAddr("ledger");
    address internal stranger = makeAddr("stranger");

    function setUp() public {
        treasury = new Treasury(ledger, 8000);
    }

    function test_DepositSplitsReceiptAcrossBothFunds() public {
        vm.prank(ledger);
        treasury.deposit(1_000e18);

        assertEq(treasury.balanceOf(Fund.Operating), 800e18);
        assertEq(treasury.balanceOf(Fund.LongTermMaintenance), 200e18);
    }

    function test_DepositOnlyByLevyLedger() public {
        vm.expectRevert(
            abi.encodeWithSelector(Treasury.UnauthorizedLevyLedger.selector, stranger)
        );
        vm.prank(stranger);
        treasury.deposit(1e18);
    }

    function test_RejectsOutOfRangeSplit() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                Treasury.InvalidFundSplit.selector,
                10_001
            )
        );
        new Treasury(ledger, 10_001);
    }
}
