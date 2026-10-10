// Deploys the real system (issue #73): MockNZD, PayeeRegistry,
// MembershipRegistry, Governance, Treasury, LevyLedger and OpenZeppelin's
// TimelockController, wired as spec §4 and ADR-015 set out. Then it checks the
// role holders and references, and refuses to record a deployment whose
// wiring is wrong: a wrong address cannot be fixed afterwards.
//
//   npx hardhat run scripts/deploy.ts                    # in-process, a dry run
//   npx hardhat run scripts/deploy.ts --network sepolia  # the test network
//
// It writes the new addresses to the network's address record:
// evidence/week5/73-deployment-11155111.json on Sepolia, while the in-process
// deployment goes to interface/public/deployment.json. No
// transaction hash is written: it has the shape of a private key, which
// check:config-secrets refuses.
//
// Constructor arguments can be configured with:
//   KAITIAKI_FIRM=0x...
//   KAITIAKI_ADAPTER=0x...
//   KAITIAKI_OPERATING_BPS=8000
//   KAITIAKI_TIMELOCK_DELAY=604800
//   KAITIAKI_LEVY_UNIT_IDS=1,2
//   KAITIAKI_LEVY_AMOUNTS=250000000000000000000,250000000000000000000
//   KAITIAKI_LEVY_DUE_DATES=1780000000,1782592000
// The three levy lists must have equal lengths. Omitting them deploys an
// empty schedule, as before.
//
// This deployment is for readability (ADR-017, deciding #100). It uses the
// real parameters (spec §5), so the loop is not run here in real time; it is
// demonstrated on the local network, where time can be advanced. The levy
// schedule is empty because its values are a gap, recorded on #73 ("[GAP: the
// reference building's levy schedule for the test-network deployment]"), and
// no value is invented (CLAUDE.md rule 2).
//
// It is a public test network, not the permissioned national chain the
// design assumes, and the report says so.
import { mkdir, writeFile } from "node:fs/promises";
import { ZeroAddress, getAddress, getCreateAddress } from "ethers";
import { network } from "hardhat";

import { OPERATING_BPS, TIMELOCK_DELAY, checkWiring } from "./wiring.js";

const DEPLOYMENT_RECORD = "73-deployment-11155111.json";
const { ethers, networkName } = await network.getOrCreate();
const [deployer] = await ethers.getSigners();
const { chainId } = await ethers.provider.getNetwork();
const fromBlock = await ethers.provider.getBlockNumber();

function positiveInteger(name: string, fallback: bigint): bigint {
  const value = process.env[name];
  if (value === undefined) return fallback;
  if (!/^[0-9]+$/.test(value)) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return BigInt(value);
}

function address(name: string, fallback: string): string {
  const value = process.env[name];
  if (value === undefined) return fallback;
  try {
    return getAddress(value);
  } catch {
    throw new Error(`${name} must be a valid Ethereum address`);
  }
}

function integerList(name: string): bigint[] {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") return [];
  return value.split(",").map((item, index) => {
    const trimmed = item.trim();
    if (!/^[0-9]+$/.test(trimmed)) {
      throw new Error(`${name}[${index}] must be a non-negative integer`);
    }
    return BigInt(trimmed);
  });
}

// On a test network one key plays the firm and the land-title adapter, both
// fixed at deployment (spec §4). The firm's key is the attacker's prize in
// QAS-8; it holds no role that moves money either way.
const firm = address("KAITIAKI_FIRM", deployer.address);
const adapter = address("KAITIAKI_ADAPTER", deployer.address);
const operatingBps = positiveInteger("KAITIAKI_OPERATING_BPS", OPERATING_BPS);
const delay = positiveInteger("KAITIAKI_TIMELOCK_DELAY", TIMELOCK_DELAY);
const levyUnitIds = integerList("KAITIAKI_LEVY_UNIT_IDS");
const levyAmounts = integerList("KAITIAKI_LEVY_AMOUNTS");
const levyDueDates = integerList("KAITIAKI_LEVY_DUE_DATES");
if (
  levyUnitIds.length !== levyAmounts.length ||
  levyUnitIds.length !== levyDueDates.length
) {
  throw new Error(
    "KAITIAKI_LEVY_UNIT_IDS, KAITIAKI_LEVY_AMOUNTS, and " +
      "KAITIAKI_LEVY_DUE_DATES must contain the same number of values",
  );
}
if (operatingBps > 10_000n) {
  throw new Error("KAITIAKI_OPERATING_BPS must be at most 10000");
}
if (delay !== TIMELOCK_DELAY) {
  throw new Error(
    `KAITIAKI_TIMELOCK_DELAY must be ${TIMELOCK_DELAY}; ` +
      "Governance.TIMELOCK_DELAY is fixed in the contract",
  );
}

