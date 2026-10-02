// Deploys the real system (issue #73): MockNZD, PayeeRegistry,
// MembershipRegistry, Governance, Treasury, LevyLedger and OpenZeppelin's
// TimelockController, wired as spec §4 and ADR-015 set out. Then it checks the
// role holders and references, and refuses to record a deployment whose
// wiring is wrong: a wrong address cannot be fixed afterwards.
//
//   npx hardhat run scripts/deploy.ts                    # in-process, a dry run
//   npx hardhat run scripts/deploy.ts --network sepolia  # the test network
//
// On a public network it writes the addresses, the deployment block and each
// contract's constructor arguments to evidence/week5/73-deployment-<chain>.json,
// which scripts/verify.ts reads. No transaction hash is written: it has the
// shape of a private key, which check:config-secrets refuses.
//
// Decided on #100: this deployment is for readability. It uses the real
// parameters (spec §5), so the loop is not run here in real time; it is
// demonstrated on the local network, where time can be advanced. The levy
// schedule is empty because its values are a recorded gap in the design
// ("[GAP: the reference building's levy schedule for the test-network
// deployment]", #73), and no value is invented (CLAUDE.md rule 2).
//
// It is a public test network, not the permissioned national chain the
// design assumes, and the report says so.
import { mkdir, writeFile } from "node:fs/promises";
import { ZeroAddress, getCreateAddress } from "ethers";
import { network } from "hardhat";

// Treasury's operating share in basis points, as in the tests and
// scripts/gas-per-cycle.ts.
const OPERATING_BPS = 8_000;

const { ethers, networkName } = await network.getOrCreate();
const [deployer] = await ethers.getSigners();
const { chainId } = await ethers.provider.getNetwork();
const fromBlock = await ethers.provider.getBlockNumber();

// On a test network one key plays the firm and the land-title adapter, both
// fixed at deployment (spec §4). The firm's key is the attacker's prize in
// QAS-8; it holds no role that moves money either way.
const firm = deployer.address;
const adapter = deployer.address;

// Governance names Treasury and the Timelock, Treasury names LevyLedger, and
// PayeeRegistry names the Timelock, each before it exists. Their addresses
// follow from the deployer's nonce, so nothing else may send from this
// account until the script ends; each address is checked as it lands.
const nonce = await deployer.getNonce();
const at = (offset: number) =>
  getCreateAddress({ from: deployer.address, nonce: nonce + offset });
const expected = {
  token: at(0),
  payeeRegistry: at(1),
  membershipRegistry: at(2),
  governance: at(3),
  treasury: at(4),
  levyLedger: at(5),
  timelock: at(6),
};
const delay = 7n * 24n * 60n * 60n; // Governance.TIMELOCK_DELAY, checked below

const constructorArgs = {
  token: [],
  payeeRegistry: [expected.timelock],
  membershipRegistry: [adapter],
  governance: [
    firm,
    expected.payeeRegistry,
    expected.membershipRegistry,
    expected.timelock,
    expected.treasury,
  ],
  treasury: [
    OPERATING_BPS,
    expected.governance,
    expected.timelock,
    expected.levyLedger,
    expected.payeeRegistry,
    expected.token,
  ],
  levyLedger: [expected.treasury, [], [], []],
  timelock: [delay, [expected.governance], [expected.governance], ZeroAddress],
};
const contractNames = {
  token: "MockNZD",
  payeeRegistry: "PayeeRegistry",
  membershipRegistry: "MembershipRegistry",
  governance: "Governance",
  treasury: "Treasury",
  levyLedger: "LevyLedger",
  timelock: "TimelockController",
} as const;

const deployed: Record<string, string> = {};
let gasUsed = 0n;
for (const key of Object.keys(expected) as (keyof typeof expected)[]) {
  const contract = await ethers.deployContract(
    contractNames[key],
    constructorArgs[key],
  );
  await contract.waitForDeployment();
  gasUsed += (await contract.deploymentTransaction()!.wait())!.gasUsed;
  const address = await contract.getAddress();
  if (address !== expected[key]) {
    throw new Error(
      `${contractNames[key]} landed at ${address}, not ${expected[key]}: ` +
        "another transaction used the deployer's nonce. Nothing is recorded; deploy again.",
    );
  }
  deployed[key] = address;
  console.log(`${contractNames[key].padEnd(20)} ${address}`);
}

