import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const trackedFiles = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .split("\n")
  .filter(Boolean);

const secretFile = /(^|\/)\.env(?:\.[^/]+)?$/;
const privateKey = /\b(?:0x)?[a-fA-F0-9]{64}\b/;

const forbiddenFiles = trackedFiles.filter((file) => secretFile.test(file) && file !== ".env.example");
const keyFiles = trackedFiles.filter((file) => {
  try {
    return privateKey.test(readFileSync(file, "utf8"));
  } catch {
    return false;
  }
});

if (forbiddenFiles.length > 0 || keyFiles.length > 0) {
  console.error("Configuration secret check failed.");
  if (forbiddenFiles.length > 0) {
    console.error(`Tracked environment files: ${forbiddenFiles.join(", ")}`);
  }
  if (keyFiles.length > 0) {
    console.error(`Possible private keys: ${keyFiles.join(", ")}`);
  }
  process.exit(1);
}

console.log("Configuration secret check passed: no tracked .env files or private keys found.");
