// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {Test} from "forge-std/Test.sol";
import {MockNZD} from "./MockNZD.sol";

/// @notice Issue #45. Proves the three acceptance criteria that code can prove:
/// 18 decimals, minting only on test chains, and no governance surface (NFR15).
contract MockNZDTest is Test {
    MockNZD internal token;
    address internal holder = makeAddr("holder");

    function setUp() public {
        token = new MockNZD();
    }

    // --- What the token is -------------------------------------------------

    /// The name says "Mock", so no reader of the chain mistakes it for an
    /// issued asset.
    function test_NameSymbolAndDecimals() public view {
        assertEq(token.name(), "Mock NZD");
        assertEq(token.symbol(), "mNZD");
        assertEq(token.decimals(), 18);
    }

    function test_MintOnHardhatNetwork() public {
        vm.chainId(token.HARDHAT_CHAIN_ID());
        token.mint(holder, 100e18);
        assertEq(token.balanceOf(holder), 100e18);
        assertEq(token.totalSupply(), 100e18);
    }

    function test_MintOnSepolia() public {
        vm.chainId(token.SEPOLIA_CHAIN_ID());
        token.mint(holder, 100e18);
        assertEq(token.balanceOf(holder), 100e18);
    }

    function test_AnyAddressMayMint() public {
        vm.chainId(token.HARDHAT_CHAIN_ID());
        vm.prank(makeAddr("stranger"));
        token.mint(holder, 1e18);
        assertEq(token.balanceOf(holder), 1e18);
    }

    function testFuzz_MintRefusedOffTestChains(uint256 chainId) public {
        chainId = bound(chainId, 1, type(uint64).max / 2 - 36);
        vm.assume(chainId != token.HARDHAT_CHAIN_ID());
        vm.assume(chainId != token.SEPOLIA_CHAIN_ID());

        vm.chainId(chainId);
        vm.expectRevert(
            abi.encodeWithSelector(
                MockNZD.MintOutsideTestChain.selector,
                chainId
            )
        );
        token.mint(holder, 1e18);
    }

    // --- NFR15: no governance rights ---------------------------------------

    /// The token has no voting, delegation, role or owner functions, so
    /// holding it can give no say over anything. Consensus weight is not a
    /// property of any contract: validators are appointed under proof of
    /// authority (ADR-007).
    function test_NoGovernanceSurface() public {
        _assertAbsent(
            abi.encodeWithSignature("getVotes(address)", holder),
            "getVotes"
        );
        _assertAbsent(
            abi.encodeWithSignature("getPastVotes(address,uint256)", holder, 0),
            "getPastVotes"
        );
        _assertAbsent(
            abi.encodeWithSignature("delegates(address)", holder),
            "delegates"
        );
        _assertAbsent(
            abi.encodeWithSignature("delegate(address)", holder),
            "delegate"
        );
        _assertAbsent(
            abi.encodeWithSignature(
                "hasRole(bytes32,address)",
                bytes32(0),
                holder
            ),
            "hasRole"
        );
        _assertAbsent(abi.encodeWithSignature("owner()"), "owner");
    }

    function _assertAbsent(bytes memory callData, string memory name) internal {
        (bool ok, ) = address(token).call(callData);
        assertFalse(ok, string.concat("MockNZD must not expose ", name));
    }
}
