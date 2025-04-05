import { ethers, hardhatArguments, network } from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  takeSnapshot,
  SnapshotRestorer,
  time,
} from "@nomicfoundation/hardhat-network-helpers";
import {
  MockUSDC,
  MockUSDC__factory,
  Charit3,
  Charit3__factory,
} from "../typechain-types";
import {
  AddressLike,
  ContractTransactionReceipt,
  ContractTransactionResponse,
  parseEther,
  TransactionReceipt,
} from "ethers";
const USDC_HOLDER = "0x0B0A5886664376F59C351ba3f598C8A8B4D0A6f3";
const PRICE_FEED = "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70";
const USDC_ON_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
let owner: SignerWithAddress;
let user1: SignerWithAddress;
let user2: SignerWithAddress;
let usdcHolder: SignerWithAddress;
let usdc: MockUSDC;
let UsdcFactory: MockUSDC__factory;
let Charit3Factory: Charit3__factory;
let charit3: Charit3;
let startSnapshot: SnapshotRestorer;
const DEF_TARGET = ethers.parseUnits("100", 6); // 100 usdc
describe("Charit3", async () => {
  before(async () => {
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [USDC_HOLDER],
    });
    [owner, user1, user2] = await ethers.getSigners();
    usdcHolder = await ethers.getSigner(USDC_HOLDER);
    UsdcFactory = (await ethers.getContractFactory(
      "MockUSDC"
    )) as MockUSDC__factory;
    Charit3Factory = (await ethers.getContractFactory(
      "Charit3"
    )) as Charit3__factory;
    charit3 = await Charit3Factory.deploy(PRICE_FEED, USDC_ON_BASE);
    usdc = (await UsdcFactory.attach(USDC_ON_BASE)) as MockUSDC;
    const tx = await owner.sendTransaction({
      to: USDC_HOLDER,
      value: ethers.parseEther("1"),
    });
    await tx.wait();
    await usdc.connect(usdcHolder).transfer(owner.address, DEF_TARGET);

    startSnapshot = await takeSnapshot();
  });
  describe("getEthPrice", async () => {
    it("Must return correct ETH price", async () => {
      const price = await charit3.getEthPrice();
      console.log("price", price);
      expect(price).to.be.approximately(
        ethers.parseUnits("1800", 6),
        ethers.parseUnits("50", 6)
      );
    });
  });
  describe("convertEthToUsd", async () => {
    it("Must convert eth to usd correctly", async () => {
      const usd = await charit3.convertEthToUsd(ethers.parseEther("1"));
      expect(usd).to.be.approximately(
        ethers.parseUnits("1800", 6),
        ethers.parseUnits("50", 6)
      );
    });
  });
  describe("createFundraise", async () => {
    after(async () => {
      await startSnapshot.restore();
    });
    it("Must create fund correctly", async () => {
      const tx = await charit3.createFundraise("Lol", DEF_TARGET);
      expect(await charit3.counter()).to.be.equal(1);
      expect(tx)
        .to.be.emit(charit3, "FundraiseCreated")
        .withArgs([1, owner.address, DEF_TARGET]);
    });
  });
  describe("fund", async () => {
    before(async () => {
      await charit3.createFundraise("Lol", DEF_TARGET);
    });
    after(async () => {
      await startSnapshot.restore();
    });
    after(async () => {
      await startSnapshot.restore();
    });
    it("Must fund with USDC correctly", async () => {
      const usdcAmount = ethers.parseUnits("10", 6);
      await usdc.approve(await charit3.getAddress(), usdcAmount);
      const tx = await charit3.fund(1, usdcAmount);
      expect(tx)
        .to.be.emit(charit3, "Funded")
        .withArgs(1, owner.address, usdcAmount, 0);
      expect((await charit3.fundraises(1))[4]).to.be.equal(usdcAmount);
    });
    it("Must fund with ETH correctly", async () => {
      const ethAmount = ethers.parseEther("0.01");
      const tx = await charit3.fund(1, 0, { value: ethAmount });
      expect(tx)
        .to.be.emit(charit3, "Funded")
        .withArgs(1, owner.address, 0, ethAmount);
      expect((await charit3.fundraises(1))[5]).to.be.equal(ethAmount);
    });
    it("Must fund with USDC and ETH correctly", async () => {
      const ethAmount = ethers.parseEther("0.01");
      const usdcAmount = ethers.parseUnits("10", 6);
      await usdc.approve(await charit3.getAddress(), usdcAmount);
      const tx = await charit3.fund(1, usdcAmount, { value: ethAmount });
      expect(tx)
        .to.be.emit(charit3, "Funded")
        .withArgs(1, owner.address, usdcAmount, ethAmount);
      // we multiply on 2 because we have already funded in previous tests
      expect((await charit3.fundraises(1))[4]).to.be.equal(usdcAmount * 2n);
      expect((await charit3.fundraises(1))[5]).to.be.equal(ethAmount * 2n);
    });
  });
  describe("getCreatorFundraises", async () => {
    before(async () => {
      await charit3.createFundraise("1", DEF_TARGET);
      await charit3.createFundraise("2", DEF_TARGET);
      await charit3.createFundraise("3", DEF_TARGET);
      await charit3.connect(user1).createFundraise("4", DEF_TARGET);
      await charit3.connect(user1).createFundraise("5", DEF_TARGET);
      await charit3.connect(user2).createFundraise("6", DEF_TARGET);
    });
    after(async () => {
      await startSnapshot.restore();
    });
    it("Must returns correct data", async () => {
      const ownerFund = await charit3.getCreatorFundraises(owner.address);
      const user1Fund = await charit3.getCreatorFundraises(user1.address);
      const user2Fund = await charit3.getCreatorFundraises(user2.address);
      expect(ownerFund).to.be.deep.equal([1n, 2n, 3n]);
      expect(user1Fund).to.be.deep.equal([4n, 5n]);
      expect(user2Fund).to.be.deep.equal([6n]);
    });
  });
  describe("withdraw", async () => {
    before(async () => {
      await charit3.createFundraise("Lol", DEF_TARGET);
    });
    after(async () => {
      await startSnapshot.restore();
    });
    it("Must revert if sender isn't owner", async () => {
      await expect(
        charit3.connect(user1).withdraw(1)
      ).to.be.revertedWithCustomError(charit3, "NotFundraiseOwner");
    });
    it("Must revert if target haven't reached", async () => {
      await expect(charit3.withdraw(1)).to.be.revertedWithCustomError(
        charit3,
        "CannotWithdraw"
      );
    });
    it("Must withdraw correctly", async () => {
      const usdcAmount = await ethers.parseUnits("50", 6);
      const ethAmount = await ethers.parseEther("0.03");
      await usdc.approve(await charit3.getAddress(), usdcAmount);
      await charit3.fund(1, usdcAmount, { value: ethAmount });
      const tx = await charit3.withdraw(1);
      expect(tx)
        .to.be.emit(charit3, "Withdrawed")
        .withArgs(1, usdcAmount, ethAmount);
    });
  });
});
