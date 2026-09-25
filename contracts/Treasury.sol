// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {Fund} from "./interfaces/IRelease.sol";

/// @title The building's treasury: custody of levy receipts in two segregated funds.
/// @notice Issue #47 — FR8, FR30, G4 (spec §3). Every receipt from `LevyLedger` is split
/// by `operatingRatioBps` between the operating fund and the long-term maintenance fund,
/// and the two balances never mix. The ratio is per-building configuration ratified by
/// owners at genesis (product §6.2, ADR-010), not one of spec §5's statutory parameters.
contract Treasury is AccessControl {
    bytes32 public constant DEPOSITOR_ROLE = keccak256("DEPOSITOR_ROLE");

    uint256 public immutable operatingRatioBps;
    address public settlementAsset;

    mapping(Fund => uint256) private _balances;

    error UnauthorizedLevyLedger(address caller);
    error InvalidFundSplit(uint256 ratioBps);
    error InvalidAddress(address badAddress);
    error SettlementTransferFailed(uint256 amount);

    event Deposited(uint256 amount, uint256 operatingAmount, uint256 maintenanceAmount);

    constructor(uint256 _operatingRatioBps) {
        if (_operatingRatioBps > 10_000) {
            revert InvalidFundSplit(_operatingRatioBps);
        }
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        operatingRatioBps = _operatingRatioBps;
    }

    function setSettlementAsset(address _settlementAsset) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_settlementAsset == address(0)) {
            revert InvalidAddress(_settlementAsset);
        }
        settlementAsset = _settlementAsset;
    }

    /// @notice Pulls the levy settlement asset from the authorised LevyLedger
    /// before crediting the two segregated fund balances.
    function deposit(uint256 amount) external {
        if (!hasRole(DEPOSITOR_ROLE, msg.sender)) {
            revert UnauthorizedLevyLedger(msg.sender);
        }
        if (
            settlementAsset == address(0) ||
            !IERC20(settlementAsset).transferFrom(msg.sender, address(this), amount)
        ) {
            revert SettlementTransferFailed(amount);
        }

        // Operating gets its share rounded down; maintenance takes the remainder, so
        // operatingAmount + maintenanceAmount == amount and no receipt loses a wei.
        uint256 operatingAmount = (amount * operatingRatioBps) / 10_000;
        uint256 maintenanceAmount = amount - operatingAmount;

        _balances[Fund.Operating] += operatingAmount;
        _balances[Fund.LongTermMaintenance] += maintenanceAmount;

        emit Deposited(amount, operatingAmount, maintenanceAmount);
    }

    function balanceOf(Fund fund) external view returns (uint256) {
        return _balances[fund];
    }
}
