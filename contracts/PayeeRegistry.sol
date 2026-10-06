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

    /// @notice What the owners voted to admit: the vendor's name and company
    /// identifier (ADR-018) and the first proposal that admitted it, 0 meaning
    /// not admitted.
    struct PayeeRecord {
        string name;
        string companyId;
        uint256 admittedBy;
    }

    mapping(address payee => PayeeRecord) public records;

    error ExecutorIsZero();
    error UnauthorizedExecutor(address caller);
    error PayeeIsZero();
    error ProposalIdIsZero();
    /// @notice The payee was already admitted; `admittedBy` is the first proposal ID.
    error PayeeAlreadyRegistered(address payee, uint256 admittedBy);

    event PayeeAdmitted(
        address indexed payee,
        uint256 indexed proposalId,
        string name,
        string companyId
    );

    constructor(address executor_) {
        if (executor_ == address(0)) revert ExecutorIsZero();
        executor = executor_;
    }

    /// @notice Admit `payee` under an executed affirmative proposal.
    /// @param payee The vendor address being admitted.
    /// @param proposalId The nonzero proposal that authorized admission.
    /// @param name The vendor's name as the owners voted on it; `Governance`
    /// refuses an empty one, so it is not checked here.
    /// @param companyId The vendor's company identifier, likewise.
    function admit(
        address payee,
        uint256 proposalId,
        string calldata name,
        string calldata companyId
    ) external {
        if (msg.sender != executor) revert UnauthorizedExecutor(msg.sender);
        if (payee == address(0)) revert PayeeIsZero();
        if (proposalId == 0) revert ProposalIdIsZero();

        // 0 means not admitted; ProposalIdIsZero keeps that sentinel unambiguous.
        uint256 firstProposalId = records[payee].admittedBy;
        if (firstProposalId != 0) {
            revert PayeeAlreadyRegistered(payee, firstProposalId);
        }

        records[payee] = PayeeRecord(name, companyId, proposalId);
        emit PayeeAdmitted(payee, proposalId, name, companyId);
    }

    /// @notice Whether `payee` has been admitted.
    /// @param payee The vendor address to query.
    function isRegistered(address payee) external view returns (bool) {
        return records[payee].admittedBy != 0;
    }
}
