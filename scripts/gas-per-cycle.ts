// Measures what each step of the loop costs in gas, read from the transaction
// receipts — the gas the sender actually pays, including each transaction's
// fixed base cost — in the 40-unit reference building (#71; NFR11, sad.md
// §5.2). Prints the per-step cost, each owner's cost for one levy cycle, the
// building's total, and the time and number of calls for one full loop.
//
// Usage, on Hardhat's in-process network:
//   npx hardhat run scripts/gas-per-cycle.ts
//
// Gas is reported in units, not money. The units are deterministic for a given
// compiler version and input, so the same steps cost the same on any network;
// only the price per unit differs. The loop moves time forward with
// `evm_increaseTime`, which only a local network allows: on a public test
// network the levy and voting steps can be repeated, but queueing and
// execution wait for the real 14-day window and 7-day timelock.
import { getCreateAddress, keccak256, toUtf8Bytes } from "ethers";
import type { BaseContract, ContractTransactionResponse } from "ethers";
import { network } from "hardhat";

import { advance } from "./building.js";

const { ethers } = await network.getOrCreate();
const [deployer, adapter, firm, alice, bob, carol, dave, others, roofer, stranger] =
  await ethers.getSigners();

const DAY = 24 * 60 * 60;
const LEVY = 1_000n * 10n ** 18n;
const ROOF_LIMIT = 5_000n * 10n ** 18n;
const OPERATING_BPS = 8_000;
const MAINTENANCE = 1; // Fund.LongTermMaintenance

// The reference building: 40 units held by five owners.
const owners = [
  { name: "alice", signer: alice, first: 1, last: 8 },
  { name: "bob", signer: bob, first: 9, last: 9 },
  { name: "carol", signer: carol, first: 10, last: 10 },
  { name: "dave", signer: dave, first: 11, last: 20 },
  { name: "others", signer: others, first: 21, last: 40 },
];
const UNITS = 40;

type Role = "owner" | "firm" | "anyone";
type Step = { phase: string; step: string; sender: string; role: Role; gas: bigint };
const steps: Step[] = [];

async function measure(
  phase: string,
  step: string,
  sender: string,
  role: Role,
  sent: Promise<ContractTransactionResponse>,
) {
  const receipt = (await (await sent).wait())!;
  steps.push({ phase, step, sender, role, gas: receipt.gasUsed });
  return receipt;
}

const call = (contract: BaseContract, signer: (typeof owners)[number]["signer"], sig: string) =>
  contract.connect(signer).getFunction(sig);

// --- Deployment, wired as spec.md §4 and ADR-015 set out --------------------

const token = await ethers.deployContract("MockNZD", [], deployer);
const members = await ethers.deployContract("MembershipRegistry", [adapter.address], deployer);

const nonce = await deployer.getNonce();
const at = (k: number) => getCreateAddress({ from: deployer.address, nonce: nonce + k });
const [ledgerAt, governanceAt, timelockAt] = [at(2), at(3), at(4)];

const now = (await ethers.provider.getBlock("latest"))!.timestamp;
const due = BigInt(now + DAY);
const unitIds = Array.from({ length: UNITS }, (_, i) => BigInt(i + 1));

const payees = await ethers.deployContract("PayeeRegistry", [timelockAt], deployer);
const treasury = await ethers.deployContract(
  "Treasury",
  [OPERATING_BPS, governanceAt, timelockAt, ledgerAt, payees.target, token.target],
  deployer,
);
const ledger = await ethers.deployContract(
  "LevyLedger",
  [treasury.target, unitIds, unitIds.map(() => LEVY), unitIds.map(() => due)],
  deployer,
);
const governance = await ethers.deployContract(
  "Governance",
  [firm.address, payees.target, members.target, timelockAt, treasury.target],
  deployer,
);
const timelock = await ethers.deployContract(
  "TimelockController",
  [7 * DAY, [governanceAt], [governanceAt], ethers.ZeroAddress],
  deployer,
);
if (
  ledger.target !== ledgerAt ||
  governance.target !== governanceAt ||
  timelock.target !== timelockAt
) {
  throw new Error("a precomputed address does not match its deployment");
}

