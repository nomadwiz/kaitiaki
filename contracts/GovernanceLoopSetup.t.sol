// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {Test} from "forge-std/Test.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {Governance} from "./Governance.sol";
import {MembershipRegistry} from "./MembershipRegistry.sol";
import {PayeeRegistry} from "./PayeeRegistry.sol";
import {Treasury} from "./Treasury.sol";
import {MockNZD} from "./MockNZD.sol";
import {Fund, IRelease} from "./interfaces/IRelease.sol";

/// @notice The real contracts, wired as ADR-015 sets out, and the steps of the
/// loop as helpers. Shared by the timelock (#56) and attestation (#57) suites;
/// it holds no tests of its own.
abstract contract GovernanceLoopSetup is Test {
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

    /// A work proposal for the admitted vendor, raised and not yet voted on.
    function _workProposal() internal returns (uint256 proposalId) {
        _admitVendor();
        vm.prank(firm);
        proposalId = governance.propose("Roof repair", LIMIT, Fund.Operating, vendor, bytes32(0));
    }

    function _passedWork() internal returns (uint256 proposalId) {
        proposalId = _workProposal();
        _pass(proposalId);
    }

    /// A passed work proposal, queued, with the timelock's 7 days elapsed.
    function _readyWork() internal returns (uint256 proposalId) {
        proposalId = _passedWork();
        vm.warp(governance.queue(proposalId));
    }

    function _state(uint256 proposalId) internal view returns (uint8) {
        return uint8(governance.state(proposalId));
    }
}
