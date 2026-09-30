// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {IPayeeQuery} from "./interfaces/IPayeeQuery.sol";

/// @title The building's approved payee registry.
/// @notice A payee enters the registry only when the configured execution
/// boundary calls `admit` for an affirmative admission proposal. The
/// configured executor is the integration boundary in this prototype; this
/// contract does not accept calls from the firm's proposal key.
contract PayeeRegistry is IPayeeQuery {
    /// @notice The sole contract allowed to admit payees.
    address public immutable executor;

    mapping(address payee => uint256 admittedBy) private _admittedBy;

    error ExecutorIsZero();
    error UnauthorizedExecutor(address caller);
    error PayeeIsZero();
    error ProposalIdIsZero();
    /// @notice The payee was already admitted; `admittedBy` is the first proposal ID.
    error PayeeAlreadyRegistered(address payee, uint256 admittedBy);

    event PayeeAdmitted(address indexed payee, uint256 indexed proposalId);

    constructor(address executor_) {
        if (executor_ == address(0)) revert ExecutorIsZero();
        executor = executor_;
    }

    /// @notice Admit `payee` under an executed affirmative proposal.
    /// @param payee The vendor address being admitted.
    /// @param proposalId The nonzero proposal that authorized admission.
    function admit(address payee, uint256 proposalId) external {
        if (msg.sender != executor) revert UnauthorizedExecutor(msg.sender);
        if (payee == address(0)) revert PayeeIsZero();
        if (proposalId == 0) revert ProposalIdIsZero();

        // 0 means not admitted; ProposalIdIsZero keeps that sentinel unambiguous.
        uint256 firstProposalId = _admittedBy[payee];
        if (firstProposalId != 0) {
            revert PayeeAlreadyRegistered(payee, firstProposalId);
        }

        _admittedBy[payee] = proposalId;
        emit PayeeAdmitted(payee, proposalId);
    }

    /// @notice Whether `payee` has been admitted.
    /// @param payee The vendor address to query.
    function isRegistered(address payee) external view returns (bool) {
        return _admittedBy[payee] != 0;
    }
}
