// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

/// @notice The narrow read surface `MembershipRegistry` (Money in) exposes to
/// the rest of the system. Governance eligibility and levy attribution both
/// read through this interface rather than through storage, so any of the
/// six contracts can be built against a stub while the real registry is
/// still in progress. See doc/design/decisions/views/functional-view.md §2.1.
interface IMembershipQuery {
    /// @notice Whether `wallet` is the bound owner of `unitId`.
    function isOwner(uint256 unitId, address wallet) external view returns (bool);

    /// @notice The unit ids currently bound to `wallet`.
    function unitsOf(address wallet) external view returns (uint256[] memory);

    /// @notice The number of units bound so far — every principal unit, in the
    /// prototype. Governance stores it on each proposal as the quorum
    /// denominator (doc/design/spec.md §5; ADR-003, amendment of 30-09-2026).
    function boundUnitCount() external view returns (uint256);
}