for (const owner of owners) {
  for (let unit = owner.first; unit <= owner.last; ++unit) {
    await call(members, adapter, "bindUnit(uint256,address)")(unit, owner.signer.address);
  }
  // The settlement asset an owner already holds; minting it is not a cost of
  // running the building.
  const total = BigInt(owner.last - owner.first + 1) * LEVY;
  await call(token, deployer, "mint(address,uint256)")(owner.signer.address, total);
}

// --- One levy cycle ---------------------------------------------------------

await advance(ethers, DAY);
await measure(
  "levy",
  "issueCharges (all 40 charges, one batch)",
  "stranger",
  "anyone",
  call(ledger, stranger, "issueCharges(uint256[])")(unitIds.map((u) => u - 1n)),
);
for (const owner of owners) {
  const units = owner.last - owner.first + 1;
  await measure(
    "levy",
    "approve (the ledger, once per cycle)",
    owner.name,
    "owner",
    call(token, owner.signer, "approve(address,uint256)")(ledger.target, BigInt(units) * LEVY),
  );
  for (let unit = owner.first; unit <= owner.last; ++unit) {
    await measure(
      "levy",
      "payLevy (one charge, one unit)",
      owner.name,
      "owner",
      call(ledger, owner.signer, "payLevy(uint256)")(BigInt(unit - 1)),
    );
  }
}

// --- One full loop: admit a vendor, then pay it for approved work ------------

const QUOTE = keccak256(toUtf8Bytes("quote: roof repair"));
const EVIDENCE = keccak256(toUtf8Bytes("photos and invoice: roof repair"));

async function vote(phase: string, proposalId: bigint) {
  for (const owner of [alice, dave]) {
    const name = owner === alice ? "alice" : "dave";
    const units = name === "alice" ? 8 : 10;
    await measure(
      phase,
      `castVote (${units} units)`,
      name,
      "owner",
      call(governance, owner, "castVote(uint256,bool)")(proposalId, true),
    );
  }
}

const admitReceipt = await measure(
  "admission",
  "propose (admit a vendor)",
  "firm",
  "firm",
  call(governance, firm, "propose(address)")(roofer.address),
);
const admitId = BigInt(admitReceipt.logs[0].topics[1]);
await vote("admission", admitId);
await advance(ethers, 14 * DAY);
await measure(
  "admission",
  "queue",
  "stranger",
  "anyone",
  call(governance, stranger, "queue(uint256)")(admitId),
);
await advance(ethers, 7 * DAY);
await measure(
  "admission",
  "execute (admits the vendor)",
  "stranger",
  "anyone",
  call(governance, stranger, "execute(uint256)")(admitId),
);

const workReceipt = await measure(
  "work",
  "propose (work, from the maintenance fund)",
  "firm",
  "firm",
  call(governance, firm, "propose(string,uint256,uint8,address,bytes32)")(
    "Roof repair",
    ROOF_LIMIT,
    MAINTENANCE,
    roofer.address,
    QUOTE,
  ),
);
const workId = BigInt(workReceipt.logs[0].topics[1]);
const proposedAt = (await workReceipt.getBlock()).timestamp;
await vote("work", workId);
await advance(ethers, 14 * DAY);
await measure("work", "queue", "stranger", "anyone", call(governance, stranger, "queue(uint256)")(workId));
await advance(ethers, 7 * DAY);
await measure(
  "work",
  "attest",
  "firm",
  "firm",
  call(governance, firm, "attest(uint256,bytes32)")(workId, EVIDENCE),
);
const paidReceipt = await measure(
  "work",
  "execute (pays the vendor)",
  "stranger",
  "anyone",
  call(governance, stranger, "execute(uint256)")(workId),
);
const paidAt = (await paidReceipt.getBlock()).timestamp;
const paid = await call(token, stranger, "balanceOf(address)")(roofer.address);
if (paid !== ROOF_LIMIT) throw new Error(`vendor received ${paid}, expected ${ROOF_LIMIT}`);

