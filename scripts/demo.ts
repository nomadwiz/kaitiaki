// Seeds a local node with the building in scripts/building.ts and tells the
// read interface (#72) where to find it. The interface is handed addresses
// and an RPC URL, never a key.
//
//   npx hardhat node                                   # terminal 1
//   npx hardhat run scripts/demo.ts --network localhost # terminal 2
//   npm run interface                                  # then open the URL
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { network } from "hardhat";

import { deployBuilding } from "./building.js";

const { ethers } = await network.getOrCreate();
const { fromBlock, addresses, signers, contracts } =
  await deployBuilding(ethers);
// Bob's vote on proposal 2, so the page shows the state the report's
// Figures 6 to 8 do: 3 units for, quorum reached. scripts/building.ts leaves
// it out because test/interface.ts needs alice's vote alone.
await contracts.governance.connect(signers.bob).castVote(2, true);

const out = new URL("../interface/public/deployment.json", import.meta.url);
// interface/public/ holds only this git-ignored file, so a fresh clone lacks it.
await mkdir(new URL(".", out), { recursive: true });
await writeFile(
  out,
  JSON.stringify(
    { rpcUrl: "http://127.0.0.1:8545", fromBlock, addresses },
    null,
    2,
  ) + "\n",
);
console.log(
  `Building deployed; interface config written to ${fileURLToPath(out)}`,
);
