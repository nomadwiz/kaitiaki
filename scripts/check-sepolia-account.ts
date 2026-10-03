// Checks that the Sepolia deployment account holds enough test-network funds
// for the week-5 deployment (issue #51). Prints the deployer address, its
// balance and the required balance, never the key.
//
// Usage, once SEPOLIA_RPC_URL and SEPOLIA_PRIVATE_KEY are set in the Hardhat
// keystore (see README.md):
//   npm run check:sepolia-account
// Exit 0: the balance meets REQUIRED_WEI. Exit 1: it is short, or the
// configuration variables are missing.
import { network } from "hardhat";

// The required balance, worked out on 03-10-2026 (#73):
// - Gas: one `npx hardhat run scripts/deploy.ts` on the in-process network,
//   deploying the real system, used 6,279,827 gas; the script prints it.
// - Price: 10 gwei. Sepolia's base fee over the 1,024 blocks before 30-09-2026
//   ran 0.92-1.25 gwei (eth_feeHistory), so 10 gwei allows for a spike.
// - Headroom: x2, so a failed deploy can be repeated, plus binding units.
// 6,279,827 gas x 10 gwei x 2 = 125,596,540,000,000,000 wei (about 0.126 ETH).
const DEPLOY_GAS = 6_279_827n;
const GAS_PRICE_WEI = 10n * 10n ** 9n;
const HEADROOM = 2n;
const REQUIRED_WEI = DEPLOY_GAS * GAS_PRICE_WEI * HEADROOM;

const { ethers } = await network.getOrCreate();
const [deployer] = await ethers.getSigners();
const balance = await ethers.provider.getBalance(deployer.address);

console.log(`Deployer: ${deployer.address}`);
console.log(`Balance: ${balance.toString()} wei`);
console.log(`Required: ${REQUIRED_WEI.toString()} wei`);

if (balance < REQUIRED_WEI) {
  throw new Error("The Sepolia deployment account does not have enough funds.");
}

console.log("Sepolia deployment account has enough funds.");
