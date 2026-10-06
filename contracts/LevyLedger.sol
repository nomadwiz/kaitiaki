// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {Treasury} from "./Treasury.sol";

/// @title Levy charges, payment and arrears: the money-in side of the loop.
/// @notice Issue #58 — FR5–FR9, NFR7; B1. A charge names a unit, an amount and
/// a due date. The schedule is fixed at construction, with no setter and no
/// role, because deriving it from the maintenance plan (FR11) is designed, not
/// built (doc/design/spec.md §4). A charge's index in the schedule is its id.
///
/// Anyone may issue a charge once it is due, and nobody may issue it before
/// (FR5, FR6, B1). Anyone may pay a charge, issued or not, once and in full;
/// the payment credits the charge's unit, never the payer (FR7, ADR-016).
/// Receipts reach the Treasury only through `Treasury.deposit`, which pulls
/// them and splits them across the two funds (FR8).
///
/// Treasury and LevyLedger name each other at construction. Deploy Treasury
/// first, naming this contract's precomputed address as its depositor: this
/// constructor reads the settlement asset from it.
contract LevyLedger {
    struct Charge {
        uint256 unitId;
        uint256 amount;
        uint256 dueDate;
        bool issued;
        bool paid;
    }

    /// @notice The only place receipts go. Fixed at deployment.
    Treasury public immutable treasury;

    /// @notice The token levies are paid in — the Treasury's own, so the two
    /// can never name different assets.
    IERC20 public immutable settlementAsset;

    /// @notice The schedule, indexed by charge id.
    Charge[] public charges;

    /// @notice A charge was stored at construction, one event per charge, so
    /// the schedule is in the log and a reader needs no storage read (FR39,
    /// FR40, ADR-019). `chargeId` is the charge's index in `charges`.
    event ChargeScheduled(
        uint256 indexed chargeId,
        uint256 indexed unitId,
        uint256 amount,
        uint256 dueDate
    );
    /// @notice A charge has fallen due and been issued. With `LevyPaid`, enough
    /// to derive every unit's arrears from the log alone (FR9, FR40).
    event ChargeIssued(
        uint256 indexed chargeId,
        uint256 indexed unitId,
        uint256 amount,
        uint256 dueDate
    );
    /// @notice A charge has been paid. `payer` is whoever paid; the credit is
    /// the unit's (FR7).
    event LevyPaid(
        uint256 indexed chargeId,
        uint256 indexed unitId,
        address indexed payer,
        uint256 amount
    );

    error TreasuryIsZero();
    error ScheduleLengthMismatch(uint256 unitIds, uint256 amounts, uint256 dueDates);
    error UnknownCharge(uint256 chargeId);
    /// B1: a charge cannot be issued before its due date.
    error ChargeNotDue(uint256 chargeId, uint256 dueDate);
    error ChargeAlreadyIssued(uint256 chargeId);
    error ChargeAlreadyPaid(uint256 chargeId);
    error LevyTransferFailed(address payer, uint256 amount);
    error TreasuryApprovalFailed(uint256 amount);

    constructor(
        address treasury_,
        uint256[] memory unitIds,
        uint256[] memory amounts,
        uint256[] memory dueDates
    ) {
        if (treasury_ == address(0)) revert TreasuryIsZero();
        if (unitIds.length != amounts.length || unitIds.length != dueDates.length) {
            revert ScheduleLengthMismatch(unitIds.length, amounts.length, dueDates.length);
        }
        treasury = Treasury(treasury_);
        settlementAsset = IERC20(Treasury(treasury_).settlementAsset());
        for (uint256 i = 0; i < unitIds.length; ++i) {
            charges.push(Charge(unitIds[i], amounts[i], dueDates[i], false, false));
            emit ChargeScheduled(i, unitIds[i], amounts[i], dueDates[i]);
        }
    }

    /// @notice FR5, FR6, NFR7. Issue each charge in `chargeIds`. Any caller,
    /// but refused for a charge whose due date has not arrived (B1).
    function issueCharges(uint256[] calldata chargeIds) external {
        for (uint256 i = 0; i < chargeIds.length; ++i) {
            uint256 chargeId = chargeIds[i];
            Charge storage charge = _charge(chargeId);
            if (block.timestamp < charge.dueDate) {
                revert ChargeNotDue(chargeId, charge.dueDate);
            }
            if (charge.issued) revert ChargeAlreadyIssued(chargeId);

            charge.issued = true;
            emit ChargeIssued(chargeId, charge.unitId, charge.amount, charge.dueDate);
        }
    }

    /// @notice FR7, FR8. Pay charge `chargeId` in full from the caller's
    /// balance, before or after it is issued (ADR-016). The caller must first
    /// approve this contract for the amount.
    function payLevy(uint256 chargeId) external {
        Charge storage charge = _charge(chargeId);
        if (charge.paid) revert ChargeAlreadyPaid(chargeId);
        charge.paid = true;

        uint256 amount = charge.amount;
        if (!settlementAsset.transferFrom(msg.sender, address(this), amount)) {
            revert LevyTransferFailed(msg.sender, amount);
        }
        if (!settlementAsset.approve(address(treasury), amount)) {
            revert TreasuryApprovalFailed(amount);
        }
        treasury.deposit(amount);

        emit LevyPaid(chargeId, charge.unitId, msg.sender, amount);
    }

    /// @notice FR9. Whether `unitId` has a charge that is issued, unpaid and
    /// past its due date. Derived on every call, never stored (ADR-016).
    function arrearsOf(uint256 unitId) external view returns (bool) {
        // ponytail: scans the whole schedule; index charges by unit if a
        // schedule grows past a few hundred entries.
        for (uint256 i = 0; i < charges.length; ++i) {
            Charge storage charge = charges[i];
            if (
                charge.unitId == unitId &&
                charge.issued &&
                !charge.paid &&
                block.timestamp > charge.dueDate
            ) return true;
        }
        return false;
    }

    function _charge(uint256 chargeId) private view returns (Charge storage) {
        if (chargeId >= charges.length) revert UnknownCharge(chargeId);
        return charges[chargeId];
    }
}
