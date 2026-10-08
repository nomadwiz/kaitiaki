// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {IArrearsQuery} from "../interfaces/IArrearsQuery.sol";

/// @notice Stand-in for the real `LevyLedger` (Money in vertical per
/// doc/design/ownership.md) so Governance can be tested against the arrears
/// flag without a charge schedule, a token and a treasury. `setArrears` is
/// open to any caller; the real flag is derived from charges, never set. Do
/// not deploy this outside a test.
contract LevyLedgerStub is IArrearsQuery {
    mapping(uint256 unitId => bool) public arrearsOf;

    function setArrears(uint256 unitId, bool inArrears) external {
        arrearsOf[unitId] = inArrears;
    }
}
