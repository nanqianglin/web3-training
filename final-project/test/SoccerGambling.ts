import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect, assert } from "chai";
import { ethers } from "hardhat";

describe('SoccerGambling', () => {
  async function deployFixture() {
    const [owner, addr1, addr2, addr3, addr4, addr5, addr6, addr7] = await ethers.getSigners();

    const SoccerGambling = await ethers.getContractFactory('SoccerGambling');
    const soccerGambling = await SoccerGambling.deploy([owner.address, addr1.address, addr2.address, addr3.address, addr4.address], 3);

    const title = 'Spain vs France';
    const description = 'Spain-France | UEFA Nations League 2021, who will won?';
    const expiredAt = 1660262400; // 2022-08-12
    const options = {
      optionA: 'A. Spain',
      optionB: 'B. France',
    }
    const rate = {
      rateA: 1,
      rateB: 2,
    }
    const value = ethers.utils.parseEther('102');

    return { soccerGambling, owner, addr1, addr2, addr3, addr4, addr5, addr6, addr7, title, description, expiredAt, options, rate, value };
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

  describe('Deployment', () => {
    it('Should set the right approvers', async () => {
      const { soccerGambling, owner, addr1, addr2, addr3, addr4 } = await loadFixture(deployFixture);

      const approvers = await soccerGambling.getApprovers();
      const approver = await soccerGambling.approvers(0);
      const approver1 = await soccerGambling.approvers(1);
      const approver2 = await soccerGambling.approvers(2);
      const approver3 = await soccerGambling.approvers(3);
      const approver4 = await soccerGambling.approvers(4);

      expect(approvers.length).to.be.eq(5);
      expect([approver, approver1, approver2, approver3, approver4]).to.be.deep.equal([owner.address, addr1.address, addr2.address, addr3.address, addr4.address]);
    });

    it('Should set the right quorum', async () => {
      const { soccerGambling } = await loadFixture(deployFixture);
      const quorum = await soccerGambling.quorum();
      expect(quorum).to.be.eq(3);
    })

    it('Should fail if invalid approvers length', async () => {
      const SoccerGambling = await ethers.getContractFactory('SoccerGambling');
      await expect(SoccerGambling.deploy([], 2)).to.be.revertedWith(
        'Approvers required'
      );
    })

    it('Should fail if invalid quorum', async () => {
      const [owner] = await ethers.getSigners();
      const SoccerGambling = await ethers.getContractFactory('SoccerGambling');

      await expect(SoccerGambling.deploy([owner.address], 0)).to.be.revertedWith(
        'Invalid number of required quorum'
      );
      await expect(SoccerGambling.deploy([owner.address], 2)).to.be.revertedWith(
        'Invalid number of required quorum'
      );
    })

    it('Should fail if invalid approvers address', async () => {
      const [owner, addr1] = await ethers.getSigners();

      const SoccerGambling = await ethers.getContractFactory('SoccerGambling');
      await expect(SoccerGambling.deploy([owner.address, addr1.address, ethers.constants.AddressZero], 2)).to.be.revertedWith(
        'Invalid approver'
      );
    })

    it('Should fail if approvers address are not unique', async () => {
      const [owner, addr1] = await ethers.getSigners();

      const SoccerGambling = await ethers.getContractFactory('SoccerGambling');
      await expect(SoccerGambling.deploy([owner.address, addr1.address, owner.address], 2)).to.be.revertedWith(
        'Approver not unique'
      );
    })

  });

  describe('CreateGamble', () => {
    it('Should create a new Gamble and emit events', async () => {
      const { soccerGambling, addr5, title, options, rate, expiredAt, value } = await loadFixture(deployFixture);
      await createGamble();

      const gambles = await soccerGambling.getGambleList();
      const gamble = await soccerGambling.gambleList(0);
      const contractBalance = await ethers.provider.getBalance(soccerGambling.address);

      assert(gambles.length === 1);
      expect(gamble.gambleInfo.title).to.be.eq(title);
      expect(gamble.gambleInfo.owner).to.be.eq(addr5.address);
      expect(gamble.gambleInfo.expiredAt).to.be.eq(expiredAt);
      expect(contractBalance).to.be.eq(value);

      const title1 = 'Mexico vs Brazil';
      const description1 = 'Mexico-Brazil | Who will won?';

      await expect(soccerGambling.connect(addr5).createGamble(
        title1,
        description1,
        options,
        rate,
        expiredAt,
        { value }
      ))
        .to.emit(soccerGambling, 'CreateGamble')
        .withArgs(addr5.address, 1, title1, value);
    })

    it('Should NOT create a new Gamble if value is lower 100 cro', async () => {
      const { soccerGambling, addr5, title, description, options, rate, expiredAt, value } = await loadFixture(deployFixture);

      await expect(soccerGambling.connect(addr5).createGamble(
        title,
        description,
        options,
        rate,
        expiredAt,
        { value: ethers.utils.parseEther('1') }
      )).to.be.revertedWith('Must put more than 100 cro as the prizes value');
    })
  });
})

