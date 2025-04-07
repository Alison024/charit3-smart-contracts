import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import rpcs from "./rpcs.json";
import { devPrivateKey, basescanApiKey } from "./secrets.json";
const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  networks: {
    hardhat: {
      forking: {
        enabled: true,
        url: rpcs.base,
        blockNumber: 28533496,
      },
    },
    base: {
      url: rpcs.base,
      chainId: 8453,
      accounts: [devPrivateKey],
    },
  },
  etherscan: {
    apiKey: {
      base: basescanApiKey,
    },
    customChains: [
      {
        network: "base",
        chainId: 8453,
        urls: {
          apiURL: "https://api.basescan.org/api",
          browserURL: "https://basescan.org",
        },
      },
    ],
  },
};

export default config;
