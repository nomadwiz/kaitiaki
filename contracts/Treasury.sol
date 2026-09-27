// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {AccessControlEnumerable} from "@openzeppelin/contracts/access/extensions/AccessControlEnumerable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {Fund, IRelease} from "./interfaces/IRelease.sol";
import {IProposalQuery} from "./interfaces/IProposalQuery.sol";
import {IPayeeQuery} from "./interfaces/IPayeeQuery.sol";

/// @title The building's treasury: custody of levy receipts in two segregated funds.
/// @notice Issue #47 — FR8, FR30, G4 (spec §3). Every receipt from `LevyLedger` is split
/// by `operatingRatioBps` between the operating fund and the long-term maintenance fund,
/// and the two balances never mix. The ratio is per-building configuration ratified by
/// owners at genesis (product §6.2, ADR-010), not one of spec §5's statutory parameters.
contract Treasury is AccessControlEnumerable, IRelease {
    bytes32 public constant DEPOSITOR_ROLE = keccak256("DEPOSITOR_ROLE");
    bytes32 public constant RELEASER_ROLE = keccak256("RELEASER_ROLE");

    uint256 public immutable operatingRatioBps;
    address public immutable governance;
    address public immutable payeeRegistry;
    address public immutable settlementAsset;

    mapping(Fund => uint256) private _balances;

    error UnauthorizedLevyLedger(address caller);
    error InvalidFundSplit(uint256 ratioBps);
    error SettlementTransferFailed(uint256 amount);
    error UnauthorizedReleaser(address caller);
    error GovernanceNotConfigured();
    error TimelockNotConfigured();
    error DepositorNotConfigured();
    error PayeeRegistryNotConfigured();
    error SettlementAssetNotConfigured();
    error PayeeNotRegistered(address payee);
    error AmountExceedsLimit(uint256 proposalId, uint256 amount, uint256 limit);
    error FundMismatch(Fund expectedFund, Fund actualFund);
    error UnknownProposal(uint256 proposalId);
    error InsufficientBalance(Fund fund, uint256 amount, uint256 balance);
    error PaymentTransferFailed(address payee, uint256 amount);

    event Deposited(uint256 amount, uint256 operatingAmount, uint256 maintenanceAmount);
    event PaymentReleased(
        Fund indexed fund,
        address indexed payee,
        uint256 amount,
        uint256 proposalId
    );

    constructor(
        uint256 _operatingRatioBps,
        address _governance,
        address _timelock,
        address _depositor,
        address _payeeRegistry,
        address _settlementAsset
    ) {
        if (_operatingRatioBps > 10_000) {
            revert InvalidFundSplit(_operatingRatioBps);
        }
        if (_governance == address(0)) {
            revert GovernanceNotConfigured();
        }
        if (_timelock == address(0)) revert TimelockNotConfigured();
        if (_depositor == address(0)) revert DepositorNotConfigured();
        if (_payeeRegistry == address(0)) revert PayeeRegistryNotConfigured();
        if (_settlementAsset == address(0)) revert SettlementAssetNotConfigured();
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(RELEASER_ROLE, _timelock);
        _grantRole(DEPOSITOR_ROLE, _depositor);
        governance = _governance;
        payeeRegistry = _payeeRegistry;
        settlementAsset = _settlementAsset;
        operatingRatioBps = _operatingRatioBps;
        renounceRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /// @notice Pulls the levy settlement asset from the authorised LevyLedger
    /// before crediting the two segregated fund balances.
    function deposit(uint256 amount) external {
        if (!hasRole(DEPOSITOR_ROLE, msg.sender)) {
            revert UnauthorizedLevyLedger(msg.sender);
        }
        if (!IERC20(settlementAsset).transferFrom(msg.sender, address(this), amount)) {
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

    function release(
        Fund fund,
        address payee,
        uint256 amount,
        uint256 proposalId
    ) external override {
        if (!hasRole(RELEASER_ROLE, msg.sender)) {
            revert UnauthorizedReleaser(msg.sender);
        }

        (bool exists, Fund proposalFund, uint256 proposalLimit) = IProposalQuery(governance)
            .approvedSpend(proposalId);
        if (!exists) {
            revert UnknownProposal(proposalId);
        }
        if (!IPayeeQuery(payeeRegistry).isRegistered(payee)) {
            revert PayeeNotRegistered(payee);
        }
        if (amount > proposalLimit) {
            revert AmountExceedsLimit(proposalId, amount, proposalLimit);
        }
        if (fund != proposalFund) {
            revert FundMismatch(proposalFund, fund);
        }

        uint256 balance = _balances[fund];
        if (balance < amount) {
            revert InsufficientBalance(fund, amount, balance);
        }
        _balances[fund] = balance - amount;
        if (!IERC20(settlementAsset).transfer(payee, amount)) {
            revert PaymentTransferFailed(payee, amount);
        }

        emit PaymentReleased(fund, payee, amount, proposalId);
    }

    function balanceOf(Fund fund) external view returns (uint256) {
        return _balances[fund];
    }
}
