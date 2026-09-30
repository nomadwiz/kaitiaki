// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {Test} from "forge-std/Test.sol";
import {PayeeRegistry} from "./PayeeRegistry.sol";

contract PayeeRegistryTest is Test {
    PayeeRegistry internal payees;
    address internal executor = makeAddr("executor");
    address internal firm = makeAddr("firm");
    address internal vendor = makeAddr("vendor");

    event PayeeAdmitted(address indexed payee, uint256 indexed proposalId);

    function setUp() public {
        payees = new PayeeRegistry(executor);
    }

    function test_ConstructorRecordsExecutor() public view {
        assertEq(payees.executor(), executor);
    }

    function test_ConstructorRejectsZeroExecutor() public {
        vm.expectRevert(PayeeRegistry.ExecutorIsZero.selector);
        new PayeeRegistry(address(0));
    }

    function test_DirectAdmissionFromFirmReverts() public {
        vm.expectRevert(abi.encodeWithSelector(PayeeRegistry.UnauthorizedExecutor.selector, firm));
        vm.prank(firm);
        payees.admit(vendor, 1);
    }

    function testFuzz_AdmissionFromAnyNonExecutorReverts(address caller) public {
        vm.assume(caller != executor);
        vm.expectRevert(
            abi.encodeWithSelector(PayeeRegistry.UnauthorizedExecutor.selector, caller)
        );
        vm.prank(caller);
        payees.admit(vendor, 1);
    }

    function test_ExecutorAdmissionRegistersPayeeAndEmitsProposal() public {
        vm.expectEmit(address(payees));
        emit PayeeAdmitted(vendor, 42);

        vm.prank(executor);
        payees.admit(vendor, 42);

        assertTrue(payees.isRegistered(vendor));
    }

    function test_AdmissionRejectsZeroProposalId() public {
        vm.expectRevert(PayeeRegistry.ProposalIdIsZero.selector);
        vm.prank(executor);
        payees.admit(vendor, 0);
    }

    function test_AdmissionRejectsZeroPayee() public {
        vm.expectRevert(PayeeRegistry.PayeeIsZero.selector);
        vm.prank(executor);
        payees.admit(address(0), 1);
    }

    function test_AdmissionRejectsDuplicateAndKeepsFirstAdmission() public {
        vm.prank(executor);
        payees.admit(vendor, 1);

        vm.expectRevert(
            abi.encodeWithSelector(PayeeRegistry.PayeeAlreadyRegistered.selector, vendor, 1)
        );
        vm.prank(executor);
        payees.admit(vendor, 1);

        assertTrue(payees.isRegistered(vendor));
    }

    function test_AdmissionUnderNewProposalRejectedWithFirstId() public {
        vm.prank(executor);
        payees.admit(vendor, 1);

        vm.expectRevert(
            abi.encodeWithSelector(PayeeRegistry.PayeeAlreadyRegistered.selector, vendor, 1)
        );
        vm.prank(executor);
        payees.admit(vendor, 2);
    }

    function test_IsRegisteredIsReadableByAnyCaller() public {
        vm.prank(executor);
        payees.admit(vendor, 1);

        vm.prank(makeAddr("anyone"));
        assertTrue(payees.isRegistered(vendor));
        assertFalse(payees.isRegistered(makeAddr("unknown")));
    }
}
