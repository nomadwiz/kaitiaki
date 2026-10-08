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
// Figures 6 to 8 do: 2 units for, quorum reached. Alice's unit 2 and carol's
// unit 4 are in arrears, so neither votes (FR10). scripts/building.ts leaves
// it out because test/interface.ts needs alice's vote alone.
await contracts.governance.connect(signers.bob).castVote(2, true);

const out = new URL("../interface/public/deployment.json", import.meta.url);
// interface/public/ holds only this git-ignored file, so a fresh clone lacks it.
await mkdir(new URL(".", out), { recursive: true });
await writeFile(
  out,
  JSON.stringify(
    {
      chainId: Number((await ethers.provider.getNetwork()).chainId),
      rpcUrl: "http://127.0.0.1:8545",
      fromBlock,
      // Replayed: every log these emit is decoded.
      addresses,
      // Not replayed, so outside `addresses`: the token's and the timelock's
      // logs are not the building's events. No event carries the firm's
      // address (Governance.firm is set in the constructor).
      token: String(contracts.token.target),
      timelock: String(contracts.timelock.target),
      firm: signers.firm.address,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Building deployed; interface config written to ${fileURLToPath(out)}`,
);