// --- Report -----------------------------------------------------------------

const sum = (rows: Step[]) => rows.reduce((total, row) => total + row.gas, 0n);
const fmt = (gas: bigint) => gas.toLocaleString("en-NZ");
const table = (header: string[], rows: (string | number)[][]) =>
  [
    `| ${header.join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...rows.map((r) => `| ${r.join(" | ")} |`),
  ].join("\n");

console.log(`# Gas per step, per owner and per cycle — ${UNITS}-unit reference building\n`);
console.log("Gas is the units each transaction used, read from its receipt.\n");

// A step repeated in the run — a levy payment, say — does not cost the same
// each time: the first write to an empty storage slot costs more than a later
// one. So each step shows how often it ran, and its lowest and highest cost.
console.log("## Each step\n");
const grouped = new Map<string, Step[]>();
for (const s of steps) {
  const key = `${s.phase}|${s.step}`;
  grouped.set(key, [...(grouped.get(key) ?? []), s]);
}
console.log(
  table(
    ["Phase", "Step", "Sent by", "Times", "Gas, lowest", "Gas, highest"],
    [...grouped.values()].map((runs) => {
      const gas = runs.map((r) => r.gas);
      const low = gas.reduce((a, b) => (b < a ? b : a));
      const high = gas.reduce((a, b) => (b > a ? b : a));
      return [runs[0].phase, runs[0].step, runs[0].role, runs.length, fmt(low), fmt(high)];
    }),
  ),
);

console.log("\n## One levy cycle, per owner\n");
const levy = steps.filter((s) => s.phase === "levy");
const ownerRows = owners.map((o) => {
  const units = o.last - o.first + 1;
  const gas = sum(levy.filter((s) => s.sender === o.name));
  return [o.name, units, fmt(gas), fmt(gas / BigInt(units))];
});
console.log(table(["Owner", "Units", "Gas, levy cycle", "Gas per unit"], ownerRows));

const issue = sum(levy.filter((s) => s.role === "anyone"));
const levyTotal = sum(levy);
console.log("\n## One levy cycle, the whole building\n");
console.log(
  table(
    ["Measure", "Gas"],
    [
      ["Issuing the charges (anyone, once)", fmt(issue)],
      ["All owners' approvals and payments", fmt(levyTotal - issue)],
      ["Total for the building", fmt(levyTotal)],
      [`Per unit (÷ ${UNITS})`, fmt(levyTotal / BigInt(UNITS))],
      [`Per owner (÷ ${owners.length})`, fmt(levyTotal / BigInt(owners.length))],
    ],
  ),
);

const loop = steps.filter((s) => s.phase !== "levy");
const work = steps.filter((s) => s.phase === "work");
console.log("\n## One full loop: admit a vendor, then pay it\n");
console.log(
  table(
    ["Measure", "Value"],
    [
      ["Calls, vendor admission", steps.filter((s) => s.phase === "admission").length],
      ["Calls, work proposal to payment", work.length],
      ["Calls, the full loop", loop.length],
      ["Gas, sent by owners (votes)", fmt(sum(loop.filter((s) => s.role === "owner")))],
      ["Gas, sent by the firm", fmt(sum(loop.filter((s) => s.role === "firm")))],
      ["Gas, sent by anyone (queue, execute)", fmt(sum(loop.filter((s) => s.role === "anyone")))],
      ["Gas, the full loop", fmt(sum(loop))],
      [
        "Time from work proposal to payment",
        `${((paidAt - proposedAt) / DAY).toFixed(2)} days — the 14-day window and the 7-day timelock, set by the design; this run attests and executes the moment each is allowed`,
      ],
    ],
  ),
);
