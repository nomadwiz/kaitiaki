// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {Fund} from "./IRelease.sol";

interface IProposalQuery {
    function approvedSpend(
        uint256 proposalId
    ) external view returns (bool exists, Fund fund, uint256 limit);
}
