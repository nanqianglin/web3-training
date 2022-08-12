import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect, assert } from "chai";
import { ethers } from "hardhat";

const gambleOption = {
  A: 0,
  B: 1,
}

describe('SoccerGambling', () => {
  async function deployFixture() {
    const [owner, addr1, addr2, addr3, addr4, addr5, addr6, addr7, addr8] = await ethers.getSigners();

    const SoccerGambling = await ethers.getContractFactory('SoccerGambling');
    const soccerGambling = await SoccerGambling.deploy([owner.address, addr1.address, addr2.address, addr3.address, addr4.address], 3);

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
      rate, value, tenETH, oneYearLater
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
      const approver = await soccerGambling.approvers(0);
      const approver1 = await soccerGambling.approvers(1);
      const approver2 = await soccerGambling.approvers(2);
      const approver3 = await soccerGambling.approvers(3);
      const approver4 = await soccerGambling.approvers(4);

      expect(approvers.length).to.be.eq(5);
      expect([approver, approver1, approver2, approver3, approver4])
        .to.be.deep.equal([owner.address, addr1.address, addr2.address, addr3.address, addr4.address]);
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

      await expect(SoccerGambling.deploy([owner.address], 0))
        .to.be.revertedWith(
          'Invalid number of required quorum'
        );
      await expect(SoccerGambling.deploy([owner.address], 2))
        .to.be.revertedWith(
          'Invalid number of required quorum'
        );
    })

    it('Should fail if invalid approvers address', async () => {
      const [owner, addr1] = await ethers.getSigners();

      const SoccerGambling = await ethers.getContractFactory('SoccerGambling');
      await expect(SoccerGambling.deploy([owner.address, addr1.address, ethers.constants.AddressZero], 2))
        .to.be.revertedWith(
          'Invalid approver'
        );
    })

    it('Should fail if approvers address are not unique', async () => {
      const [owner, addr1] = await ethers.getSigners();

      const SoccerGambling = await ethers.getContractFactory('SoccerGambling');
      await expect(SoccerGambling.deploy([owner.address, addr1.address, owner.address], 2))
        .to.be.revertedWith(
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
      expect(Number(ethers.utils.formatEther(gamble.gambleStatus.totalAmount))).to.be.eq(102);
      expect(gamble.gambleStatus.filledAmount.toNumber()).to.be.eq(0);
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

  describe('PlayGamble', () => {
    it('Should play the Gamble and emit events', async () => {
      const { soccerGambling, addr6, addr7, rate, tenETH } = await loadFixture(deployFixture);
      await createGamble();

      const gambleId = 0;

      const contractBeforeBalance = await ethers.provider.getBalance(soccerGambling.address);

      await soccerGambling.connect(addr6).playGamble(gambleId, gambleOption.B, { value: tenETH });

      const contractAfterBalance = await ethers.provider.getBalance(soccerGambling.address);
      const player = await soccerGambling.userGambles(gambleId, gambleOption.B, 0);
      const playAmount = await soccerGambling.userGambleAmount(gambleId, gambleOption.B, 0);
      const gamble = await soccerGambling.gambleList(0);

      expect([contractBeforeBalance, contractAfterBalance])
        .to.be.deep.eq([ethers.utils.parseEther('102'), ethers.utils.parseEther('112')]);
      expect(player).to.be.eq(addr6.address);
      expect(playAmount).to.be.eq(tenETH);
      expect(gamble.gambleStatus.filledAmount).to.be.eq(tenETH.mul(rate.rateB));

      await expect(soccerGambling.connect(addr7).playGamble(
        gambleId,
        gambleOption.A,
        { value: tenETH }
      ))
        .to.emit(soccerGambling, 'PlayGamble')
        .withArgs(addr7.address, gambleId, gambleOption.A, tenETH);

    })

    it('Should NOT play the Gamble if gamble not exists', async () => {
      const { soccerGambling, addr6, tenETH } = await loadFixture(deployFixture);
      const gambleId = 0;

      await expect(soccerGambling.connect(addr6).playGamble(gambleId, gambleOption.B, { value: tenETH }))
        .to.be.revertedWith('Gamble does not exist');

    })

    it('Should NOT play the Gamble if gamble is revealed', async () => {
      const { soccerGambling, addr5, addr6, tenETH, oneYearLater } = await loadFixture(deployFixture);
      await createGamble();

      const gambleId = 0;
      await time.increaseTo(oneYearLater);
      await soccerGambling.connect(addr5).revealGamble(gambleId, gambleOption.B);

      await expect(soccerGambling.connect(addr6).playGamble(gambleId, gambleOption.B, { value: tenETH }))
        .to.be.revertedWith('Gamble already revealed');

    })

    it('Should NOT play the Gamble if gamble is expired', async () => {
      const { soccerGambling, addr6, tenETH, oneYearLater } = await loadFixture(deployFixture);
      await createGamble();

      await time.increaseTo(oneYearLater);

      const gambleId = 0;

      await expect(soccerGambling.connect(addr6).playGamble(gambleId, gambleOption.B, { value: tenETH }))
        .to.be.revertedWith('Gamble expired');

    })

    it('Should NOT play the Gamble if not enough fill amount', async () => {
      const { soccerGambling, addr6 } = await loadFixture(deployFixture);
      const gambleId = 0;

      await createGamble();

      await soccerGambling.connect(addr6).playGamble(gambleId, gambleOption.B, { value: ethers.utils.parseEther('50') });

      await expect(soccerGambling.connect(addr6).playGamble(gambleId, gambleOption.A, { value: ethers.utils.parseEther('3') }))
        .to.be.rejectedWith('Not enough fill amount');

    })

    it('Should NOT play the Gamble if invalid input amount', async () => {
      const { soccerGambling, addr6 } = await loadFixture(deployFixture);
      const gambleId = 0;

      await createGamble();

      await expect(soccerGambling.connect(addr6).playGamble(gambleId, gambleOption.B, { value: ethers.utils.parseEther('60') }))
        .to.be.revertedWith('Cannot bigger than total prizes');

      await expect(soccerGambling.connect(addr6).playGamble(gambleId, gambleOption.B, { value: 100 }))
        .to.be.revertedWith('Must bigger or equal to 1 cro');

      // rate [1, 2], so can put 60 cro for option A
      await soccerGambling.connect(addr6).playGamble(gambleId, gambleOption.A, { value: ethers.utils.parseEther('60') });

    })
  });

  describe('RevealGamble', () => {
    it('Should reveal the Gamble and emit events', async () => {
      const { soccerGambling, addr5, addr6, tenETH, oneYearLater } = await loadFixture(deployFixture);
      await createGamble();

      const gambleId = 0;

      await soccerGambling.connect(addr6).playGamble(gambleId, gambleOption.B, { value: tenETH });
      const beforeGamble = await soccerGambling.gambleList(0);

      await time.increaseTo(oneYearLater);

      const now = await getNowTimestamp();
      await expect(soccerGambling.connect(addr5).revealGamble(
        gambleId,
        gambleOption.B,
      ))
        .to.emit(soccerGambling, 'RevealGamble')
        .withArgs(gambleId, gambleOption.B, now);

      const afterGamble = await soccerGambling.gambleList(0);
      const correctAnswer = await soccerGambling.correctAnswers(gambleId);

      expect(correctAnswer).to.be.eq(gambleOption.B);
      expect([beforeGamble.gambleStatus.isRevealed, afterGamble.gambleStatus.isRevealed])
        .to.be.deep.equal([false, true]);

    })

    it('Should NOT reveal the Gamble if gamble not exists', async () => {
      const { soccerGambling, addr5 } = await loadFixture(deployFixture);
      const gambleId = 0;

      await expect(soccerGambling.connect(addr5).revealGamble(gambleId, gambleOption.B))
        .to.be.revertedWith('Gamble does not exist');

    })

    it('Should NOT reveal the Gamble if gamble is revealed', async () => {
      const { soccerGambling, addr5, oneYearLater } = await loadFixture(deployFixture);
      await createGamble();

      const gambleId = 0;
      await time.increaseTo(oneYearLater);
      await soccerGambling.connect(addr5).revealGamble(gambleId, gambleOption.B);

      await expect(soccerGambling.connect(addr5).revealGamble(gambleId, gambleOption.B))
        .to.be.revertedWith('Gamble already revealed');

    })

    it('Should NOT reveal the Gamble if gamble is not expired', async () => {
      const { soccerGambling, addr5 } = await loadFixture(deployFixture);
      await createGamble();

      const gambleId = 0;

      await expect(soccerGambling.connect(addr5).revealGamble(gambleId, gambleOption.B))
        .to.be.revertedWith('Gamble is not expired');

    })

    it('Should NOT reveal the Gamble if not the owner of the gamble', async () => {
      const { soccerGambling, addr6, oneYearLater } = await loadFixture(deployFixture);
      await createGamble();

      const gambleId = 0;

      await time.increaseTo(oneYearLater);
      await expect(soccerGambling.connect(addr6).revealGamble(gambleId, gambleOption.B))
        .to.be.revertedWith('Not the owner of the gamble');

    })
  });

  describe('ApproveGamble', () => {
    it('Should approve the Gamble and emit events', async () => {
      const { soccerGambling, addr1, addr5, addr6, tenETH, oneYearLater } = await loadFixture(deployFixture);
      await createGamble();

      const gambleId = 0;

      await soccerGambling.connect(addr6).playGamble(gambleId, gambleOption.B, { value: tenETH });

      await time.increaseTo(oneYearLater);

      await soccerGambling.connect(addr5).revealGamble(gambleId, gambleOption.B)
      const beforeGambleApprovers = (await soccerGambling.gambleList(0)).gambleStatus.approvers.toNumber();
      const beforeApprove = await soccerGambling.isApprovedOrRejected(gambleId, addr1.address);

      const now = await getNowTimestamp();
      await expect(soccerGambling.connect(addr1).approveGamble(
        gambleId,
      ))
        .to.emit(soccerGambling, 'ApproveGamble')
        .withArgs(addr1.address, gambleId, now);

      const afterGambleApprovers = (await soccerGambling.gambleList(0)).gambleStatus.approvers.toNumber();
      const afterApprove = await soccerGambling.isApprovedOrRejected(gambleId, addr1.address);

      expect([beforeGambleApprovers, afterGambleApprovers]).to.be.deep.equal([0, 1]);
      expect([beforeApprove, afterApprove]).to.be.deep.equal([false, true]);

    })

    it('Should NOT approve the Gamble if gamble not exists', async () => {
      const { soccerGambling, tenETH } = await loadFixture(deployFixture);
      const gambleId = 0;

      await expect(soccerGambling.approveGamble(gambleId))
        .to.be.revertedWith('Gamble does not exist');

    })

    it('Should NOT approve the Gamble if gamble is not revealed', async () => {
      const { soccerGambling, tenETH } = await loadFixture(deployFixture);
      const gambleId = 0;

      await createGamble();
      await expect(soccerGambling.approveGamble(gambleId))
        .to.be.revertedWith('Gamble does not reveal');

    })

    it('Should NOT approve the Gamble if gamble is finished', async () => {
      const { soccerGambling, addr1, addr2, addr3, addr5, addr6, tenETH, oneYearLater } = await loadFixture(deployFixture);
      const gambleId = 0;

      await createGamble();

      await soccerGambling.connect(addr6).playGamble(gambleId, gambleOption.B, { value: tenETH });

      await time.increaseTo(oneYearLater);
      await soccerGambling.connect(addr5).revealGamble(gambleId, gambleOption.B);
      await soccerGambling.approveGamble(gambleId);
      await soccerGambling.connect(addr1).approveGamble(gambleId);
      await soccerGambling.connect(addr2).approveGamble(gambleId);

      await soccerGambling.finishGamble(gambleId);


      await expect(soccerGambling.connect(addr3).approveGamble(gambleId))
        .to.be.revertedWith('Gamble already finished');

    })

    it('Should NOT approve the Gamble if has approved', async () => {
      const { soccerGambling, addr5, addr6, tenETH, oneYearLater } = await loadFixture(deployFixture);
      const gambleId = 0;

      await createGamble();

      await soccerGambling.connect(addr6).playGamble(gambleId, gambleOption.B, { value: tenETH });

      await time.increaseTo(oneYearLater);
      await soccerGambling.connect(addr5).revealGamble(gambleId, gambleOption.B);
      await soccerGambling.approveGamble(gambleId);

      await expect(soccerGambling.approveGamble(gambleId))
        .to.be.revertedWith('You already approved or rejected');

    })
  });

  describe('RejectGamble', () => {
    it('Should reject the Gamble and emit events', async () => {
      const { soccerGambling, addr1, addr5, addr6, tenETH, oneYearLater } = await loadFixture(deployFixture);
      await createGamble();

      const gambleId = 0;

      await soccerGambling.connect(addr6).playGamble(gambleId, gambleOption.B, { value: tenETH });

      await time.increaseTo(oneYearLater);

      await soccerGambling.connect(addr5).revealGamble(gambleId, gambleOption.B)
      const beforeGambleRejecters = (await soccerGambling.gambleList(0)).gambleStatus.rejecters.toNumber();
      const beforeReject = await soccerGambling.isApprovedOrRejected(gambleId, addr1.address);

      const now = await getNowTimestamp();
      await expect(soccerGambling.connect(addr1).rejectGamble(
        gambleId,
      ))
        .to.emit(soccerGambling, 'RejectGamble')
        .withArgs(addr1.address, gambleId, now);

      const afterGambleApprovers = (await soccerGambling.gambleList(0)).gambleStatus.rejecters.toNumber();
      const afterReject = await soccerGambling.isApprovedOrRejected(gambleId, addr1.address);

      expect([beforeGambleRejecters, afterGambleApprovers]).to.be.deep.equal([0, 1]);
      expect([beforeReject, afterReject]).to.be.deep.equal([false, true]);

    })

    it('Should NOT reject the Gamble if gamble not exists', async () => {
      const { soccerGambling } = await loadFixture(deployFixture);
      const gambleId = 0;

      await expect(soccerGambling.rejectGamble(gambleId))
        .to.be.revertedWith('Gamble does not exist');

    })

    it('Should NOT reject the Gamble if gamble is not revealed', async () => {
      const { soccerGambling } = await loadFixture(deployFixture);
      const gambleId = 0;

      await createGamble();
      await expect(soccerGambling.rejectGamble(gambleId))
        .to.be.revertedWith('Gamble does not reveal');

    })

    it('Should NOT reject the Gamble if gamble is finished', async () => {
      const { soccerGambling, addr1, addr2, addr3, addr5, addr6, tenETH, oneYearLater } = await loadFixture(deployFixture);
      const gambleId = 0;

      await createGamble();

      await soccerGambling.connect(addr6).playGamble(gambleId, gambleOption.B, { value: tenETH });

      await time.increaseTo(oneYearLater);
      await soccerGambling.connect(addr5).revealGamble(gambleId, gambleOption.B);
      await soccerGambling.approveGamble(gambleId);
      await soccerGambling.connect(addr1).approveGamble(gambleId);
      await soccerGambling.connect(addr2).approveGamble(gambleId);

      await soccerGambling.finishGamble(gambleId);


      await expect(soccerGambling.connect(addr3).rejectGamble(gambleId))
        .to.be.revertedWith('Gamble already finished');

    })

    it('Should NOT reject the Gamble if has rejected', async () => {
      const { soccerGambling, addr5, addr6, tenETH, oneYearLater } = await loadFixture(deployFixture);
      const gambleId = 0;

      await createGamble();

      await soccerGambling.connect(addr6).playGamble(gambleId, gambleOption.B, { value: tenETH });

      await time.increaseTo(oneYearLater);
      await soccerGambling.connect(addr5).revealGamble(gambleId, gambleOption.B);
      await soccerGambling.rejectGamble(gambleId);

      await expect(soccerGambling.rejectGamble(gambleId))
        .to.be.revertedWith('You already approved or rejected');

    })
  });

  describe('PunishDishonestOwner', () => {
    it('Should punish the owner of the Gamble and emit events', async () => {
      const { soccerGambling, addr1, addr2, addr5, addr6, addr7, addr8, tenETH, oneYearLater } = await loadFixture(deployFixture);
      const gambleId = 0;

      await createGamble();

      await soccerGambling.connect(addr6).playGamble(gambleId, gambleOption.B, { value: tenETH });
      await soccerGambling.connect(addr7).playGamble(gambleId, gambleOption.B, { value: tenETH });
      await soccerGambling.connect(addr8).playGamble(gambleId, gambleOption.A, { value: tenETH });

      await time.increaseTo(oneYearLater);
      await soccerGambling.connect(addr5).revealGamble(gambleId, gambleOption.A);
      await soccerGambling.rejectGamble(gambleId);
      await soccerGambling.connect(addr1).rejectGamble(gambleId);
      await soccerGambling.connect(addr2).rejectGamble(gambleId);

      const beforeGambleStatus = (await soccerGambling.gambleList(0)).gambleStatus.isFinished;
      const addr6BeforeBalance = await soccerGambling.userBalances(addr6.address);
      const addr8BeforeBalance = await soccerGambling.userBalances(addr8.address);
      const ownerBeforeBalance = await soccerGambling.userBalances(addr5.address);

      await expect(soccerGambling.connect(addr1).punishDishonestOwner(
        gambleId,
      ))
        .to.emit(soccerGambling, 'PunishGambleOwner')
        .withArgs(gambleId, addr5.address);


      const afterGambleStatus = (await soccerGambling.gambleList(0)).gambleStatus.isFinished;
      const addr6AfterBalance = await soccerGambling.userBalances(addr6.address);
      const addr8AfterBalance = await soccerGambling.userBalances(addr8.address);
      const ownerAfterBalance = await soccerGambling.userBalances(addr5.address);

      expect([beforeGambleStatus, afterGambleStatus])
        .to.be.deep.eq([false, true]);
      expect([addr6BeforeBalance, addr6AfterBalance])
        .be.deep.eq([ethers.utils.parseEther('0'), ethers.utils.parseEther('10')]);
      expect([addr8BeforeBalance, addr8AfterBalance])
        .be.deep.eq([ethers.utils.parseEther('0'), ethers.utils.parseEther('20')]);

      // 102 - 10 * 2 - 10 = 72
      expect([ownerBeforeBalance, ownerAfterBalance])
        .be.deep.eq([ethers.utils.parseEther('0'), ethers.utils.parseEther('72')]);
    })

    it('Should NOT punish the Gamble if gamble not exists', async () => {
      const { soccerGambling } = await loadFixture(deployFixture);
      const gambleId = 0;

      await expect(soccerGambling.punishDishonestOwner(gambleId))
        .to.be.revertedWith('Gamble does not exist');

    })


    it('Should NOT punish the Gamble if gamble is finished', async () => {
      const { soccerGambling, addr1, addr2, addr3, addr5, addr6, tenETH, oneYearLater } = await loadFixture(deployFixture);
      const gambleId = 0;

      await createGamble();

      await soccerGambling.connect(addr6).playGamble(gambleId, gambleOption.B, { value: tenETH });

      await time.increaseTo(oneYearLater);
      await soccerGambling.connect(addr5).revealGamble(gambleId, gambleOption.B);
      await soccerGambling.approveGamble(gambleId);
      await soccerGambling.connect(addr1).approveGamble(gambleId);
      await soccerGambling.connect(addr2).approveGamble(gambleId);

      await soccerGambling.finishGamble(gambleId);


      await expect(soccerGambling.connect(addr3).punishDishonestOwner(gambleId))
        .to.be.revertedWith('Gamble already finished');

    })

    it('Should NOT punish the Gamble if not enough rejecters', async () => {
      const { soccerGambling, addr1, addr3, addr5, addr6, tenETH, oneYearLater } = await loadFixture(deployFixture);
      const gambleId = 0;

      await createGamble();

      await soccerGambling.connect(addr6).playGamble(gambleId, gambleOption.B, { value: tenETH });

      await time.increaseTo(oneYearLater);
      await soccerGambling.connect(addr5).revealGamble(gambleId, gambleOption.B);
      await soccerGambling.rejectGamble(gambleId);

      await expect(soccerGambling.connect(addr3).punishDishonestOwner(gambleId))
        .to.be.revertedWith('Cannot execute punish');

    })

  });

  describe('FinishGamble', () => {
    it('Should finish the Gamble and emit events', async () => {
      const { soccerGambling, addr1, addr2, addr5, addr6, addr7, addr8, tenETH, oneYearLater } = await loadFixture(deployFixture);
      const gambleId = 0;

      await createGamble();

      await soccerGambling.connect(addr6).playGamble(gambleId, gambleOption.B, { value: tenETH });
      await soccerGambling.connect(addr7).playGamble(gambleId, gambleOption.B, { value: tenETH });
      await soccerGambling.connect(addr8).playGamble(gambleId, gambleOption.A, { value: tenETH });

      await time.increaseTo(oneYearLater);
      await soccerGambling.connect(addr5).revealGamble(gambleId, gambleOption.B);
      await soccerGambling.approveGamble(gambleId);
      await soccerGambling.connect(addr1).approveGamble(gambleId);
      await soccerGambling.connect(addr2).approveGamble(gambleId);

      const beforeGambleStatus = (await soccerGambling.gambleList(0)).gambleStatus.isFinished;
      const addr6BeforeBalance = await soccerGambling.userBalances(addr6.address);
      const ownerBeforeBalance = await soccerGambling.userBalances(addr5.address);

      const now = await getNowTimestamp();
      await expect(soccerGambling.connect(addr1).finishGamble(
        gambleId,
      ))
        .to.emit(soccerGambling, 'FinishGamble')
        .withArgs(addr1.address, gambleId, now);

      const afterGambleStatus = (await soccerGambling.gambleList(0)).gambleStatus.isFinished;
      const addr6AfterBalance = await soccerGambling.userBalances(addr6.address);
      const ownerAfterBalance = await soccerGambling.userBalances(addr5.address);

      expect([beforeGambleStatus, afterGambleStatus])
        .to.be.deep.eq([false, true]);
      expect([addr6BeforeBalance, addr6AfterBalance])
        .be.deep.eq([ethers.utils.parseEther('0'), ethers.utils.parseEther('30')]);

      // 102 - 2 * 10 * 2 + 10 = 72
      expect([ownerBeforeBalance, ownerAfterBalance])
        .be.deep.eq([ethers.utils.parseEther('0'), ethers.utils.parseEther('72')]);

    })

    it('Should NOT finish the Gamble if gamble not exists', async () => {
      const { soccerGambling } = await loadFixture(deployFixture);
      const gambleId = 0;

      await expect(soccerGambling.finishGamble(gambleId))
        .to.be.revertedWith('Gamble does not exist');

    })


    it('Should NOT finish the Gamble if gamble is not revealed', async () => {
      const { soccerGambling } = await loadFixture(deployFixture);
      const gambleId = 0;

      await createGamble();
      await expect(soccerGambling.finishGamble(gambleId))
        .to.be.revertedWith('Gamble does not reveal');

    })

    it('Should NOT finish the Gamble if gamble is finished', async () => {
      const { soccerGambling, addr1, addr2, addr3, addr5, addr6, tenETH, oneYearLater } = await loadFixture(deployFixture);
      const gambleId = 0;

      await createGamble();

      await soccerGambling.connect(addr6).playGamble(gambleId, gambleOption.B, { value: tenETH });

      await time.increaseTo(oneYearLater);
      await soccerGambling.connect(addr5).revealGamble(gambleId, gambleOption.B);
      await soccerGambling.approveGamble(gambleId);
      await soccerGambling.connect(addr1).approveGamble(gambleId);
      await soccerGambling.connect(addr2).approveGamble(gambleId);

      await soccerGambling.finishGamble(gambleId);


      await expect(soccerGambling.connect(addr3).finishGamble(gambleId))
        .to.be.revertedWith('Gamble already finished');

    })

    it('Should NOT finish the Gamble if not enough approvers', async () => {
      const { soccerGambling, addr1, addr3, addr5, addr6, tenETH, oneYearLater } = await loadFixture(deployFixture);
      const gambleId = 0;

      await createGamble();

      await soccerGambling.connect(addr6).playGamble(gambleId, gambleOption.B, { value: tenETH });

      await time.increaseTo(oneYearLater);
      await soccerGambling.connect(addr5).revealGamble(gambleId, gambleOption.B);
      await soccerGambling.approveGamble(gambleId);
      await soccerGambling.connect(addr1).approveGamble(gambleId);

      await expect(soccerGambling.connect(addr3).finishGamble(gambleId))
        .to.be.revertedWith('Not enough approvers');

    })

  });

  describe('Withdraw', () => {
    it('Should withdraw successfully and emit events', async () => {
      const { soccerGambling, addr1, addr2, addr5, addr6, addr7, addr8, tenETH, oneYearLater } = await loadFixture(deployFixture);
      const gambleId = 0;

      await createGamble();

      await soccerGambling.connect(addr6).playGamble(gambleId, gambleOption.B, { value: tenETH });
      await soccerGambling.connect(addr7).playGamble(gambleId, gambleOption.B, { value: tenETH });
      await soccerGambling.connect(addr8).playGamble(gambleId, gambleOption.A, { value: tenETH });

      await time.increaseTo(oneYearLater);
      await soccerGambling.connect(addr5).revealGamble(gambleId, gambleOption.B);
      await soccerGambling.approveGamble(gambleId);
      await soccerGambling.connect(addr1).approveGamble(gambleId);
      await soccerGambling.connect(addr2).approveGamble(gambleId);

      await soccerGambling.connect(addr1).finishGamble(gambleId);

      const addr6BeforeBalance = await soccerGambling.userBalances(addr6.address);
      const addr7BeforeBalance = await soccerGambling.userBalances(addr7.address);
      const contractBeforeBalance = await ethers.provider.getBalance(soccerGambling.address);

      await expect(soccerGambling.connect(addr6).withdrawTo(ethers.utils.parseEther('30'), addr6.address))
        .to.changeEtherBalances(
          [soccerGambling.address, addr6.address],
          [ethers.utils.parseEther('-30'), ethers.utils.parseEther('30')],
        )

      const addr6AfterBalance = await soccerGambling.userBalances(addr6.address);
      const contractAfterBalance = await ethers.provider.getBalance(soccerGambling.address);

      expect([addr6BeforeBalance, addr6AfterBalance])
        .to.be.deep.eq([ethers.utils.parseEther('30'), ethers.utils.parseEther('0')])

      await expect(soccerGambling.connect(addr7).withdrawTo(
        ethers.utils.parseEther('10'),
        addr7.address,
      ))
        .to.emit(soccerGambling, 'WithdrawTo')
        .withArgs(ethers.utils.parseEther('10'), addr7.address, addr7.address);

      const addr7AfterBalance = await soccerGambling.userBalances(addr7.address);
      const contractAfterBalance2 = await ethers.provider.getBalance(soccerGambling.address);

      expect([addr7BeforeBalance, addr7AfterBalance])
        .to.be.deep.eq([ethers.utils.parseEther('30'), ethers.utils.parseEther('20')])

      expect([contractBeforeBalance, contractAfterBalance, contractAfterBalance2])
        .to.be.deep.eq([ethers.utils.parseEther('132'), ethers.utils.parseEther('102'), ethers.utils.parseEther('92')])
    })

    it('Should NOT withdraw if not enough balance', async () => {
      const { soccerGambling, addr6 } = await loadFixture(deployFixture);

      await expect(soccerGambling.connect(addr6).withdrawTo(ethers.utils.parseEther('30'), addr6.address))
        .to.be.revertedWith('Not enough funds to withdraw')
    })
  });
})