console.log(`Gas used by the seven deployments: ${gasUsed}`);

// The wiring, read back from the chain. Each check is one a wrong address
// would fail, before any deposit can be made.
const treasury = await ethers.getContractAt("Treasury", deployed.treasury);
const governance = await ethers.getContractAt(
  "Governance",
  deployed.governance,
);
const timelock = await ethers.getContractAt(
  "TimelockController",
  deployed.timelock,
);
const payees = await ethers.getContractAt(
  "PayeeRegistry",
  deployed.payeeRegistry,
);
const ledger = await ethers.getContractAt("LevyLedger", deployed.levyLedger);
const registry = await ethers.getContractAt(
  "MembershipRegistry",
  deployed.membershipRegistry,
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
    deployed.timelock,
  ],
  [
    "Treasury DEPOSITOR_ROLE members",
    await treasury.getRoleMemberCount(depositor),
    1n,
  ],
  [
    "Treasury DEPOSITOR_ROLE member 0",
    await treasury.getRoleMember(depositor, 0),
    deployed.levyLedger,
  ],
  // FR31, NFR8: nobody administers Treasury's roles once construction ends.
  [
    "Treasury DEFAULT_ADMIN_ROLE members",
    await treasury.getRoleMemberCount(admin),
    0n,
  ],
  ["Treasury governance", await treasury.governance(), deployed.governance],
  [
    "Treasury payeeRegistry",
    await treasury.payeeRegistry(),
    deployed.payeeRegistry,
  ],
  [
    "Treasury settlementAsset",
    await treasury.settlementAsset(),
    deployed.token,
  ],
  ["LevyLedger treasury", await ledger.treasury(), deployed.treasury],
  [
    "LevyLedger settlementAsset",
    await ledger.settlementAsset(),
    deployed.token,
  ],
  ["Governance firm", await governance.firm(), firm],
  ["Governance payees", await governance.payees(), deployed.payeeRegistry],
  [
    "Governance members",
    await governance.members(),
    deployed.membershipRegistry,
  ],
  ["Governance timelock", await governance.timelock(), deployed.timelock],
  ["Governance treasury", await governance.treasury(), deployed.treasury],
  ["Governance TIMELOCK_DELAY", await governance.TIMELOCK_DELAY(), delay],
  ["PayeeRegistry executor", await payees.executor(), deployed.timelock],
  ["MembershipRegistry adapter", await registry.adapter(), adapter],
  // The Timelock: Governance alone proposes and executes, and the deployer
  // administers nothing (spec §4's role table).
  ["Timelock delay", await timelock.getMinDelay(), delay],
  [
    "Timelock PROPOSER_ROLE: Governance",
    await timelock.hasRole(await timelock.PROPOSER_ROLE(), deployed.governance),
    true,
  ],
  [
    "Timelock EXECUTOR_ROLE: Governance",
    await timelock.hasRole(await timelock.EXECUTOR_ROLE(), deployed.governance),
    true,
  ],
  [
    "Timelock EXECUTOR_ROLE: anyone",
    await timelock.hasRole(await timelock.EXECUTOR_ROLE(), ZeroAddress),
    false,
  ],
  [
    "Timelock DEFAULT_ADMIN_ROLE: deployer",
    await timelock.hasRole(
      await timelock.DEFAULT_ADMIN_ROLE(),
      deployer.address,
    ),
    false,
  ],
];
const wrong = checks.filter(([, actual, want]) => actual !== want);
for (const [name, actual, want] of checks) {
  console.log(`${actual === want ? "ok  " : "FAIL"} ${name}: ${actual}`);
}
if (wrong.length > 0) {
  throw new Error(
    `${wrong.length} wiring check(s) failed; do not use this deployment.`,
  );
}

if (chainId !== 31337n) {
  const out = new URL(
    `../evidence/week5/73-deployment-${chainId}.json`,
    import.meta.url,
  );
  await mkdir(new URL(".", out), { recursive: true });
  await writeFile(
    out,
    JSON.stringify(
      {
        network: networkName,
        chainId: Number(chainId),
        fromBlock,
        deployer: deployer.address,
        firm,
        adapter,
        addresses: deployed,
        contracts: contractNames,
        constructorArgs,
      },
      (_, value) => (typeof value === "bigint" ? value.toString() : value),
      2,
    ) + "\n",
  );
  console.log(`Recorded in evidence/week5/73-deployment-${chainId}.json`);
}
