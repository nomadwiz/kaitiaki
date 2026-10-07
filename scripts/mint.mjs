// Mints MockNZD to a wallet on the demo's local node, so an owner has money to
// pay a levy with. Anyone may mint on a test chain (MockNZD.sol); this signs
// with the node's first unlocked account. Reload the interface after.
//
// Usage, after `npm run demo`:
//   npm run mint -- <address> <amount in NZD>
//   npm run mint -- 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65 500   # carol
import { readFile } from "node:fs/promises";
import { Contract, JsonRpcProvider, formatUnits, isAddress, parseUnits } from "ethers";

const [to, amount] = process.argv.slice(2);
if (!isAddress(to) || !(Number(amount) > 0)) {
  console.error("Usage: npm run mint -- <address> <amount in NZD>");
  process.exit(1);
}
const { rpcUrl, token } = JSON.parse(
  await readFile(new URL("../interface/public/deployment.json", import.meta.url), "utf8"),
);
const signer = await new JsonRpcProvider(rpcUrl).getSigner(0);
const nzd = new Contract(
  token,
  ["function mint(address,uint256)", "function balanceOf(address) view returns (uint256)"],
  signer,
);
await (await nzd.mint(to, parseUnits(amount, 18))).wait();
console.log(`${to} now holds NZD ${formatUnits(await nzd.balanceOf(to), 18)}`);
