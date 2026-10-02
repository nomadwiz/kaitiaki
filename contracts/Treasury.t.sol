// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {Test} from "forge-std/Test.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {Governance} from "./Governance.sol";
import {Fund, IRelease} from "./interfaces/IRelease.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {Treasury} from "./Treasury.sol";
import {MockNZD} from "./MockNZD.sol";
import {GovernanceStub} from "./stubs/GovernanceStub.sol";
import {PayeeRegistryStub} from "./stubs/PayeeRegistryStub.sol";
import {MembershipRegistryStub} from "./stubs/MembershipRegistryStub.sol";
import {TreasuryStub} from "./stubs/TreasuryStub.sol";

contract TreasuryTest is Test {
    event Deposited(uint256 amount, uint256 operatingAmount, uint256 maintenanceAmount);
    event Released(Fund fund, address payee, uint256 amount, uint256 proposalId);

    Treasury internal treasury;
    GovernanceStub internal governance;
    MockNZD internal settlementAsset;
    PayeeRegistryStub internal payeeRegistry;
    MembershipRegistryStub internal members;
    address internal ledger = makeAddr("ledger");
    address internal stranger = makeAddr("stranger");
    address internal timelock = makeAddr("timelock");
    address internal payee = makeAddr("payee");
    address internal otherPayee = makeAddr("otherPayee");

    function setUp() public {
        governance = new GovernanceStub();
        settlementAsset = new MockNZD();
        payeeRegistry = new PayeeRegistryStub();
        members = new MembershipRegistryStub();
        treasury = _newTreasury(8000);
        settlementAsset.mint(ledger, 2_000e18 + 1);
    }

    function test_DepositSplitsReceiptAcrossBothFunds() public {
        vm.prank(ledger);
        settlementAsset.approve(address(treasury), 1_000e18);
        vm.prank(ledger);
        treasury.deposit(1_000e18);

        assertEq(treasury.balanceOf(Fund.Operating), 800e18);
        assertEq(treasury.balanceOf(Fund.LongTermMaintenance), 200e18);
        assertEq(settlementAsset.balanceOf(address(treasury)), 1_000e18);
    }

    function test_TreasuryStubEmitsReleaseCall() public {
        TreasuryStub stub = new TreasuryStub();
        vm.expectEmit(address(stub));
        emit Released(Fund.LongTermMaintenance, payee, 7e18, 42);
        stub.release(Fund.LongTermMaintenance, payee, 7e18, 42);
    }

    function test_DepositOnlyByLevyLedger() public {
        vm.expectRevert(abi.encodeWithSelector(Treasury.UnauthorizedLevyLedger.selector, stranger));
        vm.prank(stranger);
        treasury.deposit(1e18);
    }

    function test_DepositRejectsSettlementTransferFailure() public {
        vm.mockCall(
            address(settlementAsset),
            abi.encodeWithSelector(IERC20.transferFrom.selector, ledger, address(treasury), 1e18),
            abi.encode(false)
        );

        vm.expectRevert(abi.encodeWithSelector(Treasury.SettlementTransferFailed.selector, 1e18));
        vm.prank(ledger);
        treasury.deposit(1e18);
    }

    function test_RejectsOutOfRangeSplit() public {
        vm.expectRevert(abi.encodeWithSelector(Treasury.InvalidFundSplit.selector, 10_001));
        _newTreasury(10_001);
    }

    function test_RejectsZeroGovernance() public {
        vm.expectRevert(Treasury.GovernanceNotConfigured.selector);
        new Treasury(
            8000,
            address(0),
            timelock,
            ledger,
            address(payeeRegistry),
            address(settlementAsset)
        );
    }

    function test_ConstructorRejectsZeroConfigurationAddresses() public {
        vm.expectRevert(Treasury.TimelockNotConfigured.selector);
        new Treasury(
            8000,
            address(governance),
            address(0),
            ledger,
            address(payeeRegistry),
            address(settlementAsset)
        );

        vm.expectRevert(Treasury.DepositorNotConfigured.selector);
        new Treasury(
            8000,
            address(governance),
            timelock,
            address(0),
            address(payeeRegistry),
            address(settlementAsset)
        );

        vm.expectRevert(Treasury.PayeeRegistryAddressIsZero.selector);
        new Treasury(
            8000,
            address(governance),
            timelock,
            ledger,
            address(0),
            address(settlementAsset)
        );

        vm.expectRevert(Treasury.SettlementAssetAddressIsZero.selector);
        new Treasury(
            8000,
            address(governance),
            timelock,
            ledger,
            address(payeeRegistry),
            address(0)
        );
    }

    /// NFR8: no address administers the roles once construction ends.
    function test_NoRoleAdminAfterDeployment() public view {
        assertEq(treasury.getRoleMemberCount(treasury.DEFAULT_ADMIN_ROLE()), 0);
    }

    /// FR31, R8: whoever calls, including the deployer, a grant of RELEASER_ROLE
    /// after construction reverts, because the role's admin has no members.
    function testFuzz_NoAddressCanGrantReleaser(address caller) public {
        bytes32 adminRole = treasury.DEFAULT_ADMIN_ROLE();
        bytes32 releaserRole = treasury.RELEASER_ROLE();
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                caller,
                adminRole
            )
        );
        vm.prank(caller);
        treasury.grantRole(releaserRole, caller);
    }

    /// The deployer (this test contract) is refused like anyone else.
    function test_DeployerCannotGrantReleaser() public {
        bytes32 adminRole = treasury.DEFAULT_ADMIN_ROLE();
        bytes32 releaserRole = treasury.RELEASER_ROLE();
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                address(this),
                adminRole
            )
        );
        treasury.grantRole(releaserRole, stranger);
    }

    /// NFR8: each role has exactly the one member the constructor named.
    function test_RolesHeldOnlyByConstructorArguments() public view {
        assertEq(treasury.getRoleMemberCount(treasury.RELEASER_ROLE()), 1);
        assertEq(treasury.getRoleMember(treasury.RELEASER_ROLE(), 0), timelock);
        assertEq(treasury.getRoleMemberCount(treasury.DEPOSITOR_ROLE()), 1);
        assertEq(treasury.getRoleMember(treasury.DEPOSITOR_ROLE(), 0), ledger);
    }

    /// FR8 as a property: every receipt is fully allocated, and operating gets
    /// exactly its share rounded down.
    function testFuzz_SplitConservesEveryReceipt(uint256 amount, uint256 ratioBps) public {
        ratioBps = bound(ratioBps, 0, 10_000);
        amount = bound(amount, 0, type(uint128).max);

        Treasury configured = _newTreasury(ratioBps);
        settlementAsset.mint(ledger, amount);

        vm.startPrank(ledger);
        settlementAsset.approve(address(configured), amount);
        configured.deposit(amount);
        vm.stopPrank();

        uint256 operating = configured.balanceOf(Fund.Operating);
        uint256 maintenance = configured.balanceOf(Fund.LongTermMaintenance);
        assertEq(operating + maintenance, amount);
        assertEq(operating, (amount * ratioBps) / 10_000);
    }

    function test_ReceiptsAccumulateAcrossACycle() public {
        vm.startPrank(ledger);
        settlementAsset.approve(address(treasury), 1_500e18 + 1);
        treasury.deposit(1_000e18);
        treasury.deposit(500e18);
        treasury.deposit(1);
        vm.stopPrank();

        assertEq(treasury.balanceOf(Fund.Operating), 1_200e18);
        assertEq(treasury.balanceOf(Fund.LongTermMaintenance), 300e18 + 1);
    }

    function test_DepositEmitsTheSplit() public {
        vm.prank(ledger);
        settlementAsset.approve(address(treasury), 1_000e18);
        vm.expectEmit(address(treasury));
        emit Deposited(1_000e18, 800e18, 200e18);
        vm.prank(ledger);
        treasury.deposit(1_000e18);
    }

    function test_BoundaryRatiosAreAccepted() public {
        assertEq(_newTreasury(0).operatingRatioBps(), 0);
        assertEq(_newTreasury(10_000).operatingRatioBps(), 10_000);
    }

    /// Refusal B3 (spec §7), proving G1 and FR31: any caller other than the
    /// timelock is refused with its own named error (NFR9).
    function testFuzz_ReleaseRefusesNonTimelock(address caller) public {
        vm.assume(caller != timelock);
        _configureProposal(Fund.Operating, 1_000e18);
        payeeRegistry.admit(payee);
        _deposit(1_000e18);

        vm.expectRevert(abi.encodeWithSelector(Treasury.UnauthorizedReleaser.selector, caller));
        vm.prank(caller);
        treasury.release(Fund.Operating, payee, 1e18, 1);
    }

    function test_AdminCannotRelease() public {
        _configureProposal(Fund.Operating, 1_000e18);

        vm.expectRevert(
            abi.encodeWithSelector(Treasury.UnauthorizedReleaser.selector, address(this))
        );
        treasury.release(Fund.Operating, payee, 1e18, 1);
    }

    function test_ReleaseRejectsUnknownProposal() public {
        vm.expectRevert(abi.encodeWithSelector(Treasury.UnknownProposal.selector, 1));
        vm.prank(timelock);
        treasury.release(Fund.Operating, payee, 1e18, 1);
    }

    /// Refusal B2′ (spec §7, FR34): a payee not registered at payment time is refused
    /// with `PayeeNotRegistered`, although the approved proposal names that payee.
    /// Proves G2 again — the check is not cached. Proved by calling `Treasury.release`
    /// directly with an unregistered payee, because registry removal is designed and
    /// not built (FR14).
    function test_ReleaseRejectsUnregisteredPayee() public {
        _configureProposal(Fund.Operating, 1_000e18);
        _deposit(1_000e18);

        vm.expectRevert(abi.encodeWithSelector(Treasury.PayeeNotRegistered.selector, payee));
        vm.prank(timelock);
        treasury.release(Fund.Operating, payee, 1e18, 1);
    }

    /// Refusal test B5, proving G4: a release drawing on any fund other than the
    /// approved one reverts with `FundMismatch`, whichever fund was approved and
    /// for any non-zero amount up to the limit.
    function testFuzz_ReleaseRejectsWrongFund(uint8 approvedSeed, uint256 amount) public {
        Fund approved = Fund(bound(approvedSeed, 0, 1));
        Fund requested = approved == Fund.Operating ? Fund.LongTermMaintenance : Fund.Operating;
        amount = bound(amount, 1, 1_000e18);
        _configureProposal(approved, 1_000e18);
        payeeRegistry.admit(payee);
        _deposit(1_000e18);

        vm.expectRevert(
            abi.encodeWithSelector(Treasury.FundMismatch.selector, approved, requested)
        );
        vm.prank(timelock);
        treasury.release(requested, payee, amount, 1);
    }

    function test_ReleaseRejectsInsufficientBalance() public {
        _configureProposal(Fund.Operating, 1_000e18);
        payeeRegistry.admit(payee);
        _deposit(1_000e18);

        vm.expectRevert(
            abi.encodeWithSelector(
                Treasury.InsufficientBalance.selector,
                Fund.Operating,
                801e18,
                800e18
            )
        );
        vm.prank(timelock);
        treasury.release(Fund.Operating, payee, 801e18, 1);
    }

    function test_ReleasePaysSettlementAssetAndUpdatesBalance() public {
        _configureProposal(Fund.Operating, 1_000e18);
        payeeRegistry.admit(payee);
        _deposit(1_000e18);

        vm.prank(timelock);
        treasury.release(Fund.Operating, payee, 500e18, 1);

        assertEq(settlementAsset.balanceOf(payee), 500e18);
        assertEq(treasury.balanceOf(Fund.Operating), 300e18);
        assertEq(treasury.released(1), 500e18);
    }

    function test_ReleaseRejectsCumulativeAmountOverProposalLimit() public {
        _configureProposal(Fund.Operating, 1_000e18);
        payeeRegistry.admit(payee);
        _deposit(1_500e18);

        vm.startPrank(timelock);
        vm.expectEmit(address(treasury));
        emit PaymentReleased(Fund.Operating, payee, 600e18, 1);
        treasury.release(Fund.Operating, payee, 600e18, 1);
        vm.expectRevert(
            abi.encodeWithSelector(
                Treasury.AmountExceedsLimit.selector,
                1,
                400e18 + 1,
                600e18,
                1_000e18
            )
        );
        treasury.release(Fund.Operating, payee, 400e18 + 1, 1);
        vm.stopPrank();

        assertEq(treasury.released(1), 600e18);
        assertEq(settlementAsset.balanceOf(payee), 600e18);
    }

    function test_ReleaseMayUseExactCumulativeProposalLimit() public {
        _configureProposal(Fund.Operating, 1_000e18);
        payeeRegistry.admit(payee);
        _deposit(1_500e18);

        vm.startPrank(timelock);
        treasury.release(Fund.Operating, payee, 600e18, 1);
        vm.expectEmit(address(treasury));
        emit PaymentReleased(Fund.Operating, payee, 400e18, 1);
        treasury.release(Fund.Operating, payee, 400e18, 1);
        vm.stopPrank();

        assertEq(treasury.released(1), 1_000e18);
        assertEq(settlementAsset.balanceOf(payee), 1_000e18);
    }

    function test_ReleaseLimitsAreTrackedPerProposal() public {
        _configureProposal(Fund.Operating, 400e18);
        governance.setProposal(2, Fund.Operating, 400e18, payee);
        payeeRegistry.admit(payee);
        _deposit(1_000e18);

        vm.startPrank(timelock);
        treasury.release(Fund.Operating, payee, 400e18, 1);
        vm.expectEmit(address(treasury));
        emit PaymentReleased(Fund.Operating, payee, 400e18, 2);
        treasury.release(Fund.Operating, payee, 400e18, 2);
        vm.stopPrank();

        assertEq(treasury.released(1), 400e18);
        assertEq(treasury.released(2), 400e18);
        assertEq(settlementAsset.balanceOf(payee), 800e18);
    }

    /// Refusal test B4 (spec §7), proving G3 and FR32: for any approved limit, a
    /// single release above it reverts with `AmountExceedsLimit` (NFR9), though
    /// the fund holds enough to pay it, and nothing is released or paid.
    function testFuzz_ReleaseRejectsAmountOverProposalLimit(uint256 limit, uint256 amount) public {
        limit = bound(limit, 1, 1e30);
        amount = bound(amount, limit + 1, type(uint128).max);
        _configureProposal(Fund.Operating, limit);
        payeeRegistry.admit(payee);
        settlementAsset.mint(ledger, 2 * amount);
        _deposit(2 * amount);

        vm.expectRevert(
            abi.encodeWithSelector(Treasury.AmountExceedsLimit.selector, 1, amount, 0, limit)
        );
        vm.prank(timelock);
        treasury.release(Fund.Operating, payee, amount, 1);
    }

    /// Refusal test B4 (spec §7, ADR-014), proving G3 across a sequence: for any
    /// approved limit, two releases against one proposal succeed together only
    /// while their total stays within it; the one that would take the total
    /// above it reverts with `AmountExceedsLimit` (NFR9).
    function testFuzz_CumulativeReleaseNeverExceedsLimit(
        uint256 limit,
        uint256 first,
        uint256 second
    ) public {
        limit = bound(limit, 1, 1e30);
        first = bound(first, 0, limit);
        second = bound(second, 0, limit);
        _configureProposal(Fund.Operating, limit);
        payeeRegistry.admit(payee);
        settlementAsset.mint(ledger, 2 * limit);
        _deposit(2 * limit);

        vm.startPrank(timelock);
        treasury.release(Fund.Operating, payee, first, 1);
        if (first + second <= limit) {
            vm.expectEmit(address(treasury));
            emit PaymentReleased(Fund.Operating, payee, second, 1);
        } else {
            vm.expectRevert(
                abi.encodeWithSelector(
                    Treasury.AmountExceedsLimit.selector,
                    1,
                    second,
                    first,
                    limit
                )
            );
        }
        treasury.release(Fund.Operating, payee, second, 1);
        vm.stopPrank();

        assertLe(treasury.released(1), limit);
        assertEq(settlementAsset.balanceOf(payee), treasury.released(1));
    }

    function test_ReleaseRejectsSettlementTransferFailure() public {
        _configureProposal(Fund.Operating, 1_000e18);
        payeeRegistry.admit(payee);
        _deposit(1_000e18);
        vm.mockCall(
            address(settlementAsset),
            abi.encodeWithSelector(IERC20.transfer.selector, payee, 1e18),
            abi.encode(false)
        );

        vm.expectRevert(
            abi.encodeWithSelector(Treasury.PaymentTransferFailed.selector, payee, 1e18)
        );
        vm.prank(timelock);
        treasury.release(Fund.Operating, payee, 1e18, 1);
    }

    function test_TreasuryReadsTermsFromGovernance() public {
        Governance realGovernance = _governanceReadingTerms();
        Treasury configured = new Treasury(
            8000,
            address(realGovernance),
            timelock,
            ledger,
            address(payeeRegistry),
            address(settlementAsset)
        );
        payeeRegistry.admit(payee);
        payeeRegistry.admit(otherPayee);
        settlementAsset.mint(ledger, 1_000e18);
        vm.prank(ledger);
        settlementAsset.approve(address(configured), 1_000e18);
        vm.prank(ledger);
        configured.deposit(1_000e18);

        vm.prank(address(this));
        uint256 proposalId = realGovernance.propose(
            "Repair",
            1e18,
            Fund.Operating,
            payee,
            bytes32(0)
        );

        vm.expectRevert(abi.encodeWithSelector(Treasury.PayeeMismatch.selector, payee, otherPayee));
        vm.prank(timelock);
        configured.release(Fund.Operating, otherPayee, 1e18, proposalId);

        vm.prank(timelock);
        configured.release(Fund.Operating, payee, 1e18, proposalId);
        assertEq(settlementAsset.balanceOf(payee), 1e18);
    }

    /// A real Governance for reading proposal terms. These tests call
    /// `release` as the timelock directly, so Governance's own timelock and
    /// treasury are never reached and stand-in addresses will do.
    function _governanceReadingTerms() internal returns (Governance) {
        return
            new Governance(
                address(this),
                payeeRegistry,
                members,
                TimelockController(payable(timelock)),
                IRelease(makeAddr("governance-treasury"))
            );
    }

    /// An Admit proposal carries no spending terms, so no payment can cite it.
    function test_ReleaseRefusesAdmitProposal() public {
        Governance realGovernance = _governanceReadingTerms();
        Treasury configured = new Treasury(
            8000,
            address(realGovernance),
            timelock,
            ledger,
            address(payeeRegistry),
            address(settlementAsset)
        );
        payeeRegistry.admit(payee);
        uint256 admitId = realGovernance.propose(payee);

        vm.expectRevert(abi.encodeWithSelector(Treasury.UnknownProposal.selector, admitId));
        vm.prank(timelock);
        configured.release(Fund.Operating, payee, 0, admitId);
    }

    /// `release` is the only way value leaves (rule 1): no generic call path,
    /// no withdrawal, and no setter that could redirect a payment.
    function test_NoOtherValueOrRedirectSurface() public {
        _assertAbsent(abi.encodeWithSignature("execute(bytes)", ""), "execute");
        _assertAbsent(abi.encodeWithSignature("withdraw(uint256)", 1), "withdraw");
        _assertAbsent(abi.encodeWithSignature("transfer(address,uint256)", payee, 1), "transfer");
        _assertAbsent(
            abi.encodeWithSignature("setPayeeRegistry(address)", stranger),
            "setPayeeRegistry"
        );
        _assertAbsent(
            abi.encodeWithSignature("setSettlementAsset(address)", stranger),
            "setSettlementAsset"
        );
        _assertAbsent(abi.encodeWithSignature("setReleaser(address)", stranger), "setReleaser");
    }

    function _assertAbsent(bytes memory callData, string memory name) internal {
        (bool ok, ) = address(treasury).call(callData);
        assertFalse(ok, string.concat("Treasury must not expose ", name));
    }

    function test_ReleaseAtLimitLeavesOtherFundUntouched() public {
        _configureProposal(Fund.Operating, 800e18);
        payeeRegistry.admit(payee);
        _deposit(1_000e18);

        vm.prank(timelock);
        treasury.release(Fund.Operating, payee, 800e18, 1);

        assertEq(settlementAsset.balanceOf(payee), 800e18);
        assertEq(treasury.balanceOf(Fund.Operating), 0);
        assertEq(treasury.balanceOf(Fund.LongTermMaintenance), 200e18);
    }

    function test_ReleaseEmitsPaymentDetails() public {
        _configureProposal(Fund.Operating, 1_000e18);
        payeeRegistry.admit(payee);
        _deposit(1_000e18);

        vm.expectEmit(address(treasury));
        emit PaymentReleased(Fund.Operating, payee, 500e18, 1);
        vm.prank(timelock);
        treasury.release(Fund.Operating, payee, 500e18, 1);
    }

    event PaymentReleased(
        Fund indexed fund,
        address indexed payee,
        uint256 amount,
        uint256 proposalId
    );

    function _configureProposal(Fund fund, uint256 limit) internal {
        governance.setProposal(1, fund, limit, payee);
    }

    function _newTreasury(uint256 ratioBps) internal returns (Treasury) {
        return
            new Treasury(
                ratioBps,
                address(governance),
                timelock,
                ledger,
                address(payeeRegistry),
                address(settlementAsset)
            );
    }

    function _deposit(uint256 amount) internal {
        vm.startPrank(ledger);
        settlementAsset.approve(address(treasury), amount);
        treasury.deposit(amount);
        vm.stopPrank();
    }
}
