// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {Fund} from "./interfaces/IRelease.sol";

contract Treasury {
    uint256 public immutable operatingRatioBps;
    address public immutable levyLedger;

    mapping(Fund => uint256) private _balances;

    error UnauthorizedLevyLedger(address caller);
    error InvalidFundSplit(uint256 ratioBps);

    event Deposited(uint256 amount, uint256 operatingAmount, uint256 maintenanceAmount);

    constructor(address _levyLedger, uint256 _operatingRatioBps) {
        if (_operatingRatioBps > 10_000) {
            revert InvalidFundSplit(_operatingRatioBps);
        }
        levyLedger = _levyLedger;
        operatingRatioBps = _operatingRatioBps;
    }

    function deposit(uint256 amount) external {
        if (msg.sender != levyLedger) {
            revert UnauthorizedLevyLedger(msg.sender);
        }

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
