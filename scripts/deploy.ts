// Deploys the six-contract stub set in the build order fixed by
// doc/design/spec.md §4:
//   MembershipRegistry -> Treasury + PayeeRegistry -> Governance + Timelock -> LevyLedger
//
// Every contract here is a stub (see contracts/stubs/) except Governance
// (#53, #54). This script exists so the deployment order is
// exercised end to end now, rather than assembled for the first time once
// every real contract lands. Real deployment (week 5, issue #73) replaces
// each stub with its real contract one at a time. The order above is the
// implementation order, not a transaction order: the real Treasury takes the
// Governance, Timelock and LevyLedger addresses at construction and nothing can
// change them later, so #73 must precompute those addresses (CREATE2 or one
// factory) and check the role holders after deployment.
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

// The firm's key is fixed at deployment (doc/design/spec.md §4). Locally that is
// the first funded signer; the week-5 deployment names the real one.
const [firm] = await ethers.getSigners();
const governance = await ethers.deployContract("Governance", [
  firm.address,
  payeeRegistry.target,
  membershipRegistry.target,
]);
await governance.waitForDeployment();
console.log(`Governance deployed to ${governance.target} (firm ${firm.address})`);

const timelock = await ethers.deployContract("TimelockStub");
await timelock.waitForDeployment();
console.log(`TimelockStub deployed to ${timelock.target}`);

const levyLedger = await ethers.deployContract("LevyLedgerStub");
await levyLedger.waitForDeployment();
console.log(`LevyLedgerStub deployed to ${levyLedger.target}`);
