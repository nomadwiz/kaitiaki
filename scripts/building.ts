// A small building on the real contracts, for the read interface (#72): its
// test (test/interface.ts) and its local demo (scripts/demo.ts) both start
// from this state; the demo adds bob's vote on proposal 2. Every contract is
// the real one, wired as ADR-015 sets out: Governance is the Timelock's only
// proposer and executor, the Timelock is the Treasury's sole releaser and the
// only address that admits payees.
//
// The state it leaves, chosen so each thing the interface shows has a case:
//   units 1 and 2 are alice's, 3 bob's, 4 carol's
//   unit 1's charge was paid by hand before it was due — current
//   unit 2's: the firm's collection failed, alice had approved nothing more —
//     unpaid and overdue, alice's own arrear
//   unit 3's: the first collection failed, bob then set up direct debit and
//     the firm collected it again, late — a resolved arrear, which must not
//     surface
//   unit 4's: the collection failed — another unit in arrears
//   unit 1's second (charge 4) is scheduled for 30 days on, not yet collected
//   proposal 1 admitted the vendor and has executed
//   proposal 2, roof repair for that vendor, is open with alice's vote for
import { ZeroAddress, getCreateAddress, id, parseUnits } from "ethers";
import type { network } from "hardhat";

type Ethers = Awaited<ReturnType<typeof network.getOrCreate>>["ethers"];

// Treasury's operating share in basis points, as in the tests and
// scripts/gas-per-cycle.ts.
const OPERATING_BPS = 8_000;
const OPERATING = 0;
const LEVY = parseUnits("250", 18);

// Moves the local node's clock forward and mines a block, so the next call
// sees the new time. Only a local node allows it (ADR-017).
export async function advance(ethers: Ethers, seconds: bigint | number) {
  await ethers.provider.send("evm_increaseTime", [Number(seconds)]);
  await ethers.provider.send("evm_mine", []);
}

export async function deployBuilding(ethers: Ethers) {
  const [firm, adapter, alice, bob, carol, vendor, stranger] =
    await ethers.getSigners();
  const fromBlock = await ethers.provider.getBlockNumber();

  // Treasury, LevyLedger and the Timelock are named before they exist, so
  // their addresses are worked out from the firm's nonce first.
  const nonce = await firm.getNonce();
  const at = (offset: number) =>
    getCreateAddress({ from: firm.address, nonce: nonce + offset });
  const timelockAt = at(6);

  const token = await ethers.deployContract("MockNZD");
  const payees = await ethers.deployContract("PayeeRegistry", [timelockAt]);
  const registry = await ethers.deployContract("MembershipRegistry", [
    adapter.address,
  ]);
  const governance = await ethers.deployContract("Governance", [
    firm.address,
    payees.target,
    registry.target,
    timelockAt,
    at(4),
  ]);
  const treasury = await ethers.deployContract("Treasury", [
    OPERATING_BPS,
    governance.target,
    timelockAt,
    at(5),
    payees.target,
    token.target,
  ]);
  const due =
    BigInt((await ethers.provider.getBlock("latest"))!.timestamp) + 1_000n;
  const ledger = await ethers.deployContract("LevyLedger", [
    treasury.target,
    registry.target,
    firm.address,
    [1n, 2n, 3n, 4n, 1n],
    [LEVY, LEVY, LEVY, LEVY, LEVY],
    [due, due, due, due, due + 30n * 86_400n],
  ]);
  const timelock = await ethers.deployContract("TimelockController", [
    await governance.TIMELOCK_DELAY(),
    [governance.target],
    [governance.target],
    ZeroAddress,
  ]);
  if (timelock.target !== timelockAt) throw new Error("timelock misplaced");

  await registry.connect(adapter).bindUnit(1, alice.address);
  await registry.connect(adapter).bindUnit(2, alice.address);
  await registry.connect(adapter).bindUnit(3, bob.address);
  await registry.connect(adapter).bindUnit(4, carol.address);

  // Charges 0 to 3, one per unit, and charge 4, scheduled for later. Alice
  // pays unit 1's by hand before it is due (ADR-016), approving only that.
  // Once due, the firm collects charges 1 to 3 (ADR-020); nobody has approved
  // enough, so each is issued and nothing is taken. Bob then sets up direct
  // debit and the firm collects unit 3's again, late.
  for (const owner of [alice, bob]) await token.mint(owner.address, LEVY * 2n);
  await token.connect(alice).approve(ledger.target, LEVY);
  await ledger.connect(alice).payLevy(0);
  await ethers.provider.send("evm_setNextBlockTimestamp", [Number(due) + 1]);
  await ledger.connect(firm).collect([1, 2, 3]);
  await token.connect(bob).approve(ledger.target, LEVY * 2n);
  await ledger.connect(firm).collect([2]);

  // Proposal 1 admits the vendor through the whole loop: two owners vote
  // for it, it waits out the window and the timelock, and anyone executes.
  await governance.connect(firm).getFunction("propose(address,string,string)")(
    vendor.address,
    "Harbour Lifts Ltd",
    "DEMO-0001",
  );
  await governance.connect(alice).castVote(1, true);
  await governance.connect(bob).castVote(1, true);
  await advance(ethers, await governance.VOTING_PERIOD());
  await governance.connect(stranger).queue(1);
  await advance(ethers, await governance.TIMELOCK_DELAY());
  await governance.connect(stranger).execute(1);

  // Proposal 2 pays that vendor, and is open for voting.
  await governance
    .connect(firm)
    .getFunction("propose(string,uint256,uint8,address,bytes32)")(
    "Roof repair",
    parseUnits("400", 18),
    OPERATING,
    vendor.address,
    id("quote: roof repair, 400 NZD"),
  );
  await governance.connect(alice).castVote(2, true);

  return {
    fromBlock,
    addresses: {
      treasury: String(treasury.target),
      governance: String(governance.target),
      membershipRegistry: String(registry.target),
      levyLedger: String(ledger.target),
      payeeRegistry: String(payees.target),
    },
    signers: { firm, alice, bob, carol, vendor, stranger },
    contracts: { token, ledger, governance, timelock },
  };
}
