// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {IMembershipQuery} from "../interfaces/IMembershipQuery.sol";

/// @notice Stand-in for the real `MembershipRegistry` (Money in vertical per
/// docs/ownership.md) so Governance and LevyLedger can be built and tested against
/// the interface before that contract exists. `bindUnit` here is open to any
/// caller — the real contract restricts it to the land-title adapter role;
/// this stub trades that guard for the ability to set up test fixtures
/// directly. Do not deploy this outside a test or a skeleton deployment.
contract MembershipRegistryStub is IMembershipQuery {
    mapping(uint256 unitId => address wallet) public ownerOfUnit;
    mapping(address wallet => uint256[] unitIds) private _unitsOfWallet;

    function bindUnit(uint256 unitId, address wallet) external {
        ownerOfUnit[unitId] = wallet;
        _unitsOfWallet[wallet].push(unitId);
    }

    function isOwner(uint256 unitId, address wallet) external view returns (bool) {
        return ownerOfUnit[unitId] == wallet;
    }

    function unitsOf(address wallet) external view returns (uint256[] memory) {
        return _unitsOfWallet[wallet];
    }
}
