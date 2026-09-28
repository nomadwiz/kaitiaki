// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {Fund} from "./IRelease.sol";

/// @notice Narrow read surface Treasury uses to obtain Governance-approved
/// payment terms. Approval and execution remain enforced by the timelock.
interface IProposalQuery {
    /// @notice Returns payment terms for a Work proposal.
    function approvedSpend(
        uint256 proposalId
    ) external view returns (bool exists, Fund fund, uint256 limit, address payee);
}
