import { ethers } from "hardhat";

async function main() {
  const [deployer, addr1, addr2, addr3, addr4] = await ethers.getSigners();
  const contractAddress = '0xeAdf7c01DA7E93FdB5f16B0aa9ee85f978e89E95';

  console.log("Deploying contracts with the account:", deployer.address);

  console.log("Account balance:", (await deployer.getBalance()).toString());

  const SoccerGambling = await ethers.getContractFactory("MyFactory");
  // const soccerGambling = await SoccerGambling.deploy([deployer.address, addr1.address, addr2.address, addr3.address, addr4.address], 3, contractAddress);
  const soccerGambling = await SoccerGambling.deploy([deployer.address], 1, contractAddress);

  console.log("SoccerGambling address:", soccerGambling.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
