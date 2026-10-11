// Carries every proposal still in progress on the demo building
// (scripts/demo.ts) through the rest of the loop on the local node, the
// seeded roof repair and any raised from the interface since (#213). Time
// moves once for all of them: the voting window closes, and any proposal
// that missed quorum waits out the extension, so the waiver decides it. Each
// passed proposal is queued, the timelock's delay passes, the firm attests
// each Work proposal, and anyone executes: an Admit proposal admits its
// vendor, a Work proposal pays it. A refusal is printed by its error name and
// the rest carry on. Time moves with `evm_increaseTime`, which only a local
// node allows (ADR-017).
//
// It reads the chain's state and does only the steps still to do, up to the
// stage named in UNTIL, so each stage can be screenshotted before the next:
//   passed    voting has closed on every proposal; anyone can queue
//   ready     queued, and the delay has passed; the firm can attest
//   attested  the firm has attested every Work proposal; anyone can execute
//   (unset)   executed: vendors admitted and paid
//
// Usage, after `npm run demo` (and after any screenshots of the open vote):
//   UNTIL=passed npm run demo:loop    # then UNTIL=ready, UNTIL=attested
//   npm run demo:loop                 # all the way, then reload the interface
import { readFile } from "node:fs/promises";
import { formatUnits, id } from "ethers";
import { network } from "hardhat";

import { advance } from "./building.js";

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
const timelock = await ethers.getContractAt(
  "TimelockController",
  await governance.timelock(),
);

const stages = ["passed", "ready", "attested", "executed"];
const until = stages.indexOf(process.env.UNTIL ?? "executed");
if (until < 0) throw new Error(`UNTIL must be one of ${stages.join(", ")}`);

const STATES = ["open", "extended", "passed", "failed", "queued", "executed"];
const WORK = 1n;
const state = async (n: number) => STATES[Number(await governance.state(n))];
const isWork = async (n: number) => (await governance.proposal(n)).kind === WORK;
const ready = async (n: number) =>
  timelock.isOperationReady((await governance.operation(n))[2]);

// A refusal's error name, from whichever contract raised it: execute runs
// through the timelock into Treasury or PayeeRegistry, which bubble theirs.
// Undefined for anything else, such as a dropped node.
const abis = await Promise.all(
  ["Governance", "Treasury", "PayeeRegistry", "TimelockController"].map(
    async (name) => (await ethers.getContractFactory(name)).interface,
  ),
);
function reason(error: any) {
  const data = error?.data ?? error?.error?.data;
  for (const abi of abis) {
    try {
      const parsed = data && abi.parseError(data);
      if (parsed) return parsed.name;
    } catch {}
  }
  return undefined;
}
const refused = new Map<number, string>();
async function attempt(n: number, send: () => Promise<{ wait(): Promise<unknown> }>) {
  try {
    await (await send()).wait();
  } catch (error) {
    const name = reason(error);
    if (!name) throw error; // not a contract's refusal, so nothing to carry on from
    refused.set(n, name);
  }
}

// The proposals still in progress when this run began.
const count = Number(await governance.proposalCount());
const ids: number[] = [];
for (let n = 1; n <= count; ++n) {
  if (!["executed", "failed"].includes(await state(n))) ids.push(n);
}
const any = async (wanted: string) =>
  (await Promise.all(ids.map(state))).includes(wanted);

if (await any("open")) await advance(ethers, await governance.VOTING_PERIOD());
if (await any("extended")) await advance(ethers, await governance.EXTENSION());
if (until >= 1) {
  for (const n of ids) {
    if ((await state(n)) === "passed") {
      await attempt(n, () => governance.connect(stranger).queue(n));
    }
  }
  // Only a queued operation waits: once it is done it is no longer "ready".
  for (const n of ids) {
    if ((await state(n)) === "queued" && !(await ready(n))) {
      await advance(ethers, await governance.TIMELOCK_DELAY());
      break;
    }
  }
}
if (until >= 2) {
  for (const n of ids) {
    if (
      (await state(n)) === "queued" &&
      (await isWork(n)) &&
      !(await governance.attested(n))
    ) {
      // From the description, so the seeded roof repair keeps its evidence
      // hash: "photos and invoice: roof repair".
      const { description } = await governance.proposal(n);
      await attempt(n, () =>
        governance
          .connect(firm)
          .attest(n, id(`photos and invoice: ${description.toLowerCase()}`)),
      );
    }
  }
}
if (until >= 3) {
  for (const n of ids) {
    if ((await state(n)) === "queued" && !refused.has(n)) {
      await attempt(n, () => governance.connect(stranger).execute(n));
    }
  }
}

if (ids.length === 0) console.log("No proposal is in progress.");
for (const n of ids) {
  const now = await state(n);
  const work = await isWork(n);
  if (refused.has(n)) {
    console.log(`Proposal ${n} is ${now}: refused with ${refused.get(n)}.`);
  } else if (now === "failed") {
    const { forVotes, againstVotes } = await governance.tallyOf(n);
    console.log(`Proposal ${n} failed: ${forVotes} units for, ${againstVotes} against.`);
  } else if (until < 3) {
    // Where the chain actually is, by its place in `stages`, which may be
    // behind or past the stage asked for. Passed is 0; queued but still
    // waiting sits between passed and ready.
    let where = now;
    let rank = now === "queued" ? 0.5 : 0;
    if (now === "executed") [where, rank] = ["executed", 3];
    else if (await governance.attested(n)) [where, rank] = ["attested", 2];
    else if (now === "queued" && (await ready(n))) {
      // An admission has nothing to attest, so once ready it is at both
      // ready and attested.
      [where, rank] = ["ready", work ? 1 : Math.max(1, Math.min(until, 2))];
    }
    const asked = stages[until];
    if (rank === until && until === 2 && !work) {
      console.log(`Proposal ${n} is ready to execute: an admission has no attestation.`);
    } else if (rank === until) console.log(`Proposal ${n} stopped at ${asked}.`);
    else if (rank > until) console.log(`Proposal ${n} is already past ${asked}: ${where}.`);
    else console.log(`Proposal ${n} is ${where}, so it could not reach ${asked}.`);
  } else if (work) {
    const paid = await treasury.released(n);
    if (paid === 0n) throw new Error(`proposal ${n} paid nothing`);
    console.log(
      `Proposal ${n} queued, attested and executed: NZD ${formatUnits(paid, 18)} paid to the vendor.`,
    );
  } else {
    const { description } = await governance.proposal(n);
    console.log(`Proposal ${n} queued and executed: ${description} admitted.`);
  }
}
