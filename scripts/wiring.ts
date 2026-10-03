// The wiring of a deployment (#73), read back from the chain: every role
// holder and every reference fixed at construction, as spec §4 and ADR-015 set
// them. Each check is one a wrong address would fail, and none needs a
// deposit. scripts/deploy.ts runs it before recording a deployment;
// scripts/check-deployment.ts runs it against a recorded one.
import { ZeroAddress } from "ethers";
import type { network } from "hardhat";

type Ethers = Awaited<ReturnType<typeof network.getOrCreate>>["ethers"];

export type Deployment = {
  deployer: string;
  firm: string;
  adapter: string;
  operatingBps: bigint;
  timelockDelay: bigint;
  addresses: {
    token: string;
    payeeRegistry: string;
    membershipRegistry: string;
    governance: string;
    treasury: string;
    levyLedger: string;
    timelock: string;
  };
};

/** Prints each check and returns how many failed. */
export async function checkWiring(ethers: Ethers, d: Deployment) {
  const a = d.addresses;
  const treasury = await ethers.getContractAt("Treasury", a.treasury);
  const governance = await ethers.getContractAt("Governance", a.governance);
  const timelock = await ethers.getContractAt("TimelockController", a.timelock);
  const payees = await ethers.getContractAt("PayeeRegistry", a.payeeRegistry);
  const ledger = await ethers.getContractAt("LevyLedger", a.levyLedger);
  const registry = await ethers.getContractAt(
    "MembershipRegistry",
    a.membershipRegistry,
  );

  const releaser = await treasury.RELEASER_ROLE();
  const depositor = await treasury.DEPOSITOR_ROLE();
  const admin = await treasury.DEFAULT_ADMIN_ROLE();
  const checks: [string, unknown, unknown][] = [
    // #73: the sole releaser and the sole depositor (spec §4, ADR-015).
    [
      "Treasury RELEASER_ROLE members",
      await treasury.getRoleMemberCount(releaser),
      1n,
    ],
    [
      "Treasury RELEASER_ROLE member 0",
      await treasury.getRoleMember(releaser, 0),
      a.timelock,
    ],
    [
      "Treasury DEPOSITOR_ROLE members",
      await treasury.getRoleMemberCount(depositor),
      1n,
    ],
    [
      "Treasury DEPOSITOR_ROLE member 0",
      await treasury.getRoleMember(depositor, 0),
      a.levyLedger,
    ],
    // FR31, NFR8: nobody administers Treasury's roles once construction ends.
    [
      "Treasury DEFAULT_ADMIN_ROLE members",
      await treasury.getRoleMemberCount(admin),
      0n,
    ],
    [
      "Treasury operatingRatioBps",
      await treasury.operatingRatioBps(),
      d.operatingBps,
    ],
    ["Treasury governance", await treasury.governance(), a.governance],
    ["Treasury payeeRegistry", await treasury.payeeRegistry(), a.payeeRegistry],
    ["Treasury settlementAsset", await treasury.settlementAsset(), a.token],
    ["LevyLedger treasury", await ledger.treasury(), a.treasury],
    ["LevyLedger settlementAsset", await ledger.settlementAsset(), a.token],
    ["Governance firm", await governance.firm(), d.firm],
    ["Governance payees", await governance.payees(), a.payeeRegistry],
    ["Governance members", await governance.members(), a.membershipRegistry],
    ["Governance timelock", await governance.timelock(), a.timelock],
    ["Governance treasury", await governance.treasury(), a.treasury],
    [
      "Governance TIMELOCK_DELAY",
      await governance.TIMELOCK_DELAY(),
      d.timelockDelay,
    ],
    ["PayeeRegistry executor", await payees.executor(), a.timelock],
    ["MembershipRegistry adapter", await registry.adapter(), d.adapter],
    // The Timelock: Governance alone proposes and executes, and the deployer
    // administers nothing (spec §4's role table).
    ["Timelock delay", await timelock.getMinDelay(), d.timelockDelay],
    [
      "Timelock PROPOSER_ROLE: Governance",
      await timelock.hasRole(await timelock.PROPOSER_ROLE(), a.governance),
      true,
    ],
    [
      "Timelock EXECUTOR_ROLE: Governance",
      await timelock.hasRole(await timelock.EXECUTOR_ROLE(), a.governance),
      true,
    ],
    [
      "Timelock EXECUTOR_ROLE: anyone",
      await timelock.hasRole(await timelock.EXECUTOR_ROLE(), ZeroAddress),
      false,
    ],
    [
      "Timelock DEFAULT_ADMIN_ROLE: deployer",
      await timelock.hasRole(await timelock.DEFAULT_ADMIN_ROLE(), d.deployer),
      false,
    ],
  ];

  let failed = 0;
  for (const [name, actual, want] of checks) {
    const ok = actual === want;
    if (!ok) failed++;
    console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${actual}`);
  }
  console.log(
    `${checks.length - failed} of ${checks.length} wiring checks passed`,
  );
  return failed;
}
