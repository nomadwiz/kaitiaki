// Reads a recorded deployment's wiring back from the chain (#73), with the
// same checks scripts/deploy.ts runs before it records one. Sends nothing.
//
//   npx hardhat run scripts/check-deployment.ts --network sepolia
import { readFile } from "node:fs/promises";
import { network } from "hardhat";

import { checkWiring, type Deployment } from "./wiring.js";

const { ethers } = await network.getOrCreate();
const { chainId } = await ethers.provider.getNetwork();
const record = JSON.parse(
  await readFile(
    new URL(`../evidence/week5/73-deployment-${chainId}.json`, import.meta.url),
    "utf8",
  ),
) as Omit<Deployment, "operatingBps" | "timelockDelay"> & {
  constructorArgs: { treasury: unknown[]; timelock: unknown[] };
};

console.log(`Deployment on chain ${chainId}, as recorded`);
const failed = await checkWiring(ethers, {
  ...record,
  operatingBps: BigInt(String(record.constructorArgs.treasury[0])),
  timelockDelay: BigInt(String(record.constructorArgs.timelock[0])),
});
if (failed > 0) throw new Error(`${failed} wiring check(s) failed.`);
