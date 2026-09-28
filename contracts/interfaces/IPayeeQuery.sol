// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

/// @notice The narrow read surface `PayeeRegistry` (Money out) exposes.
/// `Governance.propose` and `Treasury.release` both refuse against an
/// unregistered payee by reading this, never by trusting proposal text.
/// See doc/design/decisions/views/functional-view.md §2.1.
interface IPayeeQuery {
    /// @notice Whether `payee` has been admitted by an executed affirmative
    /// proposal.
    function isRegistered(address payee) external view returns (bool);
}
