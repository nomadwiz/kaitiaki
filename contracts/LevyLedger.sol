// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {Treasury} from "./Treasury.sol";
import {IMembershipQuery} from "./interfaces/IMembershipQuery.sol";
import {IArrearsQuery} from "./interfaces/IArrearsQuery.sol";

/// @title Levy charges, payment and arrears: the money-in side of the loop.
/// @notice Issues #58 and #173 — FR5, FR7–FR9; B1; ADR-020. A charge names a
/// unit, an amount and a due date. The schedule is fixed at construction, with
/// no setter and no role, because deriving it from the maintenance plan (FR11)
/// is designed, not built (doc/design/spec.md §4). A charge's index in the
/// schedule is its id.
///
/// Only the management firm collects a charge, and not before it is due
/// (FR5, B1, ADR-020). Collecting issues the charge and takes the amount from
/// the unit's bound wallet, if that wallet has approved this contract for it
/// and holds it. Anyone may pay a charge, issued or not, once and in full;
/// the payment credits the charge's unit, never the payer (FR7, ADR-016).
/// Receipts reach the Treasury only through `Treasury.deposit`, which pulls
/// them and splits them across the two funds (FR8).
///
/// Treasury and LevyLedger name each other at construction. Deploy Treasury
/// first, naming this contract's precomputed address as its depositor: this
/// constructor reads the settlement asset from it.
contract LevyLedger is IArrearsQuery {
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

    /// @notice Where a charge's unit is bound, and so whom `collect` takes the
    /// levy from. Fixed at deployment.
    IMembershipQuery public immutable members;

    /// @notice The management firm: the only caller of `collect` (ADR-020).
    /// Fixed at deployment, as `Governance.firm` is.
    address public immutable firm;

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
    /// @notice The firm has collected a due charge: it demanded payment
    /// (ADR-020). With `LevyPaid`, enough to derive every unit's arrears from
    /// the log alone (FR9, FR40).
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
    error MembershipRegistryIsZero();
    error FirmIsZero();
    /// Only the management firm may collect (ADR-020).
    error NotFirm(address caller);
    error ScheduleLengthMismatch(uint256 unitIds, uint256 amounts, uint256 dueDates);
    error UnknownCharge(uint256 chargeId);
    /// B1: a charge cannot be collected before its due date.
    error ChargeNotDue(uint256 chargeId, uint256 dueDate);
    error ChargeAlreadyPaid(uint256 chargeId);
    error LevyTransferFailed(address payer, uint256 amount);
    error TreasuryApprovalFailed(uint256 amount);

    constructor(
        address treasury_,
        IMembershipQuery members_,
        address firm_,
        uint256[] memory unitIds,
        uint256[] memory amounts,
        uint256[] memory dueDates
    ) {
        if (treasury_ == address(0)) revert TreasuryIsZero();
        if (address(members_) == address(0)) revert MembershipRegistryIsZero();
        if (firm_ == address(0)) revert FirmIsZero();
        if (unitIds.length != amounts.length || unitIds.length != dueDates.length) {
            revert ScheduleLengthMismatch(unitIds.length, amounts.length, dueDates.length);
        }
        treasury = Treasury(treasury_);
        settlementAsset = IERC20(Treasury(treasury_).settlementAsset());
        members = members_;
        firm = firm_;
        for (uint256 i = 0; i < unitIds.length; ++i) {
            charges.push(Charge(unitIds[i], amounts[i], dueDates[i], false, false));
            emit ChargeScheduled(i, unitIds[i], amounts[i], dueDates[i]);
        }
    }

    /// @notice FR5, ADR-020. The firm collects each charge in `chargeIds`:
    /// it issues the charge, then takes the amount from the unit's bound
    /// wallet if that wallet has approved this contract for it and holds it.
    /// If not, nothing is taken and nothing reverts: the charge stays issued
    /// and unpaid, so it falls into arrears once past due, and the firm may
    /// collect it again. Refused for a charge not yet due (B1). A charge
    /// already paid is skipped: an owner may pay early (ADR-016), and that
    /// must not revert every other owner's collection in the batch.
    function collect(uint256[] calldata chargeIds) external {
        if (msg.sender != firm) revert NotFirm(msg.sender);
        for (uint256 i = 0; i < chargeIds.length; ++i) {
            uint256 chargeId = chargeIds[i];
            Charge storage charge = _charge(chargeId);
            if (block.timestamp < charge.dueDate) {
                revert ChargeNotDue(chargeId, charge.dueDate);
            }
            if (charge.paid) continue;

            if (!charge.issued) {
                charge.issued = true;
                emit ChargeIssued(chargeId, charge.unitId, charge.amount, charge.dueDate);
            }
            address owner = members.ownerOf(charge.unitId);
            if (
                settlementAsset.allowance(owner, address(this)) >= charge.amount &&
                settlementAsset.balanceOf(owner) >= charge.amount
            ) _pay(chargeId, charge, owner);
        }
    }

    /// @notice FR7, FR8. Pay charge `chargeId` in full from the caller's
    /// balance, before or after it is issued (ADR-016). The caller must first
    /// approve this contract for the amount.
    function payLevy(uint256 chargeId) external {
        Charge storage charge = _charge(chargeId);
        if (charge.paid) revert ChargeAlreadyPaid(chargeId);
        _pay(chargeId, charge, msg.sender);
    }

    /// @notice FR9. Whether `unitId` has a charge that is issued, unpaid and
    /// past its due date. Derived on every call, never stored (ADR-016).
    /// Governance reads it when a vote is cast (FR10).
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

    /// The one path a levy takes into the Treasury, from `payer`.
    function _pay(uint256 chargeId, Charge storage charge, address payer) private {
        charge.paid = true;

        uint256 amount = charge.amount;
        if (!settlementAsset.transferFrom(payer, address(this), amount)) {
            revert LevyTransferFailed(payer, amount);
        }
        if (!settlementAsset.approve(address(treasury), amount)) {
            revert TreasuryApprovalFailed(amount);
        }
        treasury.deposit(amount);

        emit LevyPaid(chargeId, charge.unitId, payer, amount);
    }

    function _charge(uint256 chargeId) private view returns (Charge storage) {
        if (chargeId >= charges.length) revert UnknownCharge(chargeId);
        return charges[chargeId];
    }
}
