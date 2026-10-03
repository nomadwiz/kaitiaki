// QAS-4, issues #69 and #138: replay the event log on an independent node and
// derive every fund balance, every tally, quorum, every proposal's state,
// every binding and every admitted payee from it (FR40, NFR2), and check
// FR21's eta against block times.
//
// The in-process Hardhat network stands in for a node run by a party other
// than the operator and the firm — an insurer, a lender or an audit firm
// (deployment-view.md §2.1). `replay` is handed the provider and nothing else
// from the chain; the contract view calls below are the test's own assertions,
// made only after the replay has returned.
import { expect } from "chai";
import { Interface, ZeroAddress, ZeroHash, getCreateAddress, id } from "ethers";
import { network } from "hardhat";

import { arrearsAt, replay, stateAt } from "../scripts/replay.js";

const OPERATING = 0;
const MAINTENANCE = 1;
const STATES = ["Open", "Extended", "Passed", "Failed", "Queued", "Executed"];

describe("QAS-4 replay", () => {
  it("derives fund balances, role holders, tallies, quorum, proposal states, eligibility, payees, queueing, attestation and arrears from events alone", async () => {
    const { ethers } = await network.getOrCreate();
    const [firm, adapter, alice, bob, carol, vendor, stranger] =
      await ethers.getSigners();
    const fromBlock = await ethers.provider.getBlockNumber();

    // Real contracts throughout, wired as in deployment (ADR-015): the
    // Timelock is the Treasury's sole releaser and the only address that
    // admits payees, so the admission and the payment are both queued and
    // executed through it. PayeeRegistry, Governance and Treasury name the
    // Timelock deployed after the LevyLedger, and Governance names the
    // Treasury deployed straight after it.
    const nonce = await firm.getNonce();
    const treasuryAddress = getCreateAddress({
      from: firm.address,
      nonce: nonce + 4,
    });
    const timelockAddress = getCreateAddress({
      from: firm.address,
      nonce: nonce + 6,
    });
    const token = await ethers.deployContract("MockNZD");
    const payees = await ethers.deployContract("PayeeRegistry", [
      timelockAddress,
    ]);
    const registry = await ethers.deployContract("MembershipRegistry", [
      adapter.address,
    ]);
    const governance = await ethers.deployContract("Governance", [
      firm.address,
      payees.target,
      registry.target,
      timelockAddress,
      treasuryAddress,
    ]);
    // Treasury and LevyLedger name each other: Treasury takes the ledger's
    // address before it exists (spec §4).
    const ledgerAddress = getCreateAddress({
      from: firm.address,
      nonce: (await firm.getNonce()) + 1,
    });
    const treasury = await ethers.deployContract("Treasury", [
      8_000,
      governance.target,
      timelockAddress,
      ledgerAddress,
      payees.target,
      token.target,
    ]);
    expect(treasury.target).to.equal(treasuryAddress);
    // Three charges, all due at `due`: unit 1's is paid early, unit 3's
    // late, and unit 4's never. 333 does not split evenly, so rounding is
    // exercised.
    const due =
      BigInt((await ethers.provider.getBlock("latest"))!.timestamp) + 1_000n;
    const ledger = await ethers.deployContract("LevyLedger", [
      treasury.target,
      [1n, 3n, 4n],
      [1_000n, 333n, 50n],
      [due, due, due],
    ]);
    expect(ledger.target).to.equal(ledgerAddress);
    // Governance is the Timelock's only proposer and executor, and nobody
    // administers it (ADR-015).
    const delay = await governance.TIMELOCK_DELAY();
    const timelock = await ethers.deployContract("TimelockController", [
      delay,
      [governance.target],
      [governance.target],
      ZeroAddress,
    ]);
    expect(timelock.target).to.equal(timelockAddress);
    const advance = async (seconds: bigint) => {
      await ethers.provider.send("evm_increaseTime", [Number(seconds)]);
      await ethers.provider.send("evm_mine", []);
    };

    // Four units, alice holding two of them.
    await registry.connect(adapter).bindUnit(1, alice.address);
    await registry.connect(adapter).bindUnit(2, alice.address);
    await registry.connect(adapter).bindUnit(3, bob.address);
    await registry.connect(adapter).bindUnit(4, carol.address);

    // Two levy receipts. Alice pays before the charge is issued (ADR-016);
    // then anyone issues all three once due, and bob pays after.
    await token.mint(alice.address, 1_000n);
    await token.mint(bob.address, 333n);
    await token.connect(alice).approve(ledger.target, 1_000n);
    await token.connect(bob).approve(ledger.target, 333n);
    await ledger.connect(alice).payLevy(0);
    await ethers.provider.send("evm_setNextBlockTimestamp", [Number(due) + 1]);
    await ledger.connect(stranger).issueCharges([0, 1, 2]);
    await ledger.connect(bob).payLevy(1);

    // A direct token transfer: Treasury holds it, but no fund is credited.
    await token.mint(stranger.address, 500n);
    await token.connect(stranger).transfer(treasury.target, 500n);

    // Proposal 1 admits the vendor through the whole loop: alice and bob vote
    // for it, it waits out the window and the delay, and anyone executes it.
    await governance.getFunction("propose(address)")(vendor.address);
    await governance.connect(alice).castVote(1, true);
    await governance.connect(bob).castVote(1, true);
    await advance(await governance.VOTING_PERIOD());
    await governance.connect(stranger).queue(1);
    await advance(delay);
    await governance.connect(stranger).execute(1);

    const propose = governance.getFunction(
      "propose(string,uint256,uint8,address,bytes32)",
    );
    await propose("Roof repair", 400n, OPERATING, vendor.address, ZeroHash);
    await propose("Lift overhaul", 100n, MAINTENANCE, vendor.address, ZeroHash);
    await propose("Gutter clean", 50n, OPERATING, vendor.address, ZeroHash);
    await propose("Hall repaint", 30n, MAINTENANCE, vendor.address, ZeroHash);

    // Alice votes for with units 1 and 2, then receives unit 5 and votes
    // against with it. One wallet, two votes, both counted: the tally keys on
    // units, never on the wallet (spec §6, ADR-003). Proposals 3 and 5 each
    // have one vote for, so they miss quorum's two-wallet minimum. Nobody
    // votes on proposal 4.
    await governance.connect(alice).castVote(2, true);
    await governance.connect(bob).castVote(2, false);
    await registry.connect(adapter).bindUnit(5, alice.address);
    await governance.connect(alice).castVote(2, false);
    await governance.connect(carol).castVote(2, true);
    await governance.connect(bob).castVote(3, true);
    await governance.connect(carol).castVote(5, true);

    // Proposal 2 passes when its window closes. Anyone queues it, the firm
    // attests the work once the delay has run, and anyone executes it, which
    // releases its whole limit (ADR-015). Proposals 3, 4 and 5 missed
    // quorum, so their windows extend. By the end quorum is waived: a lone
    // vote for passes proposals 3 and 5, and proposal 4, with no vote,
    // fails. Anyone then queues proposal 3.
    await advance(await governance.VOTING_PERIOD());
    await governance.connect(stranger).queue(2);
    const queuedAt = BigInt(
      (await ethers.provider.getBlock("latest"))!.timestamp,
    );
    await advance(delay);
    const evidenceHash = id("Roof repair: completion photos");
    await governance.attest(2, evidenceHash);
    await governance.connect(stranger).execute(2);
    await governance.connect(stranger).queue(3);

    const derived = await replay(
      ethers.provider,
      {
        treasury: String(treasury.target),
        governance: String(governance.target),
        membershipRegistry: String(registry.target),
        levyLedger: String(ledger.target),
        payeeRegistry: String(payees.target),
      },
      fromBlock,
    );

    // Fund balances: the internal balances, exactly. The token balance is
    // higher by the direct transfer, which the replay rightly never credits.
    expect(derived.funds.operating).to.equal(
      await treasury.balanceOf(OPERATING),
    );
    expect(derived.funds.maintenance).to.equal(
      await treasury.balanceOf(MAINTENANCE),
    );
    expect(await token.balanceOf(treasury.target)).to.equal(
      derived.funds.operating + derived.funds.maintenance + 500n,
    );

    for (const id of [2n, 3n]) {
      expect(derived.releasedByProposal.get(id) ?? 0n).to.equal(
        await treasury.released(id),
      );
      const [forVotes, againstVotes] = await governance.tallyOf(id);
      expect(derived.tallies.get(id)).to.deep.equal({ forVotes, againstVotes });
    }
    expect(derived.tallies.get(2n)).to.deep.equal({
      forVotes: 3n,
      againstVotes: 2n,
    });

    // Quorum from ProposalCreated's principal units and the VoteCast log.
    const proposalIds = [1n, 2n, 3n, 4n, 5n];
    for (const id of proposalIds) {
      expect(derived.quorum.get(id), `proposal ${id}`).to.equal(
        await governance.quorumReached(id),
      );
    }
    expect([...derived.quorum.values()]).to.deep.equal([
      true,
      true,
      false,
      false,
      false,
    ]);

    // Every proposal's state, from ProposalCreated, VoteCast, the queueing,
    // the executions and block times, equals Governance.state at the last
    // replayed block.
    const last = derived.transitions.at(-1)!.blockNumber;
    const at = BigInt((await ethers.provider.getBlock(last))!.timestamp);
    for (const id of proposalIds) {
      expect(stateAt(derived, id, at), `proposal ${id}`).to.equal(
        STATES[Number(await governance.state(id, { blockTag: last }))],
      );
    }
    expect(proposalIds.map((id) => stateAt(derived, id, at))).to.deep.equal([
      "Executed",
      "Executed",
      "Queued",
      "Failed",
      "Passed",
    ]);

    // Queueing and attestation, from ProposalQueued and WorkAttested. A
    // proposal is queued in the replay exactly when Governance has scheduled
    // it, and attested exactly when Governance.attested says so.
    const QUEUED = 4n; // Governance.ProposalState.Queued
    const EXECUTED = 5n;
    for (const id of proposalIds) {
      const state = await governance.state(id);
      expect(derived.queued.has(id), `proposal ${id}`).to.equal(
        state === QUEUED || state === EXECUTED,
      );
      expect(derived.attested.has(id), `proposal ${id}`).to.equal(
        await governance.attested(id),
      );
    }
    expect([...derived.queued.keys()]).to.deep.equal([1n, 2n, 3n]);
    expect(derived.queued.get(2n)).to.equal(queuedAt + delay);
    expect(derived.attested).to.deep.equal(
      new Map([[2n, { attester: firm.address, evidenceHash }]]),
    );

    // The payee register, and which proposal admitted each payee.
    for (const wallet of [vendor, stranger]) {
      expect(derived.payees.has(wallet.address)).to.equal(
        await payees.isRegistered(wallet.address),
      );
    }
    expect(derived.payees).to.deep.equal(new Map([[vendor.address, 1n]]));

    for (const [unitId, wallet] of derived.owners) {
      expect(wallet).to.equal(await registry.ownerOf(unitId));
    }
    for (const wallet of [alice, bob, carol]) {
      const units = [...derived.owners].filter(([, w]) => w === wallet.address);
      expect(units.map(([unitId]) => unitId)).to.deep.equal(
        await registry.unitsOf(wallet.address),
      );
    }

    // FR9: the arrears flag from the two levy events and a timestamp, for
    // every unit, matches arrearsOf at that timestamp.
    const now = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);
    for (const unitId of [1n, 2n, 3n, 4n, 5n]) {
      expect(
        arrearsAt(derived.charges, unitId, now),
        `unit ${unitId}`,
      ).to.equal(await ledger.arrearsOf(unitId));
    }
    expect(arrearsAt(derived.charges, 4n, now)).to.equal(true);
    expect(arrearsAt(derived.charges, 4n, due)).to.equal(false);

    // From the log alone: only the Timelock may release, only the LevyLedger
    // may deposit, and nobody administers either role (rule 1, QAS-8).
    expect(derived.roles.get(await treasury.RELEASER_ROLE())).to.deep.equal(
      new Set([timelockAddress]),
    );
    expect(derived.roles.get(await treasury.DEPOSITOR_ROLE())).to.deep.equal(
      new Set([ledgerAddress]),
    );
    expect(derived.roles.get(ZeroHash)).to.deep.equal(new Set());

    // Treasury's four role events at construction, then four bindings, an
    // early payment, three charges issued, a late payment, the admission
    // proposal with two votes, queued and executed, four work proposals, a
    // fifth binding, six votes, proposal 2 queued, attested and paid, then
    // proposal 3 queued.
    expect(derived.transitions.map((t) => t.name)).to.deep.equal([
      "RoleGranted",
      "RoleGranted",
      "RoleGranted",
      "RoleRevoked",
      ...Array(4).fill("UnitBound"),
      "Deposited",
      "LevyPaid",
      ...Array(3).fill("ChargeIssued"),
      "Deposited",
      "LevyPaid",
      "ProposalCreated",
      "VoteCast",
      "VoteCast",
      "ProposalQueued",
      "PayeeAdmitted",
      ...Array(4).fill("ProposalCreated"),
      "VoteCast",
      "VoteCast",
      "UnitBound",
      "VoteCast",
      "VoteCast",
      "VoteCast",
      "VoteCast",
      "ProposalQueued",
      "WorkAttested",
      "PaymentReleased",
      "ProposalQueued",
    ]);
  });

  // A node that serves a fabricated log. The replay must refuse a log that
  // contradicts itself, rather than derive a state from it.
  const vendor = "0x000000000000000000000000000000000000dead";
  const alice = "0x000000000000000000000000000000000000a11c";
  // A forged log sits in block 1 unless it names another, and each forged
  // block's timestamp is its number.
  type Event = [name: string, args: unknown[], block?: number];
  const work: Event = [
    "ProposalCreated",
    [1n, 1, vendor, 400n, 0, ZeroHash, "Roof", 1n],
  ];
  const admit: Event = [
    "ProposalCreated",
    [1n, 0, vendor, 0n, 0, ZeroHash, "", 1n],
  ];
  const bound: Event = ["UnitBound", [1n, alice]];
  const admitted: Event = ["PayeeAdmitted", [vendor, 1n]];
  const issued: Event = ["ChargeIssued", [0n, 1n, 100n, 1n]];
  // Block 1's timestamp is 1: at this eta, so `queued` makes its proposal
  // executable in block 1 and `queuedLate` does not.
  const queued: Event = ["ProposalQueued", [1n, 1n]];
  const queuedLate: Event = ["ProposalQueued", [1n, 2n]];
  const attested: Event = ["WorkAttested", [1n, alice, id("evidence")]];
  const released: Event = ["PaymentReleased", [0, vendor, 1n, 1n]];
  // The vendor admitted by proposal 2, so a release on proposal 1 can pay it.
  const vendorAdmitted: Event[] = [
    ["ProposalCreated", [2n, 0, vendor, 0n, 0, ZeroHash, "", 1n]],
    ["ProposalQueued", [2n, 1n]],
    ["PayeeAdmitted", [vendor, 2n]],
  ];
  const cases: [string, Event[], string][] = [
    [
      "a VoteCast naming a unit no UnitBound gave the voter",
      [work, ["VoteCast", [1n, alice, true, 1n, [7n]]]],
      "unit 7 is not bound to",
    ],
    [
      "a unit counted twice on one proposal",
      [
        work,
        bound,
        ["VoteCast", [1n, alice, true, 1n, [1n]]],
        ["VoteCast", [1n, alice, false, 1n, [1n]]],
      ],
      "unit 1 already voted on proposal 1",
    ],
    [
      "a VoteCast whose weight is not its number of units",
      [work, bound, ["VoteCast", [1n, alice, true, 2n, [1n]]]],
      "weight 2 for 1 units",
    ],
    [
      "a VoteCast on a proposal no ProposalCreated made",
      [bound, ["VoteCast", [1n, alice, true, 1n, [1n]]]],
      "unknown proposal 1",
    ],
    [
      "a payee admitted twice",
      [admit, queued, admitted, admitted],
      "admitted twice",
    ],
    [
      "a release to a payee no PayeeAdmitted admitted",
      [work, ["PaymentReleased", [0, vendor, 1n, 1n]]],
      "release to unadmitted",
    ],
    [
      "a release on an admission proposal",
      [admit, ["PaymentReleased", [0, vendor, 1n, 1n]]],
      "no work proposal 1",
    ],
    [
      "a charge paid for a unit other than the one it was issued to",
      [issued, ["LevyPaid", [0n, 2n, alice, 100n]]],
      "charge 0 names units 1 and 2",
    ],
    ["a charge issued twice", [issued, issued], "charge 0 issued twice"],
    [
      "a charge paid twice",
      [
        ["LevyPaid", [0n, 1n, alice, 100n]],
        ["LevyPaid", [0n, 1n, alice, 100n]],
      ],
      "charge 0 paid twice",
    ],
    [
      "a ProposalQueued on a proposal no ProposalCreated made",
      [queued],
      "queued unknown proposal 1",
    ],
    [
      "a proposal queued twice",
      [work, queued, queued],
      "proposal 1 queued twice",
    ],
    [
      "a WorkAttested on an admission proposal",
      [admit, queued, attested],
      "attestation names no work proposal 1",
    ],
    [
      "a WorkAttested on a proposal never queued",
      [work, attested],
      "proposal 1 attested before it was queued",
    ],
    [
      "a proposal attested twice",
      [work, queued, attested, attested],
      "proposal 1 attested twice",
    ],
    [
      "a PayeeAdmitted on a proposal never queued",
      [admit, admitted],
      "proposal 1 admitted a payee before it was queued",
    ],
    [
      "a PayeeAdmitted before its proposal's eta",
      [admit, queuedLate, admitted],
      "proposal 1 admitted a payee at 1, before its eta 2",
    ],
    [
      "a PaymentReleased on a proposal never queued",
      [...vendorAdmitted, work, released],
      "proposal 1 paid before it was queued",
    ],
    [
      "a PaymentReleased before its proposal's eta",
      [...vendorAdmitted, work, queuedLate, released],
      "proposal 1 paid at 1, before its eta 2",
    ],
    [
      "a log from a replayed address with no known event",
      [["unknown", []]],
      "unrecognised log",
    ],
  ];

  async function forge(events: Event[]) {
    const { ethers } = await network.getOrCreate();
    const fragments = await Promise.all(
      [
        "Governance",
        "LevyLedger",
        "MembershipRegistry",
        "PayeeRegistry",
        "Treasury",
      ].map(
        async (name) =>
          (await ethers.getContractFactory(name)).interface.fragments,
      ),
    );
    const abi = new Interface(
      fragments.flat().filter((f) => f.type === "event"),
    );
    const logs = events.map(([name, args, block = 1], index) => ({
      ...(name === "unknown"
        ? { topics: [id("Unknown()")], data: "0x" }
        : abi.encodeEventLog(name, args)),
      blockNumber: block,
      index,
    }));
    const forgedNode = {
      getLogs: async () => logs,
      getBlock: async (block: number) => ({ timestamp: block }),
    } as never;
    return replay(
      forgedNode,
      {
        treasury: "",
        governance: "",
        membershipRegistry: "",
        levyLedger: "",
        payeeRegistry: "",
      },
      0,
    );
  }

  for (const [what, events, message] of cases) {
    it(`refuses ${what}`, async () => {
      const error = await forge(events).catch((e: Error) => e);
      expect(error)
        .to.be.an("error")
        .with.property("message")
        .that.contains(message);
    });
  }

  // Quorum's unit half at its rounding boundary, which the run above never
  // reaches: two wallets each vote one unit, so two units are voted. With 8
  // principal units that is a quarter exactly; with 9 it falls short.
  it("derives quorum's unit half, rounded up, from principal units", async () => {
    const bob = "0x0000000000000000000000000000000000000b0b";
    const votedByTwo = (principalUnits: bigint): Event[] => [
      [
        "ProposalCreated",
        [1n, 1, vendor, 400n, 0, ZeroHash, "Roof", principalUnits],
      ],
      bound,
      ["UnitBound", [2n, bob]],
      ["VoteCast", [1n, alice, true, 1n, [1n]]],
      ["VoteCast", [1n, bob, false, 1n, [2n]]],
    ];
    expect((await forge(votedByTwo(8n))).quorum.get(1n)).to.equal(true);
    expect((await forge(votedByTwo(9n))).quorum.get(1n)).to.equal(false);
  });

  // A vote in the extension, which the runs above never cast. Bob's vote
  // lands as the window closes without quorum, so Governance takes it in the
  // extension and marks it. Quorum is then reached, but the proposal stays
  // Extended until the extension ends, as Governance.state has it.
  it("keeps a proposal Extended after a vote in the extension", async () => {
    const bob = "0x0000000000000000000000000000000000000b0b";
    const windowEnd = 1 + 14 * 86_400;
    const extensionEnd = windowEnd + 7 * 86_400;
    const derived = await forge([
      ["ProposalCreated", [1n, 1, vendor, 400n, 0, ZeroHash, "Roof", 4n]],
      bound,
      ["UnitBound", [2n, bob]],
      ["VoteCast", [1n, alice, true, 1n, [1n]]],
      ["VoteCast", [1n, bob, true, 1n, [2n]], windowEnd],
    ]);
    expect(derived.quorum.get(1n)).to.equal(true);
    expect(stateAt(derived, 1n, BigInt(windowEnd))).to.equal("Extended");
    expect(stateAt(derived, 1n, BigInt(extensionEnd))).to.equal("Passed");
  });
});
