// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {Fund} from "./interfaces/IRelease.sol";
import {IPayeeQuery} from "./interfaces/IPayeeQuery.sol";

/// @title The building's treasury: custody of levy receipts in two segregated funds.
/// @notice Issue #47 — FR8, FR30, G4 (spec §3). Every receipt from `LevyLedger` is split
/// by `operatingRatioBps` between the operating fund and the long-term maintenance fund,
/// and the two balances never mix. The ratio is per-building configuration ratified by
/// owners at genesis (product §6.2, ADR-010), not one of spec §5's statutory parameters.
contract Treasury is AccessControl {
    bytes32 public constant DEPOSITOR_ROLE = keccak256("DEPOSITOR_ROLE");
    bytes32 public constant RELEASER_ROLE = keccak256("RELEASER_ROLE");

    uint256 public immutable operatingRatioBps;
    address public payeeRegistry;
    address public settlementAsset;

    struct Proposal {
        Fund fund;
        uint256 limit;
        bool exists;
    }

    mapping(Fund => uint256) private _balances;
    mapping(uint256 proposalId => Proposal) public proposals;

    error UnauthorizedLevyLedger(address caller);
    error InvalidFundSplit(uint256 ratioBps);
    error InvalidAddress(address badAddress);
    error DepositTransferFailed(uint256 amount);
    error UnauthorizedReleaser(address caller);
    error PayeeNotRegistered(address payee);
    error AmountExceedsLimit(uint256 proposalId, uint256 amount, uint256 limit);
    error FundMismatch(Fund expectedFund, Fund actualFund);
    error UnknownProposal(uint256 proposalId);
    error InsufficientBalance(Fund fund, uint256 amount, uint256 balance);
    error SettlementTransferFailed(address payee, uint256 amount);

    event Deposited(uint256 amount, uint256 operatingAmount, uint256 maintenanceAmount);
    event PaymentReleased(
        Fund indexed fund,
        address indexed payee,
        uint256 amount,
        uint256 proposalId
    );

    constructor(uint256 _operatingRatioBps) {
        if (_operatingRatioBps > 10_000) {
            revert InvalidFundSplit(_operatingRatioBps);
        }
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(RELEASER_ROLE, msg.sender);
        operatingRatioBps = _operatingRatioBps;
    }

    function setReleaser(address _releaser) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_releaser == address(0)) {
            revert InvalidAddress(_releaser);
        }
        _grantRole(RELEASER_ROLE, _releaser);
    }

    function setProposal(
        uint256 proposalId,
        Fund fund,
        uint256 limit
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        proposals[proposalId] = Proposal({fund: fund, limit: limit, exists: true});
    }

    function setPayeeRegistry(address _payeeRegistry) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_payeeRegistry == address(0)) {
            revert InvalidAddress(_payeeRegistry);
        }
        payeeRegistry = _payeeRegistry;
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
            revert DepositTransferFailed(amount);
        }

        // Operating gets its share rounded down; maintenance takes the remainder, so
        // operatingAmount + maintenanceAmount == amount and no receipt loses a wei.
        uint256 operatingAmount = (amount * operatingRatioBps) / 10_000;
        uint256 maintenanceAmount = amount - operatingAmount;

        _balances[Fund.Operating] += operatingAmount;
        _balances[Fund.LongTermMaintenance] += maintenanceAmount;

        emit Deposited(amount, operatingAmount, maintenanceAmount);
    }

    function release(Fund fund, address payee, uint256 amount, uint256 proposalId) external {
        if (!hasRole(RELEASER_ROLE, msg.sender)) {
            revert UnauthorizedReleaser(msg.sender);
        }

        Proposal storage proposal = proposals[proposalId];
        if (!proposal.exists) {
            revert UnknownProposal(proposalId);
        }
        if (payeeRegistry == address(0) || !IPayeeQuery(payeeRegistry).isRegistered(payee)) {
            revert PayeeNotRegistered(payee);
        }
        if (amount > proposal.limit) {
            revert AmountExceedsLimit(proposalId, amount, proposal.limit);
        }
        if (fund != proposal.fund) {
            revert FundMismatch(proposal.fund, fund);
        }

        uint256 balance = _balances[fund];
        if (balance < amount) {
            revert InsufficientBalance(fund, amount, balance);
        }
        if (settlementAsset == address(0)) {
            revert InvalidAddress(settlementAsset);
        }
        if (!IERC20(settlementAsset).transfer(payee, amount)) {
            revert SettlementTransferFailed(payee, amount);
        }

        _balances[fund] = balance - amount;
        emit PaymentReleased(fund, payee, amount, proposalId);
    }

    function balanceOf(Fund fund) external view returns (uint256) {
        return _balances[fund];
    }
}
