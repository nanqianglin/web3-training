import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

const gambleOption = {
  A: 0,
  B: 1,
}
const contractAddress = '0xeAdf7c01DA7E93FdB5f16B0aa9ee85f978e89E95';

// TODO: will write the test later
describe('MyFactory', () => {
  async function deployFixture() {
    const [owner, addr1, addr2, addr3, addr4, addr5, addr6, addr7, addr8] = await ethers.getSigners();

    const MyFactory = await ethers.getContractFactory('MyFactory');

    const soccerGambling = await MyFactory.deploy([owner.address, addr1.address, addr2.address, addr3.address, addr4.address], 3, contractAddress);

    const ONE_YEAR_IN_SECS = 365 * 24 * 60 * 60;

    const oneYearLater = (await time.latest()) + ONE_YEAR_IN_SECS;

    const title = 'Spain vs France';
    const description = 'Spain-France | UEFA Nations League 2021, who will won?';
    const expiredAt = 1662940800; // 2022-09-12
    const options = {
      optionA: 'A. Spain',
      optionB: 'B. France',
    }
    const rate = {
      rateA: 1,
      rateB: 2,
    }
    const value = ethers.utils.parseEther('102');
    const tenETH = ethers.utils.parseEther('10');

    return {
      soccerGambling,
      owner, addr1, addr2,
      addr3, addr4, addr5,
      addr6, addr7, addr8,
      title, description,
      expiredAt, options,
      rate, value, tenETH, oneYearLater,
      contractAddress,
    };
  }

  async function createGamble() {
    const { soccerGambling, addr5, title, description, expiredAt, options, rate, value } = await loadFixture(deployFixture);

    await soccerGambling.connect(addr5).createGamble(
      title,
      description,
      options,
      rate,
      expiredAt,
      { value }
    );
  }

  async function getNowTimestamp() {
    // before the expect, + 1
    return await time.latest() + 1;
  }

  describe('Deployment', () => {
    it('Should set the right approvers', async () => {
      const { soccerGambling, owner, addr1, addr2, addr3, addr4 } = await loadFixture(deployFixture);

      const approvers = await soccerGambling.getApprovers();
      const approver = approvers[0];
      const approver1 = approvers[1];
      const approver2 = approvers[2];
      const approver3 = approvers[3];
      const approver4 = approvers[4];

      expect(approvers.length).to.be.eq(5);
      expect([approver, approver1, approver2, approver3, approver4])
        .to.be.deep.equal([owner.address, addr1.address, addr2.address, addr3.address, addr4.address]);
    });
  });

})

