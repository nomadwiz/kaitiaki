// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

/// @notice The two funds a building's levies are split into at deposit.
/// docs/decisions/views/information-view.md §2.1 lists no third fund, and
/// none should be added without a decision record.
enum Fund {
    Operating,
    LongTermMaintenance
}

/// @notice The treasury's entire outward money path, and the only function on
/// `Treasury` that transfers value. Only `Timelock` may call it in the real
/// contract, which checks four things itself before moving anything (G1-G4).
/// CLAUDE.md names this signature as the one thing in this system that must
/// never grow a general execution path — no `call`, no `delegatecall`, no
/// calldata carried by a proposal. See ADR-001.
interface IRelease {
    function release(Fund fund, address payee, uint256 amount, uint256 proposalId) external;
}
