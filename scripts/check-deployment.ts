// Reads a recorded deployment's wiring back from the chain (#73), with the
// same checks scripts/deploy.ts runs before it records one. Sends nothing.
//
//   npx hardhat run scripts/check-deployment.ts --network sepolia
import { readFile } from "node:fs/promises";
import { network } from "hardhat";

import {
  OPERATING_BPS,
  TIMELOCK_DELAY,
  checkWiring,
  type Deployment,
} from "./wiring.js";

const DEPLOYMENT_RECORD = "73-deployment-11155111.json";
const { ethers } = await network.getOrCreate();
const { chainId } = await ethers.provider.getNetwork();
const record = JSON.parse(
  await readFile(
    new URL(`../evidence/week5/${DEPLOYMENT_RECORD}`, import.meta.url),
    "utf8",
  ),
) as Omit<Deployment, "operatingBps" | "timelockDelay">;

console.log(`Deployment on chain ${chainId}, as recorded`);
const failed = await checkWiring(ethers, {
  ...record,
  // Fixed values, not the record's own constructor arguments, so the check
  // does not merely confirm that the chain agrees with the file.
  operatingBps: OPERATING_BPS,
  timelockDelay: TIMELOCK_DELAY,
});
if (failed > 0) throw new Error(`${failed} wiring check(s) failed.`);
