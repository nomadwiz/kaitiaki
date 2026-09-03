import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { configVariable, defineConfig } from "hardhat/config";

// Solidity 0.8.36, fixed. OpenZeppelin 5.6.1 needs ^0.8.20, so 0.8.20 is the
// floor; 0.8.36 is the current release. The version and the EVM target are
// pinned rather than left to a default because the report publishes gas
// numbers (NFR11), and those numbers are only meaningful if the bytecode
// behind them can be reproduced. `prague` is supported by every current public
// test network and nothing here needs a newer opcode.
//
// Both profiles carry the same optimiser settings on purpose: if tests ran
// against an unoptimised build, the measured gas would not be the gas of the
// deployed contracts.
const solcSettings = {
  optimizer: { enabled: true, runs: 200 },
  evmVersion: "prague",
};

export default defineConfig({
  plugins: [hardhatToolboxMochaEthersPlugin],
  solidity: {
    profiles: {
      default: { version: "0.8.36", settings: solcSettings },
      production: { version: "0.8.36", settings: solcSettings },
    },
  },
  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    // Week 5 deploys here. `configVariable` resolves on connect, not on load,
    // so this entry is inert until then and needs no dotenv. Set the values
    // with `npx hardhat keystore set <NAME>` or as environment variables;
    // see .env.example.
    sepolia: {
      type: "http",
      chainType: "l1",
      url: configVariable("SEPOLIA_RPC_URL"),
      accounts: [configVariable("SEPOLIA_PRIVATE_KEY")],
    },
  },
});
