// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {Test} from "forge-std/Test.sol";
import {Governance} from "./Governance.sol";
import {Fund} from "./interfaces/IRelease.sol";
import {IPayeeQuery} from "./interfaces/IPayeeQuery.sol";
import {IMembershipQuery} from "./interfaces/IMembershipQuery.sol";
import {PayeeRegistryStub} from "./stubs/PayeeRegistryStub.sol";
import {MembershipRegistryStub} from "./stubs/MembershipRegistryStub.sol";

/// @notice Issue #53. Raising proposals: FR16, FR17, FR18. The refusal test B2
/// itself is issue #61 and is written by another member (docs/ownership.md);
/// the unregistered-vendor case here only proves the guard exists.
contract GovernanceProposeTest is Test {
    Governance internal governance;
    PayeeRegistryStub internal payees;
    MembershipRegistryStub internal members;

    address internal firm = makeAddr("firm");
    address internal vendor = makeAddr("vendor");
    address internal stranger = makeAddr("stranger");

    bytes32 internal constant QUOTE_HASH = keccak256("quote: repaint stairwell");

    event ProposalCreated(
        uint256 indexed proposalId,
        Governance.ProposalKind kind,
        address indexed payee,
        uint256 limit,
        Fund fund,
        bytes32 quoteHash,
        string description
    );

    function setUp() public {
        payees = new PayeeRegistryStub();
        members = new MembershipRegistryStub();
        governance = new Governance(firm, payees, members);
    }

    // --- Deployment ----------------------------------------------------------

    function test_ConstructorRecordsFirmAndRegistry() public view {
        assertEq(governance.firm(), firm);
        assertEq(address(governance.payees()), address(payees));
        assertEq(address(governance.members()), address(members));
        assertEq(governance.proposalCount(), 0);
    }

    function test_ConstructorRefusesZeroFirm() public {
        vm.expectRevert(Governance.FirmIsZero.selector);
        new Governance(address(0), payees, members);
    }

    function test_ConstructorRefusesZeroRegistry() public {
        vm.expectRevert(Governance.PayeeRegistryIsZero.selector);
        new Governance(firm, IPayeeQuery(address(0)), members);
    }

    function test_ConstructorRefusesZeroMembershipRegistry() public {
        vm.expectRevert(Governance.MembershipRegistryIsZero.selector);
        new Governance(firm, payees, IMembershipQuery(address(0)));
    }

    // --- FR16: the firm may propose admitting a vendor -----------------------

    function test_FirmProposesAdmit() public {
        vm.prank(firm);
        uint256 id = governance.propose(vendor);

        assertEq(id, 1);
        Governance.Proposal memory p = governance.proposal(id);
        assertEq(uint8(p.kind), uint8(Governance.ProposalKind.Admit));
        assertEq(p.payee, vendor);
        assertEq(p.limit, 0);
        assertEq(p.createdAt, block.timestamp);
    }

    /// Raising an admit proposal admits nobody; only an executed vote does.
    function test_ProposeAdmitDoesNotRegisterVendor() public {
        vm.prank(firm);
        governance.propose(vendor);
        assertFalse(payees.isRegistered(vendor));
    }

    function test_ProposeAdmitEmitsProposalCreated() public {
        vm.expectEmit(address(governance));
        emit ProposalCreated(1, Governance.ProposalKind.Admit, vendor, 0, Fund.Operating, 0, "");
        vm.prank(firm);
        governance.propose(vendor);
    }

    function test_ProposeAdmitRefusesZeroVendor() public {
        vm.prank(firm);
        vm.expectRevert(Governance.VendorIsZero.selector);
        governance.propose(address(0));
    }

    function testFuzz_ProposeAdmitRefusesNonFirm(address caller) public {
        vm.assume(caller != firm);
        vm.prank(caller);
        vm.expectRevert(abi.encodeWithSelector(Governance.NotFirm.selector, caller));
        governance.propose(vendor);
    }

    // --- FR17: the firm may propose work against an approved vendor ----------

    function test_FirmProposesWork() public {
        payees.admit(vendor);

        vm.prank(firm);
        uint256 id = governance.propose(
            "Repaint stairwell",
            4_500e18,
            Fund.LongTermMaintenance,
            vendor,
            QUOTE_HASH
        );

        Governance.Proposal memory p = governance.proposal(id);
        assertEq(uint8(p.kind), uint8(Governance.ProposalKind.Work));
        assertEq(p.payee, vendor);
        assertEq(p.limit, 4_500e18);
        assertEq(uint8(p.fund), uint8(Fund.LongTermMaintenance));
        assertEq(p.quoteHash, QUOTE_HASH);
        assertEq(p.description, "Repaint stairwell");
        assertEq(p.createdAt, block.timestamp);
    }

    /// The event alone carries every stored field (rule 6, QAS-4).
    function test_ProposeWorkEmitsProposalCreated() public {
        payees.admit(vendor);

        vm.expectEmit(address(governance));
        emit ProposalCreated(
            1,
            Governance.ProposalKind.Work,
            vendor,
            4_500e18,
            Fund.Operating,
            QUOTE_HASH,
            "Repaint stairwell"
        );
        vm.prank(firm);
        governance.propose("Repaint stairwell", 4_500e18, Fund.Operating, vendor, QUOTE_HASH);
    }

    function testFuzz_ProposeWorkRefusesNonFirm(address caller) public {
        vm.assume(caller != firm);
        payees.admit(vendor);

        vm.prank(caller);
        vm.expectRevert(abi.encodeWithSelector(Governance.NotFirm.selector, caller));
        governance.propose("Repaint stairwell", 1e18, Fund.Operating, vendor, QUOTE_HASH);
    }

    // --- FR18: an unapproved vendor is refused at creation -------------------

    function test_ProposeWorkRefusesUnregisteredVendor() public {
        vm.prank(firm);
        vm.expectRevert(abi.encodeWithSelector(Governance.PayeeNotRegistered.selector, stranger));
        governance.propose("Repaint stairwell", 1e18, Fund.Operating, stranger, QUOTE_HASH);
        assertEq(governance.proposalCount(), 0);
    }

    // --- Ids -----------------------------------------------------------------

    function test_IdsIncreaseFromOne() public {
        payees.admit(vendor);

        vm.startPrank(firm);
        assertEq(governance.propose(stranger), 1);
        assertEq(governance.propose("Roof", 1e18, Fund.Operating, vendor, QUOTE_HASH), 2);
        assertEq(governance.propose(stranger), 3);
        vm.stopPrank();

        assertEq(governance.proposalCount(), 3);
    }

    function test_UnknownIdIsZeroed() public view {
        assertEq(governance.proposal(42).createdAt, 0);
    }
}