// Governance names Treasury, LevyLedger and the Timelock, Treasury names
// LevyLedger, and PayeeRegistry names the Timelock, each before it exists.
// Each address is the deployer's nonce plus its place in this list, so
// nothing else may send from this account until the script ends; each is
// checked as it lands.
const CONTRACTS = [
  ["token", "MockNZD"],
  ["payeeRegistry", "PayeeRegistry"],
  ["membershipRegistry", "MembershipRegistry"],
  ["governance", "Governance"],
  ["treasury", "Treasury"],
  ["levyLedger", "LevyLedger"],
  ["timelock", "TimelockController"],
] as const;
type Key = (typeof CONTRACTS)[number][0];

const nonce = await deployer.getNonce();
const expected = Object.fromEntries(
  CONTRACTS.map(([key], i) => [
    key,
    getCreateAddress({ from: deployer.address, nonce: nonce + i }),
  ]),
) as Record<Key, string>;
const constructorArgs: Record<Key, unknown[]> = {
  token: [],
  payeeRegistry: [expected.timelock],
  membershipRegistry: [adapter],
  governance: [
    firm,
    expected.payeeRegistry,
    expected.membershipRegistry,
    expected.levyLedger,
    expected.timelock,
    expected.treasury,
  ],
  treasury: [
    operatingBps,
    expected.governance,
    expected.timelock,
    expected.levyLedger,
    expected.payeeRegistry,
    expected.token,
  ],
  // No charges: the schedule is a gap recorded on #73, and it is fixed at
  // construction (spec §4), so no levy cycle runs on this deployment. The
  // loop and NFR11's gas are shown on the local network instead (ADR-017).
  levyLedger: [
    expected.treasury,
    expected.membershipRegistry,
    firm,
    levyUnitIds,
    levyAmounts,
    levyDueDates,
  ],
  timelock: [delay, [expected.governance], [expected.governance], ZeroAddress],
};
const deployed = {} as Record<Key, string>;
let gasUsed = 0n;
for (const [key, name] of CONTRACTS) {
  const contract = await ethers.deployContract(name, constructorArgs[key]);
  await contract.waitForDeployment();
  gasUsed += (await contract.deploymentTransaction()!.wait())!.gasUsed;
  const address = await contract.getAddress();
  if (address !== expected[key]) {
    throw new Error(
      `${name} landed at ${address}, not ${expected[key]}: ` +
        "another transaction used the deployer's nonce. Nothing is recorded; deploy again.",
    );
  }
  deployed[key] = address;
  console.log(`${name.padEnd(20)} ${address}`);
}

console.log(`Gas used by the seven deployments: ${gasUsed}`);

const failed = await checkWiring(ethers, {
  deployer: deployer.address,
  firm,
  adapter,
  operatingBps,
  timelockDelay: delay,
  addresses: deployed,
});
if (failed > 0) {
  throw new Error(
    `${failed} wiring check(s) failed; do not use this deployment.`,
  );
}

if (chainId === 31337n) {
  const out = new URL("../interface/public/deployment.json", import.meta.url);
  await mkdir(new URL(".", out), { recursive: true });
  await writeFile(
    out,
    JSON.stringify(
      {
        chainId: Number(chainId),
        rpcUrl: "http://127.0.0.1:8545",
        fromBlock,
        addresses: {
          treasury: deployed.treasury,
          governance: deployed.governance,
          membershipRegistry: deployed.membershipRegistry,
          levyLedger: deployed.levyLedger,
          payeeRegistry: deployed.payeeRegistry,
        },
        token: deployed.token,
        timelock: deployed.timelock,
        firm,
      },
      (_, value) => (typeof value === "bigint" ? value.toString() : value),
      2,
    ) + "\n",
  );
  console.log("Recorded in interface/public/deployment.json");
} else {
  const out = new URL(
    `../evidence/week5/${DEPLOYMENT_RECORD}`,
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
        contracts: Object.fromEntries(CONTRACTS),
        constructorArgs,
      },
      (_, value) => (typeof value === "bigint" ? value.toString() : value),
      2,
    ) + "\n",
  );
  console.log(`Recorded in evidence/week5/${DEPLOYMENT_RECORD}`);
}
