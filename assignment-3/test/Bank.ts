import { expect } from "chai";
import { ethers } from "hardhat";
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe.only('Bank Cheque', function () {
  async function deployFixture() {
    const bank = await ethers.getContractFactory("Bank");
    const [owner, addr1, addr2] = await ethers.getSigners();

    const hardhatBank = await bank.deploy();
    await hardhatBank.deployed();

    const deposit = async (amount: number) =>
      await hardhatBank.connect(owner).deposit({ value: ethers.utils.parseEther(amount ? String(amount) : "20.0") });

    // Fixtures can return anything you consider useful for your tests
    return { hardhatBank, deposit, owner, addr1, addr2 };
  }

  it('Should redeem successfully', async () => {
    const { hardhatBank, owner, addr1, deposit } = await loadFixture(deployFixture);
    await deposit();
    // const balance = await ethers.provider.getBalance(hardhatBank.address)
    // console.log(balance, '-----')

    const chequeId = ethers.utils.formatBytes32String('1');
    const payer = owner.address;
    const payee = addr1.address;
    const amount = ethers.utils.parseEther("1.0");
    const validFrom = 0;
    const validThru = 0;
    const hash = await hardhatBank.getMessageHash(chequeId, payer, payee, amount, validFrom, validThru, hardhatBank.address);
    const sig = await owner.signMessage(ethers.utils.arrayify(hash));

    await hardhatBank.connect(owner).issueECheque(chequeId);

    const beforePayerBalance = await hardhatBank.userBalances(owner.address);
    const issuedChequeStatus = await hardhatBank.chequeStatus(chequeId);

    await hardhatBank.connect(addr1).redeem([[
      amount, chequeId, validFrom, validThru, payee, payer, hardhatBank.address
    ], sig])

    const afterPayerBalance = await hardhatBank.userBalances(owner.address);
    const redeemedChequeStatus = await hardhatBank.chequeStatus(chequeId);

    expect([issuedChequeStatus, redeemedChequeStatus]).to.deep.eq([1, 2]);
    expect(beforePayerBalance.sub(afterPayerBalance)).to.be.eq(ethers.utils.parseEther('1'));

    const beforePendingWithdraw = await hardhatBank.pendingWithdraws(payee);

    await expect(hardhatBank.connect(addr1).withdrawTo(amount, addr1.address)).to.changeEtherBalances(
      [hardhatBank.address, addr1.address],
      [ethers.utils.parseEther('-1'), ethers.utils.parseEther('1')],
    )

    const afterPendingWithdraw = await hardhatBank.pendingWithdraws(payee);

    expect(beforePendingWithdraw).to.be.eq(ethers.utils.parseEther('1'));
    expect(afterPendingWithdraw).to.be.eq(ethers.utils.parseEther('0'));

    // expect(
    //   await hardhatBank.isChequeValid(payee, [[
    //     amount, chequeId, validFrom, validThru, payee, payer, hardhatBank.address
    //   ], sig])
    // ).to.equal(true)
  })
  it('Should NOT redeem, if cheque not start', async () => {
    const { hardhatBank, owner, addr1, deposit } = await loadFixture(deployFixture);
    await deposit();

    const chequeId = ethers.utils.formatBytes32String('1');
    const payer = owner.address;
    const payee = addr1.address;
    const amount = ethers.utils.parseEther("1.0");
    const validFrom = 100;
    const validThru = 0;
    const hash = await hardhatBank.getMessageHash(chequeId, payer, payee, amount, validFrom, validThru, hardhatBank.address);
    const sig = await owner.signMessage(ethers.utils.arrayify(hash));

    await hardhatBank.connect(owner).issueECheque(chequeId);

    await expect(hardhatBank.connect(addr1).redeem([[
      amount, chequeId, validFrom, validThru, payee, payer, hardhatBank.address
    ], sig])).to.be.rejectedWith('The cheque not start yet');
  })
  it('Should NOT redeem, if cheque expired', async () => {
    const { hardhatBank, owner, addr1, deposit } = await loadFixture(deployFixture);
    await deposit();

    const chequeId = ethers.utils.formatBytes32String('1');
    const payer = owner.address;
    const payee = addr1.address;
    const amount = ethers.utils.parseEther("1.0");
    const validFrom = 0;
    const validThru = 1;
    const hash = await hardhatBank.getMessageHash(chequeId, payer, payee, amount, validFrom, validThru, hardhatBank.address);
    const sig = await owner.signMessage(ethers.utils.arrayify(hash));

    await hardhatBank.connect(owner).issueECheque(chequeId);

    await expect(hardhatBank.connect(addr1).redeem([[
      amount, chequeId, validFrom, validThru, payee, payer, hardhatBank.address
    ], sig])).to.be.rejectedWith('The cheque expired');
  })

  it('Should NOT redeem, if invalid cheque', async () => {
    const { hardhatBank, owner, addr1, deposit } = await loadFixture(deployFixture);
    await deposit();

    const chequeId = ethers.utils.formatBytes32String('1');
    const payer = owner.address;
    const payee = addr1.address;
    const amount = ethers.utils.parseEther("1.0");
    const amountWrong = ethers.utils.parseEther("2.0");
    const validFrom = 0;
    const validThru = 0;
    const hash = await hardhatBank.getMessageHash(chequeId, payer, payee, amount, validFrom, validThru, hardhatBank.address);
    const sig = await owner.signMessage(ethers.utils.arrayify(hash));

    await hardhatBank.connect(owner).issueECheque(chequeId);

    await expect(hardhatBank.connect(addr1).redeem([[
      amountWrong, chequeId, validFrom, validThru, payee, payer, hardhatBank.address
    ], sig])).to.be.rejectedWith('Invalid cheque');
  })

  it('Should NOT redeem, if not enough balance', async () => {
    const { hardhatBank, owner, addr1, deposit } = await loadFixture(deployFixture);
    await deposit(1);

    const chequeId = ethers.utils.formatBytes32String('1');
    const payer = owner.address;
    const payee = addr1.address;
    const amount = ethers.utils.parseEther("2.0");
    const validFrom = 0;
    const validThru = 0;
    const hash = await hardhatBank.getMessageHash(chequeId, payer, payee, amount, validFrom, validThru, hardhatBank.address);
    const sig = await owner.signMessage(ethers.utils.arrayify(hash));

    await hardhatBank.connect(owner).issueECheque(chequeId);

    await expect(hardhatBank.connect(addr1).redeem([[
      amount, chequeId, validFrom, validThru, payee, payer, hardhatBank.address
    ], sig])).to.be.rejectedWith('Not enough money');
  })

  it('Should NOT redeem, if cheque revoked', async () => {
    const { hardhatBank, owner, addr1, deposit } = await loadFixture(deployFixture);
    await deposit();

    const chequeId = ethers.utils.formatBytes32String('1');
    const payer = owner.address;
    const payee = addr1.address;
    const amount = ethers.utils.parseEther("2.0");
    const validFrom = 0;
    const validThru = 0;
    const hash = await hardhatBank.getMessageHash(chequeId, payer, payee, amount, validFrom, validThru, hardhatBank.address);
    const sig = await owner.signMessage(ethers.utils.arrayify(hash));

    await hardhatBank.connect(owner).issueECheque(chequeId);
    await hardhatBank.connect(owner).revoke(chequeId);

    await expect(hardhatBank.connect(addr1).redeem([[
      amount, chequeId, validFrom, validThru, payee, payer, hardhatBank.address
    ], sig])).to.be.rejectedWith('Cheque id revoked');
  })

  it('Should NOT redeem, if cheque redeemed', async () => {
    const { hardhatBank, owner, addr1, deposit } = await loadFixture(deployFixture);
    await deposit();

    const chequeId = ethers.utils.formatBytes32String('1');
    const payer = owner.address;
    const payee = addr1.address;
    const amount = ethers.utils.parseEther("1.0");
    const validFrom = 0;
    const validThru = 0;
    const hash = await hardhatBank.getMessageHash(chequeId, payer, payee, amount, validFrom, validThru, hardhatBank.address);
    const sig = await owner.signMessage(ethers.utils.arrayify(hash));

    await hardhatBank.connect(owner).issueECheque(chequeId);
    await hardhatBank.connect(addr1).redeem([[
      amount, chequeId, validFrom, validThru, payee, payer, hardhatBank.address
    ], sig]);

    await expect(hardhatBank.connect(addr1).redeem([[
      amount, chequeId, validFrom, validThru, payee, payer, hardhatBank.address
    ], sig])).to.be.rejectedWith('Cheque id redeemed');
  })

  it('Should NOT update the cheques status', async () => {
    const { hardhatBank, owner, deposit } = await loadFixture(deployFixture);
    await deposit();

    const chequeId = ethers.utils.formatBytes32String('1');
    const sameChequeId = ethers.utils.formatBytes32String('1');

    await hardhatBank.connect(owner).issueECheque(chequeId);
    await expect(hardhatBank.connect(owner).issueECheque(sameChequeId)).to.be.revertedWith('Cheque id exists');
  })

  it('Deposit successfully and reverted', async () => {
    const { hardhatBank, owner } = await loadFixture(deployFixture);

    await expect(hardhatBank.connect(owner).deposit({ value: ethers.utils.parseEther('1') })).to.changeEtherBalances(
      [hardhatBank.address, owner.address],
      [ethers.utils.parseEther('1'), ethers.utils.parseEther('-1')]
    );

    await expect(hardhatBank.connect(owner).deposit({ value: 0 })).to.be.revertedWith('Deposit must be bigger than 0');
    await expect(hardhatBank.connect(owner).deposit()).to.be.revertedWith('Deposit must be bigger than 0');
  })

  it('Withdrawal successfully and reverted', async () => {
    const { hardhatBank, owner, deposit } = await loadFixture(deployFixture);
    await deposit();

    const beforeBalance = await hardhatBank.userBalances(owner.address);

    await expect(hardhatBank.connect(owner).withdraw(ethers.utils.parseEther('1'))).to.changeEtherBalances(
      [hardhatBank.address, owner.address],
      [ethers.utils.parseEther('-1'), ethers.utils.parseEther('1')]
    );

    const afterBalance = await hardhatBank.userBalances(owner.address);

    expect(beforeBalance.sub(afterBalance)).to.be.eq(ethers.utils.parseEther('1'));

    await expect(hardhatBank.connect(owner).withdraw(ethers.utils.parseEther('20'))).to.be.revertedWith('Withdraw must be less than your balance');
    await expect(hardhatBank.connect(owner).withdraw(0)).to.be.revertedWith('Withdraw must be bigger than 0');

  })

  it('Revoke successfully and reverted', async () => {
    const { hardhatBank, owner, deposit } = await loadFixture(deployFixture);
    await deposit();

    const chequeId = ethers.utils.formatBytes32String('1');

    const NotIssuedChequeStatus = await hardhatBank.chequeStatus(chequeId);
    await hardhatBank.connect(owner).issueECheque(chequeId);
    const issuedChequeStatus = await hardhatBank.chequeStatus(chequeId);
    await hardhatBank.connect(owner).revoke(chequeId);
    const revokedChequeStatus = await hardhatBank.chequeStatus(chequeId);
    expect([NotIssuedChequeStatus, issuedChequeStatus, revokedChequeStatus]).to.deep.eq([0, 1, 3]);
  })

  it('Revoke reverted if cheque redeemed', async () => {
    const { hardhatBank, owner, deposit, addr1 } = await loadFixture(deployFixture);
    await deposit();

    const chequeId = ethers.utils.formatBytes32String('1');
    const payer = owner.address;
    const payee = addr1.address;
    const amount = ethers.utils.parseEther("1.0");
    const validFrom = 0;
    const validThru = 0;
    const hash = await hardhatBank.getMessageHash(chequeId, payer, payee, amount, validFrom, validThru, hardhatBank.address);
    const sig = await owner.signMessage(ethers.utils.arrayify(hash));

    await hardhatBank.connect(owner).issueECheque(chequeId);
    await hardhatBank.connect(addr1).redeem([[
      amount, chequeId, validFrom, validThru, payee, payer, hardhatBank.address
    ], sig])

    await expect(hardhatBank.connect(owner).revoke(chequeId)).to.be.revertedWith('Cheque id redeemed');
  })

})