// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {Test} from "forge-std/Test.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {Governance} from "./Governance.sol";
import {Fund, IRelease} from "./interfaces/IRelease.sol";
import {IPayeeQuery} from "./interfaces/IPayeeQuery.sol";
import {IMembershipQuery} from "./interfaces/IMembershipQuery.sol";
import {IArrearsQuery} from "./interfaces/IArrearsQuery.sol";
import {PayeeRegistryStub} from "./stubs/PayeeRegistryStub.sol";
import {MembershipRegistryStub} from "./stubs/MembershipRegistryStub.sol";
import {LevyLedgerStub} from "./stubs/LevyLedgerStub.sol";

/// @notice Issue #53. Raising proposals: FR16, FR17, FR18. Refusal test B2 is
/// the fuzz test in `GovernanceRefusals.t.sol` (#61); the unregistered-vendor
/// case here is the guard's own test.
contract GovernanceProposeTest is Test {
    Governance internal governance;
    PayeeRegistryStub internal payees;
    MembershipRegistryStub internal members;
    LevyLedgerStub internal levies;

    address internal firm = makeAddr("firm");
    address internal vendor = makeAddr("vendor");
    address internal stranger = makeAddr("stranger");
    address internal owner = makeAddr("owner");

    bytes32 internal constant QUOTE_HASH = keccak256("quote: repaint stairwell");

    event ProposalCreated(
        uint256 indexed proposalId,
        Governance.ProposalKind kind,
        address indexed payee,
        uint256 limit,
        Fund fund,
        bytes32 quoteHash,
        string description,
        uint256 principalUnits,
        string companyId
    );

    TimelockController internal timelock;
    IRelease internal treasury = IRelease(makeAddr("treasury"));

    function setUp() public {
        payees = new PayeeRegistryStub();
        members = new MembershipRegistryStub();
        levies = new LevyLedgerStub();
        timelock = new TimelockController(7 days, new address[](0), new address[](0), address(0));
        governance = new Governance(firm, payees, members, levies, timelock, treasury);
    }

    // --- Deployment ----------------------------------------------------------

    function test_ConstructorRecordsFirmAndRegistry() public view {
        assertEq(governance.firm(), firm);
        assertEq(address(governance.payees()), address(payees));
        assertEq(address(governance.members()), address(members));
        assertEq(address(governance.levies()), address(levies));
        assertEq(address(governance.timelock()), address(timelock));
        assertEq(address(governance.treasury()), address(treasury));
        assertEq(governance.proposalCount(), 0);
    }

    function test_ConstructorRefusesZeroFirm() public {
        vm.expectRevert(Governance.FirmIsZero.selector);
        new Governance(address(0), payees, members, levies, timelock, treasury);
    }

    function test_ConstructorRefusesZeroRegistry() public {
        vm.expectRevert(Governance.PayeeRegistryIsZero.selector);
        new Governance(firm, IPayeeQuery(address(0)), members, levies, timelock, treasury);
    }

    function test_ConstructorRefusesZeroMembershipRegistry() public {
        vm.expectRevert(Governance.MembershipRegistryIsZero.selector);
        new Governance(firm, payees, IMembershipQuery(address(0)), levies, timelock, treasury);
    }

    function test_ConstructorRefusesZeroLevyLedger() public {
        vm.expectRevert(Governance.LevyLedgerIsZero.selector);
        new Governance(firm, payees, members, IArrearsQuery(address(0)), timelock, treasury);
    }

    function test_ConstructorRefusesZeroTimelock() public {
        vm.expectRevert(Governance.TimelockIsZero.selector);
        new Governance(
            firm,
            payees,
            members,
            levies,
            TimelockController(payable(address(0))),
            treasury
        );
    }

    function test_ConstructorRefusesZeroTreasury() public {
        vm.expectRevert(Governance.TreasuryIsZero.selector);
        new Governance(firm, payees, members, levies, timelock, IRelease(address(0)));
    }

    // --- FR16: the firm may propose admitting a vendor -----------------------

    function test_FirmProposesAdmit() public {
        vm.prank(firm);
        uint256 id = governance.propose(vendor, "Test Vendor Ltd", "TEST-0001");

        assertEq(id, 1);
        Governance.Proposal memory p = governance.proposal(id);
        assertEq(uint8(p.kind), uint8(Governance.ProposalKind.Admit));
        assertEq(p.payee, vendor);
        assertEq(p.limit, 0);
        assertEq(uint8(p.fund), uint8(Fund.Operating));
        assertEq(p.quoteHash, bytes32(0));
        assertEq(p.description, "Test Vendor Ltd");
        assertEq(p.companyId, "TEST-0001");
        assertEq(p.createdAt, block.timestamp);
    }

    function test_ProposeAdmitRefusesEmptyName() public {
        vm.prank(firm);
        vm.expectRevert(Governance.VendorNameIsEmpty.selector);
        governance.propose(vendor, "", "TEST-0001");
    }

    function test_ProposeAdmitRefusesEmptyCompanyId() public {
        vm.prank(firm);
        vm.expectRevert(Governance.CompanyIdIsEmpty.selector);
        governance.propose(vendor, "Test Vendor Ltd", "");
    }

    /// Raising an admit proposal admits nobody; only an executed vote does.
    function test_ProposeAdmitDoesNotRegisterVendor() public {
        vm.prank(firm);
        governance.propose(vendor, "Test Vendor Ltd", "TEST-0001");
        assertFalse(payees.isRegistered(vendor));
    }

    function test_ProposeAdmitEmitsProposalCreated() public {
        members.bindUnit(1, owner);
        members.bindUnit(2, owner);

        vm.expectEmit(address(governance));
        emit ProposalCreated(
            1,
            Governance.ProposalKind.Admit,
            vendor,
            0,
            Fund.Operating,
            0,
            "Test Vendor Ltd",
            2,
            "TEST-0001"
        );
        vm.prank(firm);
        governance.propose(vendor, "Test Vendor Ltd", "TEST-0001");
    }

    function test_ProposeAdmitRefusesZeroVendor() public {
        vm.prank(firm);
        vm.expectRevert(Governance.VendorIsZero.selector);
        governance.propose(address(0), "Test Vendor Ltd", "TEST-0001");
    }

    function testFuzz_ProposeAdmitRefusesNonFirm(address caller) public {
        vm.assume(caller != firm);
        vm.prank(caller);
        vm.expectRevert(abi.encodeWithSelector(Governance.NotFirm.selector, caller));
        governance.propose(vendor, "Test Vendor Ltd", "TEST-0001");
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
        assertEq(p.companyId, "");
        assertEq(p.createdAt, block.timestamp);
    }

    function test_ApprovedSpendReturnsWorkTerms() public {
        payees.admit(vendor);

        vm.prank(firm);
        uint256 id = governance.propose(
            "Repaint stairwell",
            4_500e18,
            Fund.LongTermMaintenance,
            vendor,
            QUOTE_HASH
        );

        (bool exists, Fund fund, uint256 limit, address approvedPayee) = governance.approvedSpend(
            id
        );
        assertTrue(exists);
        assertEq(uint8(fund), uint8(Fund.LongTermMaintenance));
        assertEq(limit, 4_500e18);
        assertEq(approvedPayee, vendor);
    }

    function test_ApprovedSpendRejectsAdmitAndUnknownIds() public {
        vm.prank(firm);
        uint256 admitId = governance.propose(vendor, "Test Vendor Ltd", "TEST-0001");

        (bool admitExists, , uint256 admitLimit, address admitPayee) = governance.approvedSpend(
            admitId
        );
        assertFalse(admitExists);
        assertEq(admitLimit, 0);
        assertEq(admitPayee, vendor);

        (bool unknownExists, , uint256 unknownLimit, address unknownPayee) = governance
            .approvedSpend(999);
        assertFalse(unknownExists);
        assertEq(unknownLimit, 0);
        assertEq(unknownPayee, address(0));
    }

    /// The event alone carries every stored field (rule 6, QAS-4).
    function test_ProposeWorkEmitsProposalCreated() public {
        payees.admit(vendor);
        members.bindUnit(1, owner);

        vm.expectEmit(address(governance));
        emit ProposalCreated(
            1,
            Governance.ProposalKind.Work,
            vendor,
            4_500e18,
            Fund.Operating,
            QUOTE_HASH,
            "Repaint stairwell",
            1,
            ""
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
        assertEq(governance.propose(stranger, "Test Vendor Ltd", "TEST-0001"), 1);
        assertEq(governance.propose("Roof", 1e18, Fund.Operating, vendor, QUOTE_HASH), 2);
        assertEq(governance.propose(stranger, "Test Vendor Ltd", "TEST-0001"), 3);
        vm.stopPrank();

        assertEq(governance.proposalCount(), 3);
    }

    function test_UnknownIdIsZeroed() public view {
        assertEq(governance.proposal(42).createdAt, 0);
    }
}
