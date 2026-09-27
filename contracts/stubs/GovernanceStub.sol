// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {Fund} from "../interfaces/IRelease.sol";
import {IProposalQuery} from "../interfaces/IProposalQuery.sol";

contract GovernanceStub is IProposalQuery {
    struct Proposal {
        Fund fund;
        uint256 limit;
        bool exists;
    }

    mapping(uint256 => Proposal) internal proposals;

    function setProposal(uint256 proposalId, Fund fund, uint256 limit, address payee) external {
        proposals[proposalId] = Proposal(fund, limit, true);
        proposalPayees[proposalId] = payee;
    }

    mapping(uint256 => address) internal proposalPayees;

    function approvedSpend(
        uint256 proposalId
    ) external view returns (bool exists, Fund fund, uint256 limit, address payee) {
        Proposal memory proposal = proposals[proposalId];
        return (proposal.exists, proposal.fund, proposal.limit, proposalPayees[proposalId]);
    }
}
