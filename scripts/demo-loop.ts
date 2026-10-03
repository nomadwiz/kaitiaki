// Carries the demo building's open roof-repair proposal (scripts/demo.ts)
// through the rest of the loop on the local node: the voting window closes,
// anyone queues it, the timelock's delay passes, the firm attests the work,
// and anyone executes, which pays the vendor. The read interface then shows
// proposal 2 as Executed and the operating fund paid out. Time moves with
// `evm_increaseTime`, which only a local node allows (ADR-017).
//
// Usage, after `npm run demo` (and after any screenshots of the open vote):
//   npm run demo:loop        # then reload the interface
import { readFile } from "node:fs/promises";
import { formatUnits, id } from "ethers";
import { network } from "hardhat";

const PROPOSAL = 2;

const { ethers } = await network.getOrCreate();
const { addresses } = JSON.parse(
  await readFile(
    new URL("../interface/public/deployment.json", import.meta.url),
    "utf8",
  ),
);
// The signers scripts/building.ts gives these roles.
const [firm, , , , , , stranger] = await ethers.getSigners();
const governance = await ethers.getContractAt("Governance", addresses.governance);
const treasury = await ethers.getContractAt("Treasury", addresses.treasury);

const advance = async (seconds: bigint) => {
  await ethers.provider.send("evm_increaseTime", [Number(seconds)]);
  await ethers.provider.send("evm_mine", []);
};

await advance(await governance.VOTING_PERIOD());
await (await governance.connect(stranger).queue(PROPOSAL)).wait();
await advance(await governance.TIMELOCK_DELAY());
await (
  await governance
    .connect(firm)
    .attest(PROPOSAL, id("photos and invoice: roof repair"))
).wait();
await (await governance.connect(stranger).execute(PROPOSAL)).wait();

const paid = await treasury.released(PROPOSAL);
if (paid === 0n) throw new Error(`proposal ${PROPOSAL} paid nothing`);
console.log(
  `Proposal ${PROPOSAL} queued, attested and executed: NZD ${formatUnits(paid, 18)} paid to the vendor.`,
);
