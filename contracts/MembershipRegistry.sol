// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {IMembershipQuery} from "./interfaces/IMembershipQuery.sol";

/// @title The unit register: which wallet owns which unit.
/// @notice Issue #46 — FR1, FR2, FR19; ADR-003. The source of every eligibility
/// answer: Governance reads who may vote, and with how many units, from here
/// and never from anything the voter supplies.
///
/// Only the land-title adapter may bind, and a binding is written once. There
/// is no rebinding, unbinding or admin: a unit changing hands on sale (FR3) is
/// designed, not built, so in the prototype the bindings made at deployment
/// are the bindings for good.
///
/// The register holds no voting weight. One unit, one vote (ADR-003): a
/// wallet's weight is the number of units `unitsOf` returns, not the unit's
/// entitlement share.
contract MembershipRegistry is IMembershipQuery {
    /// @notice The land-title adapter: the only address that may bind a unit.
    /// Fixed at deployment, with no role to grant or renounce.
    address public immutable adapter;

    /// @notice The wallet bound to each unit; the zero address if unbound.
    mapping(uint256 unitId => address wallet) public ownerOf;

    mapping(address wallet => uint256[] unitIds) private _unitsOf;

    /// @notice The number of units bound — every principal unit, in the
    /// prototype. Governance stores it on each proposal as the quorum
    /// denominator (spec §5; ADR-003, amendment of 30-09-2026). A binding is
    /// written once, so each unit adds one and none is ever taken away.
    uint256 public boundUnitCount;

    /// @notice Every binding, so eligibility can be rebuilt from the log alone
    /// and each `VoteCast` checked against it without a storage read (spec §6).
    event UnitBound(uint256 indexed unitId, address indexed wallet);

    error AdapterIsZero();
    error NotAdapter(address caller);
    error WalletIsZero();
    /// FR1: a unit binds to exactly one wallet, once.
    error UnitAlreadyBound(uint256 unitId, address boundTo);

    constructor(address adapter_) {
        if (adapter_ == address(0)) revert AdapterIsZero();
        adapter = adapter_;
    }

    /// @notice FR1. Bind `unitId` to `wallet`. Refused for a unit already
    /// bound, to any wallet including this one, so a unit is never counted
    /// twice.
    function bindUnit(uint256 unitId, address wallet) external {
        if (msg.sender != adapter) revert NotAdapter(msg.sender);
        if (wallet == address(0)) revert WalletIsZero();
        address boundTo = ownerOf[unitId];
        if (boundTo != address(0)) revert UnitAlreadyBound(unitId, boundTo);

        ownerOf[unitId] = wallet;
        _unitsOf[wallet].push(unitId);
        ++boundUnitCount;

        emit UnitBound(unitId, wallet);
    }

    /// @notice FR2. Whether `wallet` is the bound owner of `unitId`. False for
    /// an unbound unit, including when asked about the zero address.
    function isOwner(uint256 unitId, address wallet) external view returns (bool) {
        return wallet != address(0) && ownerOf[unitId] == wallet;
    }

    /// @notice FR19. The units bound to `wallet`, in the order they were bound.
    /// Its length is the wallet's voting weight.
    function unitsOf(address wallet) external view returns (uint256[] memory) {
        return _unitsOf[wallet];
    }
}
