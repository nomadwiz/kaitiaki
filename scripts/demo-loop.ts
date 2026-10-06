// Carries the demo building's open roof-repair proposal (scripts/demo.ts)
// through the rest of the loop on the local node: the voting window closes,
// anyone queues it, the timelock's delay passes, the firm attests the work,
// and anyone executes, which pays the vendor. The read interface then shows
// proposal 2 as Executed and the operating fund paid out. Time moves with
// `evm_increaseTime`, which only a local node allows (ADR-017).
//
// It reads the chain's state and does only the steps still to do, up to the
// stage named in UNTIL, so each stage can be screenshotted before the next:
//   passed    the voting window has closed; anyone can queue
//   ready     queued, and the delay has passed; the firm can attest
//   attested  the firm has attested; anyone can execute
//   (unset)   executed, and the vendor paid
//
// Usage, after `npm run demo` (and after any screenshots of the open vote):
//   UNTIL=passed npm run demo:loop    # then UNTIL=ready, UNTIL=attested
//   npm run demo:loop                 # all the way, then reload the interface
import { readFile } from "node:fs/promises";
import { formatUnits, id } from "ethers";
import { network } from "hardhat";

import { advance } from "./building.js";

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

const stages = ["passed", "ready", "attested", "executed"];
const until = stages.indexOf(process.env.UNTIL ?? "executed");
if (until < 0) throw new Error(`UNTIL must be one of ${stages.join(", ")}`);
const timelock = await ethers.getContractAt(
  "TimelockController",
  await governance.timelock(),
);
const [, , operationId] = await governance.operation(PROPOSAL);
const state = async () => Number(await governance.state(PROPOSAL));
const OPEN = 0;
const PASSED = 2;
const EXECUTED = 5;

if ((await state()) === OPEN) await advance(ethers, await governance.VOTING_PERIOD());
if (until >= 1) {
  if ((await state()) === PASSED) await (await governance.connect(stranger).queue(PROPOSAL)).wait();
  if (!(await timelock.isOperationReady(operationId))) {
    await advance(ethers, await governance.TIMELOCK_DELAY());
  }
}
if (until >= 2 && !(await governance.attested(PROPOSAL))) {
  await (
    await governance
      .connect(firm)
      .attest(PROPOSAL, id("photos and invoice: roof repair"))
  ).wait();
}
if (until >= 3 && (await state()) !== EXECUTED) {
  await (await governance.connect(stranger).execute(PROPOSAL)).wait();
}
if (until < 3) {
  console.log(`Proposal ${PROPOSAL} stopped at ${stages[until]}.`);
  process.exit(0);
}

const paid = await treasury.released(PROPOSAL);
if (paid === 0n) throw new Error(`proposal ${PROPOSAL} paid nothing`);
console.log(
  `Proposal ${PROPOSAL} queued, attested and executed: NZD ${formatUnits(paid, 18)} paid to the vendor.`,
);
