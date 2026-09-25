// Deploys the six-contract stub set in the build order fixed by
// docs/decisions/views/functional-view.md §6:
//   MembershipRegistry -> Treasury + PayeeRegistry -> Governance + Timelock -> LevyLedger
//
// Every contract here is a stub (see contracts/stubs/) except Governance
// (#53). This script exists so the deployment order is
// exercised end to end now, rather than assembled for the first time once
// every real contract lands. Real deployment (week 5, issue #75) replaces
// each stub with its real contract one at a time, keeping this order.
import { network } from "hardhat";

const { ethers } = await network.getOrCreate();

const membershipRegistry = await ethers.deployContract("MembershipRegistryStub");
await membershipRegistry.waitForDeployment();
console.log(`MembershipRegistryStub deployed to ${membershipRegistry.target}`);

const treasury = await ethers.deployContract("TreasuryStub");
await treasury.waitForDeployment();
console.log(`TreasuryStub deployed to ${treasury.target}`);

const payeeRegistry = await ethers.deployContract("PayeeRegistryStub");
await payeeRegistry.waitForDeployment();
console.log(`PayeeRegistryStub deployed to ${payeeRegistry.target}`);

// The firm's key is fixed at deployment (docs/spec.md §4). Locally that is
// the first funded signer; the week-5 deployment names the real one.
const [firm] = await ethers.getSigners();
const governance = await ethers.deployContract("Governance", [
  firm.address,
  payeeRegistry.target,
]);
await governance.waitForDeployment();
console.log(`Governance deployed to ${governance.target} (firm ${firm.address})`);

const timelock = await ethers.deployContract("TimelockStub");
await timelock.waitForDeployment();
console.log(`TimelockStub deployed to ${timelock.target}`);

const levyLedger = await ethers.deployContract("LevyLedgerStub");
await levyLedger.waitForDeployment();
console.log(`LevyLedgerStub deployed to ${levyLedger.target}`);
