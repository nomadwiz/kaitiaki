// QAS-4, issue #69: replay the event log on an independent node and derive
// every fund balance, every tally and every binding from it (FR40, NFR2).
//
// The in-process Hardhat network stands in for a node run by a party other
// than the operator and the firm — an insurer, a lender or an audit firm
// (deployment-view.md §2.1). `replay` is handed the provider and nothing else
// from the chain; the contract view calls below are the test's own assertions,
// made only after the replay has returned.
import { expect } from "chai";
import { Interface, ZeroHash, id } from "ethers";
import { network } from "hardhat";

import { replay } from "../scripts/replay.js";

const OPERATING = 0;
const MAINTENANCE = 1;

describe("QAS-4 replay", () => {
  it("derives fund balances, role holders, tallies and eligibility from events alone", async () => {
    const { ethers } = await network.getOrCreate();
    const [
      firm,
      adapter,
      timelock,
      depositor,
      alice,
      bob,
      carol,
      vendor,
      stranger,
    ] = await ethers.getSigners();
    const fromBlock = await ethers.provider.getBlockNumber();

    // Real contracts wherever one is built. PayeeRegistry is a stub until
    // #50/#103 land; a signer stands in for the Timelock and the LevyLedger,
    // which Treasury accepts as plain addresses at construction.
    const token = await ethers.deployContract("MockNZD");
    const payees = await ethers.deployContract("PayeeRegistryStub");
    const registry = await ethers.deployContract("MembershipRegistry", [
      adapter.address,
    ]);
    const governance = await ethers.deployContract("Governance", [
      firm.address,
      payees.target,
      registry.target,
    ]);
    const treasury = await ethers.deployContract("Treasury", [
      8_000,
      governance.target,
      timelock.address,
      depositor.address,
      payees.target,
      token.target,
    ]);
    await payees.admit(vendor.address);

    // Four units, alice holding two of them.
    await registry.connect(adapter).bindUnit(1, alice.address);
    await registry.connect(adapter).bindUnit(2, alice.address);
    await registry.connect(adapter).bindUnit(3, bob.address);
    await registry.connect(adapter).bindUnit(4, carol.address);

    // Two levy receipts; 333 does not split evenly, so rounding is exercised.
    await token.mint(depositor.address, 1_333n);
    await token.connect(depositor).approve(treasury.target, 1_333n);
    await treasury.connect(depositor).deposit(1_000n);
    await treasury.connect(depositor).deposit(333n);

    // A direct token transfer: Treasury holds it, but no fund is credited.
    await token.mint(stranger.address, 500n);
    await token.connect(stranger).transfer(treasury.target, 500n);

    const propose = governance.getFunction(
      "propose(string,uint256,uint8,address,bytes32)",
    );
    await propose("Roof repair", 400n, OPERATING, vendor.address, ZeroHash);
    await propose("Lift overhaul", 100n, MAINTENANCE, vendor.address, ZeroHash);

    // Alice votes for with units 1 and 2, then receives unit 5 and votes
    // against with it. One wallet, two votes, both counted: the tally keys on
    // units, never on the wallet (spec §6, ADR-003).
    await governance.connect(alice).castVote(1, true);
    await governance.connect(bob).castVote(1, false);
    await registry.connect(adapter).bindUnit(5, alice.address);
    await governance.connect(alice).castVote(1, false);
    await governance.connect(carol).castVote(1, true);
    await governance.connect(bob).castVote(2, true);

    await treasury
      .connect(timelock)
      .release(OPERATING, vendor.address, 300n, 1);
    await treasury
      .connect(timelock)
      .release(OPERATING, vendor.address, 100n, 1);
    await treasury
      .connect(timelock)
      .release(MAINTENANCE, vendor.address, 60n, 2);

    const derived = await replay(
      ethers.provider,
      {
        treasury: String(treasury.target),
        governance: String(governance.target),
        membershipRegistry: String(registry.target),
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

    for (const id of [1n, 2n]) {
      expect(derived.releasedByProposal.get(id)).to.equal(
        await treasury.released(id),
      );
    }

    for (const id of [1n, 2n]) {
      const [forVotes, againstVotes] = await governance.tallyOf(id);
      expect(derived.tallies.get(id)).to.deep.equal({ forVotes, againstVotes });
    }
    expect(derived.tallies.get(1n)).to.deep.equal({
      forVotes: 3n,
      againstVotes: 2n,
    });

    for (const [unitId, wallet] of derived.owners) {
      expect(wallet).to.equal(await registry.ownerOf(unitId));
    }
    for (const wallet of [alice, bob, carol]) {
      const units = [...derived.owners].filter(([, w]) => w === wallet.address);
      expect(units.map(([unitId]) => unitId)).to.deep.equal(
        await registry.unitsOf(wallet.address),
      );
    }

    // From the log alone: only the Timelock may release, only the LevyLedger
    // may deposit, and nobody administers either role (rule 1, QAS-8).
    expect(derived.roles.get(await treasury.RELEASER_ROLE())).to.deep.equal(
      new Set([timelock.address]),
    );
    expect(derived.roles.get(await treasury.DEPOSITOR_ROLE())).to.deep.equal(
      new Set([depositor.address]),
    );
    expect(derived.roles.get(ZeroHash)).to.deep.equal(new Set());

    // Treasury's four role events at construction, then five bindings, two
    // deposits, two proposals, five votes and three releases.
    expect(derived.transitions.map((t) => t.name)).to.deep.equal([
      "RoleGranted",
      "RoleGranted",
      "RoleGranted",
      "RoleRevoked",
      ...Array(4).fill("UnitBound"),
      "Deposited",
      "Deposited",
      "ProposalCreated",
      "ProposalCreated",
      "VoteCast",
      "VoteCast",
      "UnitBound",
      "VoteCast",
      "VoteCast",
      "VoteCast",
      "PaymentReleased",
      "PaymentReleased",
      "PaymentReleased",
    ]);
  });

  // A node that serves a fabricated log. The replay must refuse a log that
  // contradicts itself, rather than derive a state from it.
  const vendor = "0x000000000000000000000000000000000000dead";
  const alice = "0x000000000000000000000000000000000000a11c";
  type Event = [name: string, args: unknown[]];
  const work: Event = [
    "ProposalCreated",
    [1n, 1, vendor, 400n, 0, ZeroHash, "Roof"],
  ];
  const admit: Event = [
    "ProposalCreated",
    [1n, 0, vendor, 0n, 0, ZeroHash, ""],
  ];
  const bound: Event = ["UnitBound", [1n, alice]];
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
      "a release on an admission proposal",
      [admit, ["PaymentReleased", [0, vendor, 1n, 1n]]],
      "no work proposal 1",
    ],
    [
      "a log from a replayed address with no known event",
      [["unknown", []]],
      "unrecognised log",
    ],
  ];

  for (const [what, events, message] of cases) {
    it(`refuses ${what}`, async () => {
      const { ethers } = await network.getOrCreate();
      const fragments = await Promise.all(
        ["Governance", "MembershipRegistry", "Treasury"].map(
          async (name) =>
            (await ethers.getContractFactory(name)).interface.fragments,
        ),
      );
      const abi = new Interface(
        fragments.flat().filter((f) => f.type === "event"),
      );
      const logs = events.map(([name, args], index) => ({
        ...(name === "unknown"
          ? { topics: [id("Unknown()")], data: "0x" }
          : abi.encodeEventLog(name, args)),
        blockNumber: 1,
        index,
      }));
      const forgedNode = { getLogs: async () => logs } as never;

      const error = await replay(
        forgedNode,
        { treasury: "", governance: "", membershipRegistry: "" },
        0,
      ).catch((e: Error) => e);
      expect(error)
        .to.be.an("error")
        .with.property("message")
        .that.contains(message);
    });
  }
});
