// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

/// @notice The one write `PayeeRegistry` (Money out) accepts: admitting a
/// payee under an executed `Admit` proposal. Only the Timelock may call it, and
/// `Governance` encodes the call against this signature when it queues a
/// passed admission (doc/design/spec.md §4; ADR-015, amendment of 02-10-2026).
interface IAdmit {
    function admit(address payee, uint256 proposalId) external;
}
