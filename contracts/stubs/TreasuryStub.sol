// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {IRelease, Fund} from "../interfaces/IRelease.sol";

/// @notice Stand-in for the real `Treasury` (Money out vertical per
/// docs/ownership.md). `release` here performs no guard checks at all — the real
/// contract enforces G1-G4 (releaser role, payee registered, amount within
/// cap, fund matches proposal) before moving anything. This stub only
/// records the call so Timelock and Governance can be built and tested
/// against the interface before those guards exist. Do not deploy this
/// outside a test or a skeleton deployment.
contract TreasuryStub is IRelease {
    event Released(Fund fund, address payee, uint256 amount, uint256 proposalId);

    function release(Fund fund, address payee, uint256 amount, uint256 proposalId) external {
        emit Released(fund, payee, amount, proposalId);
    }
}
