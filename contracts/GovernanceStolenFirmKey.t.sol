// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {Governance} from "./Governance.sol";
import {GovernanceLoopSetup} from "./GovernanceLoopSetup.t.sol";
import {PayeeRegistry} from "./PayeeRegistry.sol";
import {Treasury} from "./Treasury.sol";
import {Fund, IRelease} from "./interfaces/IRelease.sol";

/// @notice Issue #70. QAS-8, compromised firm key (doc/design/sad.md §2.3),
/// proving NFR3: an attacker holding the management firm's key does
/// everything the firm may, and everything anyone may, and reaches no new
/// address. Admitting a payee needs an affirmative owner vote the key cannot
/// cast (functional view R3, ADR-001). Every contract is the real one.
///
/// The attacker inherits the building as the firm left it: one vendor the
/// owners admitted, and one work proposal for it that passed and waits out the
/// timelock. The most the key can do with that is pay the admitted vendor its
/// approved limit — the QAS-11 limit — never a new address.
contract GovernanceStolenFirmKeyTest is GovernanceLoopSetup {
    uint256 internal constant DEPOSITED = 1_000e18;

    /// `newAddress` is any address the owners never admitted, which the
    /// attacker wants paid.
    function testFuzz_StolenFirmKeyReachesNoNewAddress(address newAddress) public {
        _assumeNew(newAddress);
        uint256 workId = _readyWork();

        // 1. Pay directly from the treasury: only the timelock may (G1).
        vm.expectRevert(abi.encodeWithSelector(Treasury.UnauthorizedReleaser.selector, firm));
        vm.prank(firm);
        treasury.release(Fund.Operating, newAddress, LIMIT, workId);

        // 2. Take the releaser role: no address administers roles (FR31).
        bytes32 releaser = treasury.RELEASER_ROLE();
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                firm,
                treasury.DEFAULT_ADMIN_ROLE()
            )
        );
        vm.prank(firm);
        treasury.grantRole(releaser, firm);

        // 3. Schedule a payment on the timelock directly: only Governance may.
        bytes memory payNew = abi.encodeCall(
            IRelease.release,
            (Fund.Operating, newAddress, LIMIT, workId)
        );
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                firm,
                timelock.PROPOSER_ROLE()
            )
        );
        vm.prank(firm);
        timelock.schedule(address(treasury), 0, payNew, bytes32(0), bytes32(0), 7 days);

        // 4. Admit the new address directly: only the timelock may (FR12).
        vm.expectRevert(abi.encodeWithSelector(PayeeRegistry.UnauthorizedExecutor.selector, firm));
        vm.prank(firm);
        payees.admit(newAddress, workId);

        // 5. Propose work paying the new address: refused at creation (B2).
        vm.expectRevert(abi.encodeWithSelector(Governance.PayeeNotRegistered.selector, newAddress));
        vm.prank(firm);
        governance.propose("Roof repair", LIMIT, Fund.Operating, newAddress, bytes32(0));

        // 6. Propose admitting the new address — the firm may — and carry it
        // as far as the key can. Neither the key nor the new address holds a
        // unit, so neither can vote (B8), and the owners do nothing.
        vm.prank(firm);
        uint256 admitId = governance.propose(newAddress);
        vm.expectRevert(abi.encodeWithSelector(Governance.NotBoundOwner.selector, firm));
        vm.prank(firm);
        governance.castVote(admitId, true);
        vm.expectRevert(abi.encodeWithSelector(Governance.NotBoundOwner.selector, newAddress));
        vm.prank(newAddress);
        governance.castVote(admitId, true);

        // Past the window and the quorum extension, a proposal nobody voted
        // for fails, so there is nothing to queue or execute.
        vm.warp(
            governance.proposal(admitId).createdAt +
                governance.VOTING_PERIOD() +
                governance.EXTENSION()
        );
        assertEq(_state(admitId), uint8(Governance.ProposalState.Failed));
        vm.expectRevert(
            abi.encodeWithSelector(
                Governance.NotPassed.selector,
                admitId,
                Governance.ProposalState.Failed
            )
        );
        vm.prank(firm);
        governance.queue(admitId);
        vm.expectRevert(
            abi.encodeWithSelector(
                Governance.NotQueued.selector,
                admitId,
                Governance.ProposalState.Failed
            )
        );
        vm.prank(firm);
        governance.execute(admitId);

        // 7. Use the power the key does have: attest the inherited work and
        // execute it. It pays — but only the admitted vendor, only the limit
        // the owners approved, and only from the fund they approved.
        vm.prank(firm);
        governance.attest(workId, keccak256("no work was done"));
        vm.prank(firm);
        governance.execute(workId);

        // QAS-8's measure: funds reachable at the new address = 0.
        assertEq(token.balanceOf(newAddress), 0);
        assertFalse(payees.isRegistered(newAddress));
        // The bound on the loss: one approved limit, to the admitted vendor.
        assertEq(token.balanceOf(vendor), LIMIT);
        assertEq(treasury.released(workId), LIMIT);
        assertEq(
            treasury.balanceOf(Fund.Operating) + treasury.balanceOf(Fund.LongTermMaintenance),
            DEPOSITED - LIMIT
        );
    }

    /// Excludes every address the setup gave a role, a unit or an admission.
    function _assumeNew(address candidate) internal view {
        vm.assume(candidate != address(0));
        vm.assume(candidate != firm && candidate != vendor && candidate != stranger);
        vm.assume(candidate != alice && candidate != bob && candidate != carol);
        vm.assume(candidate != address(this) && candidate != address(token));
        vm.assume(candidate != address(members) && candidate != address(payees));
        vm.assume(candidate != address(treasury) && candidate != address(governance));
        vm.assume(candidate != address(timelock));
    }
}
