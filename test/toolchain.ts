// A canary for the mocha/ethers runner, not a test of the system.
//
// Issue #42. Contract tests are written in Solidity (see
// contracts/Toolchain.t.sol and docs/product.md §16.2). TypeScript is
// kept for the claims that are off-chain by definition: the QAS-4 replay test
// (FR39, FR40), which derives every balance from the event log alone, and the
// week-5 read interface. Both need this path to work, so it gets a canary now.
import { expect } from "chai";
import { network } from "hardhat";

describe("toolchain", () => {
  it("connects to the in-process simulated network", async () => {
    const { ethers } = await network.getOrCreate();
    const { chainId } = await ethers.provider.getNetwork();
    expect(chainId).to.equal(31337n);
  });

  it("gives tests funded signers", async () => {
    const { ethers } = await network.getOrCreate();
    const signers = await ethers.getSigners();
    expect(signers.length).to.be.at.least(3);
    expect(await ethers.provider.getBalance(signers[0].address)).to.be.greaterThan(0n);
  });
});
