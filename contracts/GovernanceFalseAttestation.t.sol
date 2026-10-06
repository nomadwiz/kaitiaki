// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {Vm} from "forge-std/Vm.sol";
import {Governance} from "./Governance.sol";
import {GovernanceLoopSetup} from "./GovernanceLoopSetup.t.sol";
import {Treasury} from "./Treasury.sol";
import {Fund} from "./interfaces/IRelease.sol";

/// @notice Issue #93. QAS-11, attestation without verification
/// (doc/design/sad.md §2.3): the firm attests work that was never done, and
/// payment releases. **Expected to succeed** — this is the honest statement of
/// the design's limit, not a defect. No contract can verify physical work, so
/// the design does not prevent a false attestation and does not detect it; it
/// makes it provable once suspected. QAS-11's measure is therefore placed on
/// the record rather than the outcome: every released payment carries an
/// attestation with an evidence hash and an identified attester, and the
/// proposal, vote, payee, amount and fund are all public — read here from the
/// event log alone, as a later adjudication would (ADR-011, ADR-012).
contract GovernanceFalseAttestationTest is GovernanceLoopSetup {
    bytes32 internal constant QUOTE = keccak256("quote: roof repair, 400 NZD");
    /// The hash of a claim with nothing behind it: no work was done.
    bytes32 internal constant FALSE_EVIDENCE = keccak256("no work was done");

    function test_FalseAttestationReleasesPaymentAndTheRecordNamesEveryone() public {
        _admitVendor();
        vm.recordLogs();

        vm.prank(firm);
        uint256 proposalId = governance.propose(
            "Roof repair",
            LIMIT,
            Fund.Operating,
            vendor,
            QUOTE
        );
        _pass(proposalId);
        vm.warp(governance.queue(proposalId));

        // The vendor does nothing. The firm attests completion anyway.
        vm.prank(firm);
        governance.attest(proposalId, FALSE_EVIDENCE);
        vm.prank(stranger);
        governance.execute(proposalId);

        // The response QAS-11 states: payment releases, in full.
        assertEq(token.balanceOf(vendor), LIMIT);
        assertEq(treasury.released(proposalId), LIMIT);

        // The measure: the record, read from the log alone.
        Vm.Log[] memory logs = vm.getRecordedLogs();
        _assertProposalOnRecord(logs, proposalId);
        _assertVoteOnRecord(logs, proposalId);
        uint256 attestedAt = _assertAttestationOnRecord(logs, proposalId);
        uint256 paidAt = _assertPaymentOnRecord(logs, proposalId);
        // Every released payment carries an attestation made before it.
        assertLt(attestedAt, paidAt);
    }

    // --- Reading the record --------------------------------------------------

    /// The proposal: its kind, payee, limit, fund and quote hash.
    function _assertProposalOnRecord(Vm.Log[] memory logs, uint256 proposalId) internal view {
        uint256 i = _find(
            logs,
            address(governance),
            Governance.ProposalCreated.selector,
            proposalId
        );
        assertEq(address(uint160(uint256(logs[i].topics[2]))), vendor, "payee");
        (
            Governance.ProposalKind kind,
            uint256 limit,
            Fund fund,
            bytes32 quoteHash,
            string memory description,
            ,

        ) = abi.decode(
                logs[i].data,
                (Governance.ProposalKind, uint256, Fund, bytes32, string, uint256, string)
            );
        assertEq(uint8(kind), uint8(Governance.ProposalKind.Work));
        assertEq(limit, LIMIT, "limit");
        assertEq(uint8(fund), uint8(Fund.Operating), "fund");
        assertEq(quoteHash, QUOTE, "quote hash");
        assertEq(description, "Roof repair");
    }

    /// The vote: who voted, which way, and with which units.
    function _assertVoteOnRecord(Vm.Log[] memory logs, uint256 proposalId) internal view {
        uint256 votes;
        uint256 unitsFor;
        for (uint256 i = 0; i < logs.length; ++i) {
            if (!_is(logs[i], address(governance), Governance.VoteCast.selector, proposalId)) {
                continue;
            }
            address voter = address(uint160(uint256(logs[i].topics[2])));
            (bool inFavour, uint256 weight, ) = abi.decode(
                logs[i].data,
                (bool, uint256, uint256[])
            );
            assertTrue(voter == alice || voter == bob, "voter is a bound owner");
            assertTrue(inFavour);
            unitsFor += weight;
            ++votes;
        }
        assertEq(votes, 2, "two votes on record");
        assertEq(unitsFor, 3, "three units for");
    }

    /// The attestation: the evidence hash, and who made the claim.
    function _assertAttestationOnRecord(
        Vm.Log[] memory logs,
        uint256 proposalId
    ) internal view returns (uint256 i) {
        i = _find(logs, address(governance), Governance.WorkAttested.selector, proposalId);
        assertEq(address(uint160(uint256(logs[i].topics[2]))), firm, "identified attester");
        assertEq(abi.decode(logs[i].data, (bytes32)), FALSE_EVIDENCE, "evidence hash");
    }

    /// The payment: the fund, the payee and the amount.
    function _assertPaymentOnRecord(
        Vm.Log[] memory logs,
        uint256 proposalId
    ) internal view returns (uint256 i) {
        uint256 found;
        for (uint256 j = 0; j < logs.length; ++j) {
            if (logs[j].emitter != address(treasury)) continue;
            if (logs[j].topics[0] != Treasury.PaymentReleased.selector) continue;
            (uint256 amount, uint256 paidUnder) = abi.decode(logs[j].data, (uint256, uint256));
            if (paidUnder != proposalId) continue;
            assertEq(uint256(logs[j].topics[1]), uint256(Fund.Operating), "fund");
            assertEq(address(uint160(uint256(logs[j].topics[2]))), vendor, "payee");
            assertEq(amount, LIMIT, "amount");
            i = j;
            ++found;
        }
        assertEq(found, 1, "one payment on record");
    }

    /// The one log `emitter` emitted with `selector` for `proposalId`, whose
    /// id is its first indexed topic.
    function _find(
        Vm.Log[] memory logs,
        address emitter,
        bytes32 selector,
        uint256 proposalId
    ) internal pure returns (uint256 index) {
        uint256 found;
        for (uint256 i = 0; i < logs.length; ++i) {
            if (_is(logs[i], emitter, selector, proposalId)) {
                index = i;
                ++found;
            }
        }
        assertEq(found, 1, "exactly one matching log");
    }

    function _is(
        Vm.Log memory log,
        address emitter,
        bytes32 selector,
        uint256 proposalId
    ) internal pure returns (bool) {
        return
            log.emitter == emitter &&
            log.topics[0] == selector &&
            log.topics.length > 1 &&
            uint256(log.topics[1]) == proposalId;
    }
}
