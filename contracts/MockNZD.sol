// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title A mock of the NZD-pegged stablecoin this design settles in.
/// @notice Issue #45, C13. Settlement is an external stablecoin; this project
/// issues nothing. This token exists only so levies can be paid and releases
/// made in tests and on the Sepolia test network. It is not part of the
/// standard contract set.
contract MockNZD is ERC20 {
    uint256 public constant HARDHAT_CHAIN_ID = 31337;
    uint256 public constant SEPOLIA_CHAIN_ID = 11155111;

    /// Minting was attempted on a chain that is not a test chain.
    error MintOutsideTestChain(uint256 chainId);

    constructor() ERC20("Mock NZD", "mNZD") {}

    /// Anyone may mint, but only on the Hardhat network or Sepolia.
    function mint(address to, uint256 amount) external {
        if (
            block.chainid != HARDHAT_CHAIN_ID &&
            block.chainid != SEPOLIA_CHAIN_ID
        ) {
            revert MintOutsideTestChain(block.chainid);
        }
        _mint(to, amount);
    }
}
