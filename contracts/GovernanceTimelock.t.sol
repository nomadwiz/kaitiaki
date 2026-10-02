// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {Test} from "forge-std/Test.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {Governance} from "./Governance.sol";
import {MembershipRegistry} from "./MembershipRegistry.sol";
import {PayeeRegistry} from "./PayeeRegistry.sol";
import {Treasury} from "./Treasury.sol";
import {MockNZD} from "./MockNZD.sol";
import {Fund, IRelease} from "./interfaces/IRelease.sol";
import {IAdmit} from "./interfaces/IAdmit.sol";

/// @notice Issue #56. The timelock wiring (ADR-015, and its amendment of
/// 02-10-2026): OpenZeppelin's `TimelockController` unchanged, with a 7-day
/// delay, `Governance` its only proposer and executor and no external admin;
/// the timelock the sole holder of `RELEASER_ROLE` and `PayeeRegistry`'s
/// executor. FR21, FR22, FR31, NFR8. Every contract here is the real one.
contract GovernanceTimelockTest is Test {
    MockNZD internal token;
    MembershipRegistry internal members;
    PayeeRegistry internal payees;
    Treasury internal treasury;
    Governance internal governance;
    TimelockController internal timelock;

    address internal firm = makeAddr("firm");
    address internal vendor = makeAddr("vendor");
    address internal alice = makeAddr("alice"); // units 1 and 2
    address internal bob = makeAddr("bob"); // unit 3
    address internal carol = makeAddr("carol"); // unit 4
    address internal stranger = makeAddr("stranger");

    uint256 internal constant LIMIT = 400e18;

    event ProposalQueued(uint256 indexed proposalId, uint256 eta);
    event PayeeAdmitted(address indexed payee, uint256 indexed proposalId);

    function setUp() public {
        token = new MockNZD();
        members = new MembershipRegistry(address(this));
        members.bindUnit(1, alice);
        members.bindUnit(2, alice);
        members.bindUnit(3, bob);
        members.bindUnit(4, carol);

        // Each of the four below names one deployed after it, so their
        // addresses are worked out from this contract's nonce first.
        uint64 nonce = vm.getNonce(address(this));
        address governanceAt = vm.computeCreateAddress(address(this), nonce + 2);
        address timelockAt = vm.computeCreateAddress(address(this), nonce + 3);

        payees = new PayeeRegistry(timelockAt);
        // This test stands in for LevyLedger, the treasury's only depositor.
        treasury = new Treasury(
            8_000,
            governanceAt,
            timelockAt,
            address(this),
            address(payees),
            address(token)
        );
        governance = new Governance(
            firm,
            payees,
            members,
            TimelockController(payable(timelockAt)),
            IRelease(address(treasury))
        );
        address[] memory onlyGovernance = new address[](1);
        onlyGovernance[0] = address(governance);
        timelock = new TimelockController(7 days, onlyGovernance, onlyGovernance, address(0));

        assertEq(address(governance), governanceAt);
        assertEq(address(timelock), timelockAt);

        token.mint(address(this), 1_000e18);
        token.approve(address(treasury), 1_000e18);
        treasury.deposit(1_000e18);
    }

    // --- Helpers ---------------------------------------------------------------

    /// Alice and Bob vote for: 3 units of 4, two wallets, so quorum is met and
    /// the proposal passes when the 14-day window closes.
    function _pass(uint256 proposalId) internal {
        vm.prank(alice);
        governance.castVote(proposalId, true);
        vm.prank(bob);
        governance.castVote(proposalId, true);
        vm.warp(governance.proposal(proposalId).createdAt + 14 days);
    }

    function _passedAdmit() internal returns (uint256 proposalId) {
        vm.prank(firm);
        proposalId = governance.propose(vendor);
        _pass(proposalId);
    }

    /// The whole admission loop, so a work proposal can name the vendor (B2).
    function _admitVendor() internal returns (uint256 proposalId) {
        proposalId = _passedAdmit();
        vm.prank(stranger);
        uint256 eta = governance.queue(proposalId);
        vm.warp(eta);
        vm.prank(stranger);
        governance.execute(proposalId);
    }

    function _passedWork() internal returns (uint256 proposalId) {
        _admitVendor();
        vm.prank(firm);
        proposalId = governance.propose("Roof repair", LIMIT, Fund.Operating, vendor, bytes32(0));
        _pass(proposalId);
    }

    function _state(uint256 proposalId) internal view returns (uint8) {
        return uint8(governance.state(proposalId));
    }

    // --- Role holders (ADR-015, FR31, NFR8) ------------------------------------

    function test_TimelockRolesAreGovernanceAloneWithNoExternalAdmin() public view {
        assertEq(timelock.getMinDelay(), 7 days);
        assertEq(governance.TIMELOCK_DELAY(), 7 days);

        assertTrue(timelock.hasRole(timelock.PROPOSER_ROLE(), address(governance)));
        assertTrue(timelock.hasRole(timelock.EXECUTOR_ROLE(), address(governance)));
        assertTrue(timelock.hasRole(timelock.CANCELLER_ROLE(), address(governance)));
        // Never the open executor: with it, a Work release would run without
        // its attestation (ADR-015, alternatives considered).
        assertFalse(timelock.hasRole(timelock.EXECUTOR_ROLE(), address(0)));

        // The timelock administers itself, and nobody else does.
        assertTrue(timelock.hasRole(timelock.DEFAULT_ADMIN_ROLE(), address(timelock)));
        assertFalse(timelock.hasRole(timelock.DEFAULT_ADMIN_ROLE(), address(this)));
        assertFalse(timelock.hasRole(timelock.DEFAULT_ADMIN_ROLE(), address(governance)));
    }

    function test_TimelockIsSoleReleaserAndPayeeExecutor() public view {
        bytes32 releaser = treasury.RELEASER_ROLE();
        assertEq(treasury.getRoleMemberCount(releaser), 1);
        assertEq(treasury.getRoleMember(releaser, 0), address(timelock));
        assertEq(payees.executor(), address(timelock));
    }

    /// An address other than Governance cannot schedule on the timelock.
    function testFuzz_OnlyGovernanceSchedules(address caller) public {
        vm.assume(caller != address(governance));
        bytes memory data = abi.encodeCall(IRelease.release, (Fund.Operating, caller, 1, 1));
        bytes32 proposer = timelock.PROPOSER_ROLE();

        vm.prank(caller);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                caller,
                proposer
            )
        );
        timelock.schedule(address(treasury), 0, data, bytes32(0), bytes32(0), 7 days);
    }

    /// Nobody can run a ready operation on the timelock except through
    /// `Governance.execute`, so its checks cannot be stepped around.
    function testFuzz_OnlyGovernanceExecutesOnTimelock(address caller) public {
        vm.assume(caller != address(governance));
        uint256 proposalId = _passedAdmit();
        uint256 eta = governance.queue(proposalId);
        vm.warp(eta);
        (address target, bytes memory data, ) = governance.operation(proposalId);
        bytes32 executor = timelock.EXECUTOR_ROLE();

        vm.prank(caller);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                caller,
                executor
            )
        );
        timelock.execute(target, 0, data, bytes32(0), bytes32(proposalId));
    }

    /// Governance builds two calls, and neither targets the timelock, so no
    /// operation can change a role or the delay there (doc/design/spec.md §4).
    function testFuzz_OperationNeverTargetsTimelock(bool work) public {
        uint256 proposalId = work ? _passedWork() : _passedAdmit();
        (address target, , ) = governance.operation(proposalId);

        assertTrue(target != address(timelock));
        assertEq(target, work ? address(treasury) : address(payees));
    }

    // --- queue (FR22) ----------------------------------------------------------

    function test_AnyoneQueuesAPassedProposal() public {
        uint256 proposalId = _passedAdmit();
        uint256 expectedEta = block.timestamp + 7 days;

        vm.expectEmit(address(governance));
        emit ProposalQueued(proposalId, expectedEta);
        vm.prank(stranger);
        uint256 eta = governance.queue(proposalId);

        assertEq(eta, expectedEta);
        assertEq(_state(proposalId), uint8(Governance.ProposalState.Queued));
        (, , bytes32 operationId) = governance.operation(proposalId);
        assertTrue(timelock.isOperationPending(operationId));
        assertEq(timelock.getTimestamp(operationId), eta);
    }

    /// A work proposal schedules one release of its whole limit (ADR-015,
    /// amendment of 02-10-2026).
    function test_WorkSchedulesOneReleaseOfTheWholeLimit() public {
        uint256 proposalId = _passedWork();
        (address target, bytes memory data, ) = governance.operation(proposalId);

        assertEq(target, address(treasury));
        assertEq(
            data,
            abi.encodeCall(IRelease.release, (Fund.Operating, vendor, LIMIT, proposalId))
        );
    }

    function test_AdmitSchedulesTheAdmission() public {
        uint256 proposalId = _passedAdmit();
        (address target, bytes memory data, ) = governance.operation(proposalId);

        assertEq(target, address(payees));
        assertEq(data, abi.encodeCall(IAdmit.admit, (vendor, proposalId)));
    }

    function test_QueueRefusesOpenProposal() public {
        vm.prank(firm);
        uint256 proposalId = governance.propose(vendor);

        vm.expectRevert(
            abi.encodeWithSelector(
                Governance.NotPassed.selector,
                proposalId,
                Governance.ProposalState.Open
            )
        );
        governance.queue(proposalId);
    }

    function test_QueueRefusesFailedProposal() public {
        vm.prank(firm);
        uint256 proposalId = governance.propose(vendor);
        vm.warp(block.timestamp + 21 days);

        vm.expectRevert(
            abi.encodeWithSelector(
                Governance.NotPassed.selector,
                proposalId,
                Governance.ProposalState.Failed
            )
        );
        governance.queue(proposalId);
    }

    function test_QueueRefusesSecondSchedule() public {
        uint256 proposalId = _passedAdmit();
        governance.queue(proposalId);

        vm.expectRevert(abi.encodeWithSelector(Governance.AlreadyQueued.selector, proposalId));
        governance.queue(proposalId);
    }

    function test_QueueRefusesUnknownProposal() public {
        vm.expectRevert(abi.encodeWithSelector(Governance.UnknownProposal.selector, 42));
        governance.queue(42);
    }

    function test_OperationOfUnknownProposalReverts() public {
        vm.expectRevert(abi.encodeWithSelector(Governance.UnknownProposal.selector, 42));
        governance.operation(42);
    }

    // --- execute (FR21, FR22, FR25) ------------------------------------------

    /// FR21: nothing runs before the 7 days have elapsed.
    function testFuzz_ExecuteBeforeDelayReverts(uint256 elapsed) public {
        elapsed = bound(elapsed, 0, 7 days - 1);
        uint256 proposalId = _passedAdmit();
        uint256 eta = governance.queue(proposalId);
        vm.warp(block.timestamp + elapsed);

        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Governance.NotReady.selector, proposalId, eta));
        governance.execute(proposalId);
        assertFalse(payees.isRegistered(vendor));
    }

    /// FR22: once the delay has elapsed anyone may execute, and the vendor is
    /// admitted by the timelock, the registry's only executor.
    function test_AnyoneExecutesAnAdmissionOnceReady() public {
        uint256 proposalId = _passedAdmit();
        vm.warp(governance.queue(proposalId));

        vm.expectEmit(address(payees));
        emit PayeeAdmitted(vendor, proposalId);
        vm.prank(stranger);
        governance.execute(proposalId);

        assertTrue(payees.isRegistered(vendor));
        assertEq(_state(proposalId), uint8(Governance.ProposalState.Executed));
    }

    function test_ExecuteRefusesUnqueuedProposal() public {
        uint256 proposalId = _passedAdmit();

        vm.expectRevert(
            abi.encodeWithSelector(
                Governance.NotQueued.selector,
                proposalId,
                Governance.ProposalState.Passed
            )
        );
        governance.execute(proposalId);
    }

    function test_ExecuteRefusesSecondRun() public {
        uint256 proposalId = _admitVendor();

        vm.expectRevert(abi.encodeWithSelector(Governance.AlreadyExecuted.selector, proposalId));
        governance.execute(proposalId);
    }

    /// FR25: a work proposal's release, scheduled at queueing, does not run
    /// without the firm's attestation, however long it has been ready.
    function test_ExecuteRefusesUnattestedWork() public {
        uint256 proposalId = _passedWork();
        vm.warp(governance.queue(proposalId) + 365 days);

        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Governance.NotAttested.selector, proposalId));
        governance.execute(proposalId);

        assertEq(token.balanceOf(vendor), 0);
        assertEq(treasury.released(proposalId), 0);
        assertEq(_state(proposalId), uint8(Governance.ProposalState.Queued));
    }
}
