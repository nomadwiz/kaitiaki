// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

/// @notice The narrow read surface `LevyLedger` (Money in) exposes to
/// `Governance`, which reads it when a vote is cast: a unit in arrears may not
/// vote (FR10). Governance can be built against a stub through it, as with
/// IMembershipQuery.
interface IArrearsQuery {
    /// @notice Whether `unitId` has a charge that is issued, unpaid and past
    /// its due date (FR9, ADR-016).
    function arrearsOf(uint256 unitId) external view returns (bool);
}
