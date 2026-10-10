// Verifies the #73 deployment on Etherscan, reading the addresses and
// constructor arguments scripts/deploy.ts recorded. Needs ETHERSCAN_API_KEY
// (see .env.example). Already-verified contracts are reported, not redone.
//
//   npx hardhat run scripts/verify.ts --network sepolia
import { readFile } from "node:fs/promises";
import hre from "hardhat";
import { verifyContract } from "@nomicfoundation/hardhat-verify/verify";

const { ethers } = await hre.network.getOrCreate();
const { chainId } = await ethers.provider.getNetwork();
const record = JSON.parse(
  await readFile(
    new URL(`../evidence/week5/73-deployment-${chainId}.json`, import.meta.url),
    "utf8",
  ),
) as {
  addresses: Record<string, string>;
  contracts: Record<string, string>;
  constructorArgs: Record<string, unknown[]>;
};

for (const [key, address] of Object.entries(record.addresses)) {
  const name = record.contracts[key];
  await verifyContract(
    {
      address,
      constructorArgs: record.constructorArgs[key],
      contract:
        name === "TimelockController"
          ? "@openzeppelin/contracts/governance/TimelockController.sol:TimelockController"
          : `contracts/${name}.sol:${name}`,
    },
    hre,
  );
  console.log(`verified ${name} ${address}`);
}
