import { ethers } from "hardhat";
import hardhat from "hardhat";
import { Charit3, Charit3__factory } from "../typechain-types";
const PRICE_FEED = "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70";
const USDC_ON_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
async function main() {
  const Charit3Factory = await ethers.getContractFactory("Charit3");
  const charit3 = await Charit3Factory.deploy(PRICE_FEED, USDC_ON_BASE);
  await charit3.waitForDeployment();
  await hardhat.run("verify:verify", {
    address: await charit3.getAddress(),
    constructorArguments: [PRICE_FEED, USDC_ON_BASE],
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
