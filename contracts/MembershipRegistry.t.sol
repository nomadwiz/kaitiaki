// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {Test} from "forge-std/Test.sol";
import {MembershipRegistry} from "./MembershipRegistry.sol";

/// @notice Issue #46. The unit register: FR1, FR2, FR19; ADR-003. The refusal
/// test B8 — an unbound wallet cannot vote — is issue #67 and is written by
/// another member (ownership.md); it exercises `Governance.castVote`, not this
/// contract.
contract MembershipRegistryTest is Test {
    MembershipRegistry internal registry;

    address internal adapter = makeAddr("adapter");
    address internal owner = makeAddr("owner");
    address internal neighbour = makeAddr("neighbour");
    address internal stranger = makeAddr("stranger");

    event UnitBound(uint256 indexed unitId, address indexed wallet);

    function setUp() public {
        registry = new MembershipRegistry(adapter);
    }

    function _bind(uint256 unitId, address wallet) internal {
        vm.prank(adapter);
        registry.bindUnit(unitId, wallet);
    }

    // --- Deployment ----------------------------------------------------------

    function test_ConstructorRecordsAdapter() public view {
        assertEq(registry.adapter(), adapter);
    }

    function test_ConstructorRefusesZeroAdapter() public {
        vm.expectRevert(MembershipRegistry.AdapterIsZero.selector);
        new MembershipRegistry(address(0));
    }

    // --- Binding: the adapter only ------------------------------------------

    function test_AdapterBindsUnit() public {
        _bind(7, owner);

        assertEq(registry.ownerOf(7), owner);
        assertTrue(registry.isOwner(7, owner));
        uint256[] memory units = registry.unitsOf(owner);
        assertEq(units.length, 1);
        assertEq(units[0], 7);
    }

    function test_BindEmitsUnitBound() public {
        vm.expectEmit(true, true, false, true, address(registry));
        emit UnitBound(7, owner);
        _bind(7, owner);
    }

    function testFuzz_BindRefusesNonAdapter(address caller) public {
        vm.assume(caller != adapter);
        vm.prank(caller);
        vm.expectRevert(abi.encodeWithSelector(MembershipRegistry.NotAdapter.selector, caller));
        registry.bindUnit(7, owner);
    }

    function test_BindRefusesZeroWallet() public {
        vm.prank(adapter);
        vm.expectRevert(MembershipRegistry.WalletIsZero.selector);
        registry.bindUnit(7, address(0));
    }

    // --- FR1: a unit binds to exactly one wallet -----------------------------

    function test_BindRefusesUnitBoundToAnotherWallet() public {
        _bind(7, owner);

        vm.prank(adapter);
        vm.expectRevert(
            abi.encodeWithSelector(MembershipRegistry.UnitAlreadyBound.selector, 7, owner)
        );
        registry.bindUnit(7, neighbour);

        assertTrue(registry.isOwner(7, owner));
        assertFalse(registry.isOwner(7, neighbour));
        assertEq(registry.unitsOf(neighbour).length, 0);
    }

    /// A repeated binding to the same wallet is refused too, so a unit can
    /// never appear twice in its owner's list and count twice towards weight.
    function test_BindRefusesUnitBoundToSameWallet() public {
        _bind(7, owner);

        vm.prank(adapter);
        vm.expectRevert(
            abi.encodeWithSelector(MembershipRegistry.UnitAlreadyBound.selector, 7, owner)
        );
        registry.bindUnit(7, owner);

        assertEq(registry.unitsOf(owner).length, 1);
    }

    // --- FR2: only bound wallets are recognised ------------------------------

    function test_UnboundWalletIsNotOwner() public {
        _bind(7, owner);

        assertFalse(registry.isOwner(7, stranger));
        assertFalse(registry.isOwner(8, owner));
        assertEq(registry.unitsOf(stranger).length, 0);
    }

    function test_UnboundUnitHasNoOwner() public view {
        assertEq(registry.ownerOf(7), address(0));
        assertFalse(registry.isOwner(7, address(0)));
    }

    // --- FR19: weight is the number of units held, not a share ---------------

    /// The register holds no weight of its own. A wallet's voting weight is
    /// the length of `unitsOf`, which Governance counts (ADR-003).
    function testFuzz_WeightIsUnitCount(uint8 held) public {
        for (uint256 i = 0; i < held; ++i) _bind(100 + i, owner);
        _bind(1, neighbour);

        uint256[] memory units = registry.unitsOf(owner);
        assertEq(units.length, held);
        for (uint256 i = 0; i < held; ++i) {
            assertEq(units[i], 100 + i);
            assertTrue(registry.isOwner(units[i], owner));
        }
        assertEq(registry.unitsOf(neighbour).length, 1);
    }
}
