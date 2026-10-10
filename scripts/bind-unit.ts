// Binds a unit to a wallet on the #73 deployment (FR1), signed by the
// land-title adapter — on the test network, the deployer. A `hardhat run`
// script rather than console lines, because the console cannot read the
// keystore. The registry address comes from the deployment record.
//
//   UNIT=1 WALLET=0x... npx hardhat run scripts/bind-unit.ts --network sepolia
//
// A binding is written once and cannot be undone or moved.
import { readFile } from "node:fs/promises";
import { network } from "hardhat";

const { UNIT, WALLET } = process.env;
if (!UNIT || !WALLET) {
  throw new Error(
    "usage: UNIT=<id> WALLET=<address> npx hardhat run scripts/bind-unit.ts --network sepolia",
  );
}

const DEPLOYMENT_RECORD = "73-deployment-11155111.json";
const { ethers } = await network.getOrCreate();
const { addresses } = JSON.parse(
  await readFile(
    new URL(`../evidence/week5/${DEPLOYMENT_RECORD}`, import.meta.url),
    "utf8",
  ),
) as { addresses: { membershipRegistry: string } };

const registry = await ethers.getContractAt(
  "MembershipRegistry",
  addresses.membershipRegistry,
);
const tx = await registry.bindUnit(BigInt(UNIT), WALLET);
await tx.wait();
console.log(
  `Unit ${UNIT} bound to ${WALLET} on registry ${addresses.membershipRegistry}`,
);
console.log(
  `Units now held by ${WALLET}: ${(await registry.unitsOf(WALLET)).join(", ")}`,
);
