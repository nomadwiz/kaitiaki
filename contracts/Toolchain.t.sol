// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {Test} from "forge-std/Test.sol";

/// @title A canary for the Solidity test runner, not a test of the system.
/// @notice Issue #42. There are no contracts yet — #44 writes the first
/// interfaces. This file proves that the toolchain underneath every later test
/// works: that solc 0.8.36 is what compiles, that `forge-std` resolves, and
/// that the Foundry-compatible cheatcodes are available. Every refusal test
/// from B1 to B8 depends on `vm`, so if this fails, no result from any other
/// test in this repository means anything.
///
/// Keep it. It costs one compile and it is the first thing to check when a
/// suite starts failing for no visible reason.
contract ToolchainTest is Test {
    /// The test runner executes at all, and assertions are wired up.
    function test_RunnerExecutes() public pure {
        assertEq(uint256(1) + 1, 2, "arithmetic in the test runner is broken");
    }

    /// Cheatcodes work. `vm.warp` is the one the seven-day timelock and the
    /// fourteen-day voting window are tested with, so it is the one to prove.
    function test_CheatcodesAreAvailable() public {
        uint256 start = block.timestamp;
        vm.warp(start + 7 days);
        assertEq(block.timestamp, start + 7 days, "vm.warp did not move time");
    }

    /// `vm.expectRevert` works. Every guard in this project reverts with a
    /// distinct named error, and this is how each one gets asserted.
    function test_ExpectRevertIsAvailable() public {
        vm.expectRevert();
        this.alwaysReverts();
    }

    error Canary();

    function alwaysReverts() external pure {
        revert Canary();
    }
}
