import * as dotenv from "dotenv";
dotenv.config();

import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const privateKey: string = <string>process.env.PRIVATE_KEY;
const privateKey1: string = <string>process.env.PRIVATE_KEY1;
const privateKey2: string = <string>process.env.PRIVATE_KEY2;
const privateKey3: string = <string>process.env.PRIVATE_KEY3;
const privateKey4: string = <string>process.env.PRIVATE_KEY4;

const config: HardhatUserConfig = {
  solidity: "0.8.9",
  networks: {
    hardhat: {},
    cronosTestnet: {
      url: "https://evm-t3.cronos.org/",
      chainId: 338,
      accounts: [privateKey, privateKey1, privateKey2, privateKey3, privateKey4],
      gasPrice: 5000000000000,
    },
  },
};

export default config;
