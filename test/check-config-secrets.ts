// Issue #51: CI relies on scripts/check-config-secrets.mjs to keep keys out of
// the repository, so this proves it refuses what it must and passes what it
// must. Each case builds a throwaway git repository in the OS temp directory,
// tracks the given files, and runs the scanner there. The fake key is built at
// run time, so this file holds no key-shaped value for the scanner to find.
import { expect } from "chai";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scanner = fileURLToPath(new URL("../scripts/check-config-secrets.mjs", import.meta.url));
const fakeKey = `0x${"ab".repeat(32)}`;

function scan(files: Record<string, string>): number | null {
  const repo = mkdtempSync(join(tmpdir(), "kaitiaki-secrets-"));
  try {
    spawnSync("git", ["init", "-q"], { cwd: repo });
    for (const [path, content] of Object.entries(files)) {
      mkdirSync(dirname(join(repo, path)), { recursive: true });
      writeFileSync(join(repo, path), content);
    }
    spawnSync("git", ["add", "-A", "-f"], { cwd: repo });
    return spawnSync(process.execPath, [scanner], { cwd: repo }).status;
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
}

const cleanExample = "# comment\nSEPOLIA_RPC_URL=\nSEPOLIA_PRIVATE_KEY=\n";

describe("check-config-secrets", () => {
  it("passes a clean tree", () => {
    expect(scan({ ".env.example": cleanExample, "a.ts": "const x = 1;\n" })).to.equal(0);
  });

  it("fails on a tracked file holding a private-key-shaped value", () => {
    expect(scan({ "hardhat.config.ts": `accounts: ["${fakeKey}"]\n` })).to.equal(1);
  });

  it("fails on a tracked .env", () => {
    expect(scan({ ".env": "SEPOLIA_RPC_URL=\n" })).to.equal(1);
  });

  it("fails when a line of .env.example has a value", () => {
    const pasted = "SEPOLIA_RPC_URL=https://sepolia.example/v3/abc\n";
    expect(scan({ ".env.example": cleanExample + pasted })).to.equal(1);
  });

  it("passes a committed Ignition journal, whose transaction hashes are key-shaped", () => {
    const journal = `{"type":"TRANSACTION_SEND","hash":"${fakeKey}"}\n`;
    const path = "ignition/deployments/chain-11155111/journal.jsonl";
    expect(scan({ ".env.example": cleanExample, [path]: journal })).to.equal(0);
  });
});
