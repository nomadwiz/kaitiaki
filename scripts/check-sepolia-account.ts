import { network } from "hardhat";

const requiredBalanceWei = process.env.SEPOLIA_MIN_BALANCE_WEI;

if (!requiredBalanceWei || !/^\d+$/.test(requiredBalanceWei)) {
  throw new Error("SEPOLIA_MIN_BALANCE_WEI must be supplied through the environment");
}

const { ethers } = await network.connect();
const [deployer] = await ethers.getSigners();
const balance = await ethers.provider.getBalance(deployer.address);

console.log(`Deployer: ${deployer.address}`);
console.log(`Balance: ${balance.toString()} wei`);
console.log(`Required: ${requiredBalanceWei} wei`);

if (balance < BigInt(requiredBalanceWei)) {
  throw new Error("The Sepolia deployment account does not have enough funds.");
}

console.log("Sepolia deployment account has enough funds.");
