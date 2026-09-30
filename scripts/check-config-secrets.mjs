// Refuses a repository that would publish a secret (issue #51, rule 9). Fails if
// any tracked file is a `.env` or `.env.*` other than the root `.env.example`,
// if any line of `.env.example` has a value (a pasted RPC URL carries its API
// key), or if any tracked text file holds a 64-hex-digit value, the shape of a
// private key. It prints file names only, never the matching line, so a real
// key is not copied into the CI log.
//
// Committed Ignition deployments (`ignition/deployments/`) are skipped: their
// journals record transaction hashes, which have the same shape as a key, and
// Ignition never writes a key there. Skipping the folder keeps the broad match
// everywhere else, including a key pasted bare into hardhat.config.ts, which a
// match on `PRIVATE_KEY=` alone would miss.
//
// Limit: `git grep -I` skips any file git treats as binary, so a key inside one
// is not found.
//
// Usage, from the repository root (CI runs it on every pull request):
//   npm run check:config-secrets
// Exit 0: nothing found. Exit 1: a finding, listed on stderr. Untrack the file
// and rotate the key, since a pushed key is already public.
// test/check-config-secrets.ts runs it against throwaway repositories.
import { execFileSync } from "node:child_process";

// git grep exits 0 on a match and 1 on none; anything else is an error and throws.
function grep(...args) {
  try {
    return execFileSync("git", ["grep", "-lIE", ...args], { encoding: "utf8" }).trim();
  } catch (error) {
    if (error.status === 1) return "";
    throw error;
  }
}

const envFiles = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .split("\n")
  .filter((file) => /(^|\/)\.env(\.[^/]+)?$/.test(file) && file !== ".env.example");
const filledExample = grep("^[[:space:]]*[A-Za-z_][A-Za-z0-9_]*[[:space:]]*=[[:space:]]*[^[:space:]]", "--", ".env.example");
const keyFiles = grep("-w", "(0x)?[0-9a-fA-F]{64}", "--", ".", ":!ignition/deployments/");

const findings = [
  envFiles.length > 0 && `Tracked environment files: ${envFiles.join(", ")}`,
  filledExample && ".env.example has a value filled in; it holds names only",
  keyFiles && `Possible private keys in: ${keyFiles.split("\n").join(", ")}`,
].filter(Boolean);

if (findings.length > 0) {
  console.error(["Configuration secret check failed.", ...findings].join("\n"));
  process.exit(1);
}
console.log("Configuration secret check passed: no tracked .env, no value in .env.example, no key-shaped value.");
