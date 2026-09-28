// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {IPayeeQuery} from "../interfaces/IPayeeQuery.sol";

/// @notice Stand-in for the real `PayeeRegistry` (Money out vertical per
/// doc/design/ownership.md). `admit` here is open to any caller — the real contract
/// reaches it only through an executed affirmative proposal; this stub trades
/// that guard for the ability to set up test fixtures directly. Do not deploy
/// this outside a test or a skeleton deployment.
contract PayeeRegistryStub is IPayeeQuery {
    mapping(address payee => bool registered) public registered;

    function admit(address payee) external {
        registered[payee] = true;
    }

    function isRegistered(address payee) external view returns (bool) {
        return registered[payee];
    }
}
