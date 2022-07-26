import { expect } from "chai";
import { ethers } from "hardhat";
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

async function deployFixture() {
  const bank = await ethers.getContractFactory("Bank");
  const [owner, addr1, addr2, addr3] = await ethers.getSigners();

  const hardhatBank = await bank.deploy();
  await hardhatBank.deployed();

  const deposit = async (amount: number) =>
    await hardhatBank.connect(owner).deposit({ value: ethers.utils.parseEther(amount ? String(amount) : "20.0") });

  // Fixtures can return anything you consider useful for your tests
  return { hardhatBank, deposit, owner, addr1, addr2, addr3 };
}

describe('Bank Cheque', function () {
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
    const hash = ethers.utils.solidityKeccak256(['bytes32', 'address', 'address', 'uint', 'uint32', 'uint32', 'address'], [chequeId, payer, payee, amount, validFrom, validThru, hardhatBank.address]);
    const sig = await owner.signMessage(ethers.utils.arrayify(hash));

    await hardhatBank.connect(owner).issueECheque(chequeId);

    const beforePayerBalance = await hardhatBank.userBalances(owner.address);
    const issuedCheque = await hardhatBank.chequeStatus(chequeId);

    await hardhatBank.connect(addr1).redeem([[
      amount, chequeId, validFrom, validThru, payee, payer, hardhatBank.address
    ], sig])

    const afterPayerBalance = await hardhatBank.userBalances(owner.address);
    const redeemedCheque = await hardhatBank.chequeStatus(chequeId);

    expect([issuedCheque.status, redeemedCheque.status]).to.deep.eq([1, 2]);
    expect(beforePayerBalance.sub(afterPayerBalance)).to.be.eq(ethers.utils.parseEther('1'));

    const beforePendingWithdraw = await hardhatBank.pendingWithdraws(payee);

    await expect(hardhatBank.connect(addr1).withdrawTo(amount, payee)).to.changeEtherBalances(
      [hardhatBank.address, payee],
      [ethers.utils.parseEther('-1'), ethers.utils.parseEther('1')],
    )

    const afterPendingWithdraw = await hardhatBank.pendingWithdraws(payee);

    expect(beforePendingWithdraw).to.be.eq(ethers.utils.parseEther('1'));
    expect(afterPendingWithdraw).to.be.eq(ethers.utils.parseEther('0'));
  })
  it('Should NOT withdraw to payee, if not redeem first', async () => {
    const { hardhatBank, owner, addr1, deposit } = await loadFixture(deployFixture);
    await deposit();

    const chequeId = ethers.utils.formatBytes32String('1');
    const payee = addr1.address;
    const amount = ethers.utils.parseEther("1.0");

    await hardhatBank.connect(owner).issueECheque(chequeId);

    await expect(hardhatBank.connect(addr1).withdrawTo(amount, payee)).to.be.revertedWith('Failed to withdraw to recipient');
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
    const hash = ethers.utils.solidityKeccak256(['bytes32', 'address', 'address', 'uint', 'uint32', 'uint32', 'address'], [chequeId, payer, payee, amount, validFrom, validThru, hardhatBank.address]);
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
    const hash = ethers.utils.solidityKeccak256(['bytes32', 'address', 'address', 'uint', 'uint32', 'uint32', 'address'], [chequeId, payer, payee, amount, validFrom, validThru, hardhatBank.address]);
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
    const hash = ethers.utils.solidityKeccak256(['bytes32', 'address', 'address', 'uint', 'uint32', 'uint32', 'address'], [chequeId, payer, payee, amount, validFrom, validThru, hardhatBank.address]);
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
    const hash = ethers.utils.solidityKeccak256(['bytes32', 'address', 'address', 'uint', 'uint32', 'uint32', 'address'], [chequeId, payer, payee, amount, validFrom, validThru, hardhatBank.address]);
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
    const hash = ethers.utils.solidityKeccak256(['bytes32', 'address', 'address', 'uint', 'uint32', 'uint32', 'address'], [chequeId, payer, payee, amount, validFrom, validThru, hardhatBank.address]);
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
    const hash = ethers.utils.solidityKeccak256(['bytes32', 'address', 'address', 'uint', 'uint32', 'uint32', 'address'], [chequeId, payer, payee, amount, validFrom, validThru, hardhatBank.address]);
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

    const NotIssuedCheque = await hardhatBank.chequeStatus(chequeId);
    await hardhatBank.connect(owner).issueECheque(chequeId);
    const issuedCheque = await hardhatBank.chequeStatus(chequeId);
    await hardhatBank.connect(owner).revoke(chequeId);
    const revokedCheque = await hardhatBank.chequeStatus(chequeId);
    expect([NotIssuedCheque.status, issuedCheque.status, revokedCheque.status]).to.deep.eq([0, 1, 3]);
  })

  it('Should NOT revoke if noe the owner of the cheque', async () => {
    const { hardhatBank, owner, addr1, deposit } = await loadFixture(deployFixture);
    await deposit();

    const chequeId = ethers.utils.formatBytes32String('1');

    await hardhatBank.connect(owner).issueECheque(chequeId);

    await expect(hardhatBank.connect(addr1).revoke(chequeId)).to.be.revertedWith('No the owner of the cheque');
  })

  it('Should NOT revoke if cheque redeemed', async () => {
    const { hardhatBank, owner, deposit, addr1 } = await loadFixture(deployFixture);
    await deposit();

    const chequeId = ethers.utils.formatBytes32String('1');
    const payer = owner.address;
    const payee = addr1.address;
    const amount = ethers.utils.parseEther("1.0");
    const validFrom = 0;
    const validThru = 0;
    const hash = ethers.utils.solidityKeccak256(['bytes32', 'address', 'address', 'uint', 'uint32', 'uint32', 'address'], [chequeId, payer, payee, amount, validFrom, validThru, hardhatBank.address]);
    const sig = await owner.signMessage(ethers.utils.arrayify(hash));

    await hardhatBank.connect(owner).issueECheque(chequeId);
    await hardhatBank.connect(addr1).redeem([[
      amount, chequeId, validFrom, validThru, payee, payer, hardhatBank.address
    ], sig])

    await expect(hardhatBank.connect(owner).revoke(chequeId)).to.be.revertedWith('Cheque id redeemed');
  })

})

describe('E-cheque sign over', () => {
  it('Should redeem sign over cheque successfully', async () => {
    const { hardhatBank, owner, addr1, addr2, addr3, deposit } = await loadFixture(deployFixture);
    await deposit();

    const chequeId = ethers.utils.formatBytes32String('1');
    const payer = owner.address;
    const payee = addr1.address;
    const newPayee = addr2.address;
    const newPayee2 = addr3.address;
    const amount = ethers.utils.parseEther("1.0");
    const validFrom = 0;
    const validThru = 0;
    const magicNum = ethers.BigNumber.from("0xFFFFDEAD");
    const counter = 1;
    const counter2 = 2;

    const hash = ethers.utils.solidityKeccak256(['bytes32', 'address', 'address', 'uint', 'uint32', 'uint32', 'address'], [chequeId, payer, payee, amount, validFrom, validThru, hardhatBank.address]);
    const hashSignOver = ethers.utils.solidityKeccak256(['uint32', 'uint8', 'bytes32', 'address', 'address'], [magicNum, counter, chequeId, payee, newPayee]);
    const hashSignOver2 = ethers.utils.solidityKeccak256(['uint32', 'uint8', 'bytes32', 'address', 'address'], [magicNum, counter2, chequeId, newPayee, newPayee2]);
    const sig = await owner.signMessage(ethers.utils.arrayify(hash));
    const sigSignOver = await addr1.signMessage(ethers.utils.arrayify(hashSignOver));
    const sigSignOver2 = await addr2.signMessage(ethers.utils.arrayify(hashSignOver2));

    await hardhatBank.connect(owner).issueECheque(chequeId);

    await hardhatBank.connect(addr3).notifySignOver([[
      magicNum, counter2, chequeId, newPayee, newPayee2
    ], sigSignOver2]);

    const signOverData = [
      [[
        magicNum, counter, chequeId, payee, newPayee
      ], sigSignOver],
      [[
        magicNum, counter2, chequeId, newPayee, newPayee2
      ], sigSignOver2]
    ]

    const beforePayerBalance = await hardhatBank.userBalances(owner.address);
    const issuedCheque = await hardhatBank.chequeStatus(chequeId);

    await hardhatBank.connect(addr1).redeemSignOver([[
      amount, chequeId, validFrom, validThru, payee, payer, hardhatBank.address
    ], sig], signOverData);

    const afterPayerBalance = await hardhatBank.userBalances(owner.address);
    const redeemedCheque = await hardhatBank.chequeStatus(chequeId);

    expect([issuedCheque.status, redeemedCheque.status]).to.deep.eq([1, 2]);
    expect(beforePayerBalance.sub(afterPayerBalance)).to.be.eq(ethers.utils.parseEther('1'));

    const beforePendingWithdraw = await hardhatBank.pendingWithdraws(newPayee2);

    await expect(hardhatBank.connect(addr1).withdrawTo(amount, newPayee2)).to.changeEtherBalances(
      [hardhatBank.address, newPayee2],
      [ethers.utils.parseEther('-1'), ethers.utils.parseEther('1')],
    )

    const afterPendingWithdraw = await hardhatBank.pendingWithdraws(newPayee2);

    expect(beforePendingWithdraw).to.be.eq(ethers.utils.parseEther('1'));
    expect(afterPendingWithdraw).to.be.eq(ethers.utils.parseEther('0'));
  })

  it('Should NOT redeem sign over cheque, if NOT notifySignOver', async () => {
    const { hardhatBank, owner, addr1, addr2, deposit } = await loadFixture(deployFixture);
    await deposit();

    const chequeId = ethers.utils.formatBytes32String('1');
    const payer = owner.address;
    const payee = addr1.address;
    const newPayee = addr2.address;
    const amount = ethers.utils.parseEther("1.0");
    const validFrom = 0;
    const validThru = 0;
    const magicNum = ethers.BigNumber.from("0xFFFFDEAD");
    const counter = 1;

    const hash = ethers.utils.solidityKeccak256(['bytes32', 'address', 'address', 'uint', 'uint32', 'uint32', 'address'], [chequeId, payer, payee, amount, validFrom, validThru, hardhatBank.address]);
    const hashSignOver = ethers.utils.solidityKeccak256(['uint32', 'uint8', 'bytes32', 'address', 'address'], [magicNum, counter, chequeId, payee, newPayee]);
    const sig = await owner.signMessage(ethers.utils.arrayify(hash));
    const sigSignOver = await addr1.signMessage(ethers.utils.arrayify(hashSignOver));

    await hardhatBank.connect(owner).issueECheque(chequeId);

    const signOverData = [
      [[
        magicNum, counter, chequeId, payee, newPayee
      ], sigSignOver]
    ]

    await expect(hardhatBank.connect(addr1).redeemSignOver([[
      amount, chequeId, validFrom, validThru, payee, payer, hardhatBank.address
    ], sig], signOverData)).to.be.revertedWith('Cheque has not signed over');

  })

  it('Should NOT redeem sign over cheque for first payee, if sign over twice', async () => {
    const { hardhatBank, owner, addr1, addr2, addr3, deposit } = await loadFixture(deployFixture);
    await deposit();

    const chequeId = ethers.utils.formatBytes32String('1');
    const payer = owner.address;
    const payee = addr1.address;
    const newPayee = addr2.address;
    const newPayee2 = addr3.address;
    const amount = ethers.utils.parseEther("1.0");
    const validFrom = 0;
    const validThru = 0;
    const magicNum = ethers.BigNumber.from("0xFFFFDEAD");
    const counter = 1;
    const counter2 = 2;

    const hash = ethers.utils.solidityKeccak256(['bytes32', 'address', 'address', 'uint', 'uint32', 'uint32', 'address'], [chequeId, payer, payee, amount, validFrom, validThru, hardhatBank.address]);
    const hashSignOver = ethers.utils.solidityKeccak256(['uint32', 'uint8', 'bytes32', 'address', 'address'], [magicNum, counter, chequeId, payee, newPayee]);
    const hashSignOver2 = ethers.utils.solidityKeccak256(['uint32', 'uint8', 'bytes32', 'address', 'address'], [magicNum, counter2, chequeId, newPayee, newPayee2]);
    const sig = await owner.signMessage(ethers.utils.arrayify(hash));
    const sigSignOver = await addr1.signMessage(ethers.utils.arrayify(hashSignOver));
    const sigSignOver2 = await addr2.signMessage(ethers.utils.arrayify(hashSignOver2));

    await hardhatBank.connect(owner).issueECheque(chequeId);

    await hardhatBank.connect(addr3).notifySignOver([[
      magicNum, counter, chequeId, payee, newPayee
    ], sigSignOver]);

    const signOverData = [
      [[
        magicNum, counter, chequeId, payee, newPayee
      ], sigSignOver],
      [[
        magicNum, counter2, chequeId, newPayee, newPayee2
      ], sigSignOver2]
    ]

    await expect(hardhatBank.connect(addr1).redeemSignOver([[
      amount, chequeId, validFrom, validThru, payee, payer, hardhatBank.address
    ], sig], signOverData)).to.be.revertedWith('Cheque has signed over again');

  })

  it('Should NOt redeem if sign over the cheque', async () => {
    const { hardhatBank, owner, addr1, addr2, addr3, deposit } = await loadFixture(deployFixture);
    await deposit();

    const chequeId = ethers.utils.formatBytes32String('1');
    const payer = owner.address;
    const payee = addr1.address;
    const newPayee = addr2.address;
    const amount = ethers.utils.parseEther("1.0");
    const validFrom = 0;
    const validThru = 0;
    const magicNum = ethers.BigNumber.from("0xFFFFDEAD");
    const counter = 1;

    const hash = ethers.utils.solidityKeccak256(['bytes32', 'address', 'address', 'uint', 'uint32', 'uint32', 'address'], [chequeId, payer, payee, amount, validFrom, validThru, hardhatBank.address]);
    const hashSignOver = ethers.utils.solidityKeccak256(['uint32', 'uint8', 'bytes32', 'address', 'address'], [magicNum, counter, chequeId, payee, newPayee]);
    const sig = await owner.signMessage(ethers.utils.arrayify(hash));
    const sigSignOver = await addr1.signMessage(ethers.utils.arrayify(hashSignOver));

    await hardhatBank.connect(owner).issueECheque(chequeId);

    await hardhatBank.connect(addr2).notifySignOver([[
      magicNum, counter, chequeId, payee, newPayee
    ], sigSignOver]);

    await expect(hardhatBank.connect(addr1).redeem([[
      amount, chequeId, validFrom, validThru, payee, payer, hardhatBank.address
    ], sig])).to.be.revertedWith('Cheque has signed over');
  })

  it('Should NOT revoke cheque if signed over or signed over again', async () => {
    const { hardhatBank, owner, addr1, addr2, addr3, deposit } = await loadFixture(deployFixture);
    await deposit();

    const chequeId = ethers.utils.formatBytes32String('1');
    const payer = owner.address;
    const payee = addr1.address;
    const newPayee = addr2.address;
    const newPayee2 = addr3.address;
    const amount = ethers.utils.parseEther("1.0");
    const validFrom = 0;
    const validThru = 0;
    const magicNum = ethers.BigNumber.from("0xFFFFDEAD");
    const counter = 1;
    const counter2 = 2;

    const hash = ethers.utils.solidityKeccak256(['bytes32', 'address', 'address', 'uint', 'uint32', 'uint32', 'address'], [chequeId, payer, payee, amount, validFrom, validThru, hardhatBank.address]);
    const hashSignOver = ethers.utils.solidityKeccak256(['uint32', 'uint8', 'bytes32', 'address', 'address'], [magicNum, counter, chequeId, payee, newPayee]);
    const hashSignOver2 = ethers.utils.solidityKeccak256(['uint32', 'uint8', 'bytes32', 'address', 'address'], [magicNum, counter2, chequeId, newPayee, newPayee2]);
    const sig = await owner.signMessage(ethers.utils.arrayify(hash));
    const sigSignOver = await addr1.signMessage(ethers.utils.arrayify(hashSignOver));
    const sigSignOver2 = await addr2.signMessage(ethers.utils.arrayify(hashSignOver2));

    await hardhatBank.connect(owner).issueECheque(chequeId);

    await hardhatBank.connect(addr2).notifySignOver([[
      magicNum, counter, chequeId, payee, newPayee
    ], sigSignOver]);

    await expect(hardhatBank.connect(owner).revoke(chequeId)).to.be.revertedWith('No the owner of the cheque');

    await hardhatBank.connect(addr3).notifySignOver([[
      magicNum, counter2, chequeId, newPayee, newPayee2
    ], sigSignOver2]);

    await expect(hardhatBank.connect(addr1).revoke(chequeId)).to.be.revertedWith('No the owner of the cheque');
  })

  it('Should sign-over payee revoke cheque', async () => {
    const { hardhatBank, owner, addr1, addr2, addr3, deposit } = await loadFixture(deployFixture);
    await deposit();

    const chequeId = ethers.utils.formatBytes32String('1');
    const payer = owner.address;
    const payee = addr1.address;
    const newPayee = addr2.address;
    const amount = ethers.utils.parseEther("1.0");
    const validFrom = 0;
    const validThru = 0;
    const magicNum = ethers.BigNumber.from("0xFFFFDEAD");
    const counter = 1;

    const hash = ethers.utils.solidityKeccak256(['bytes32', 'address', 'address', 'uint', 'uint32', 'uint32', 'address'], [chequeId, payer, payee, amount, validFrom, validThru, hardhatBank.address]);
    const hashSignOver = ethers.utils.solidityKeccak256(['uint32', 'uint8', 'bytes32', 'address', 'address'], [magicNum, counter, chequeId, payee, newPayee]);
    const sig = await owner.signMessage(ethers.utils.arrayify(hash));
    const sigSignOver = await addr1.signMessage(ethers.utils.arrayify(hashSignOver));

    await hardhatBank.connect(owner).issueECheque(chequeId);

    await hardhatBank.connect(addr2).notifySignOver([[
      magicNum, counter, chequeId, payee, newPayee
    ], sigSignOver]);

    const issuedCheque = await hardhatBank.chequeStatus(chequeId);

    await hardhatBank.connect(addr1).revoke(chequeId);

    const revokedCheque = await hardhatBank.chequeStatus(chequeId);

    expect([issuedCheque.status, revokedCheque.status]).to.deep.eq([1, 3]);

  })
})

describe('IsChequeValid function', () => {
  it('Verified cheque ', async () => {
    const { hardhatBank, owner, addr1, addr2, addr3 } = await loadFixture(deployFixture);

    const chequeId = ethers.utils.formatBytes32String('1');
    const payer = owner.address;
    const payee = addr1.address;
    const newPayee = addr2.address;
    const newPayee2 = addr3.address;
    const amount = ethers.utils.parseEther("1.0");
    const validFrom = 0;
    const validThru = 0;
    const magicNum = ethers.BigNumber.from("0xFFFFDEAD");
    const counter = 1;
    const counter2 = 2;

    const hash = ethers.utils.solidityKeccak256(['bytes32', 'address', 'address', 'uint', 'uint32', 'uint32', 'address'], [chequeId, payer, payee, amount, validFrom, validThru, hardhatBank.address]);
    const hashSignOver = ethers.utils.solidityKeccak256(['uint32', 'uint8', 'bytes32', 'address', 'address'], [magicNum, counter, chequeId, payee, newPayee]);
    const hashSignOver2 = ethers.utils.solidityKeccak256(['uint32', 'uint8', 'bytes32', 'address', 'address'], [magicNum, counter2, chequeId, newPayee, newPayee2]);
    const sig = await owner.signMessage(ethers.utils.arrayify(hash));
    const sigSignOver = await addr1.signMessage(ethers.utils.arrayify(hashSignOver));
    const sigSignOver2 = await addr2.signMessage(ethers.utils.arrayify(hashSignOver2));

    // not sign over yet
    expect(
      await hardhatBank.isChequeValid([[
        amount, chequeId, validFrom, validThru, payee, payer, hardhatBank.address
      ], sig], [])
    ).to.equal(true)
    expect(
      await hardhatBank.isChequeValid([[
        amount, chequeId, validFrom, validThru, addr3.address, payer, hardhatBank.address
      ], sig], [])
    ).to.equal(false)

    await hardhatBank.connect(addr3).notifySignOver([[
      magicNum, counter2, chequeId, newPayee, newPayee2
    ], sigSignOver2]);

    const signOverData = [
      [[
        magicNum, counter, chequeId, payee, newPayee
      ], sigSignOver],
      [[
        magicNum, counter2, chequeId, newPayee, newPayee2
      ], sigSignOver2]
    ]

    const signOverData2 = [
      [[
        magicNum, counter, chequeId, payee, newPayee2
      ], sigSignOver],
      [[
        magicNum, counter2, chequeId, newPayee, newPayee2
      ], sigSignOver2]
    ]

    const signOverData3 = [
      [[
        magicNum, counter, chequeId, payee, newPayee2
      ], sigSignOver],
    ]

    // has signed over already
    expect(await hardhatBank.isChequeValid([[
      amount, chequeId, validFrom, validThru, payee, payer, hardhatBank.address
    ], sig], signOverData)).to.be.eq(true);

    expect(await hardhatBank.isChequeValid([[
      amount, chequeId, validFrom, validThru, payee, payer, hardhatBank.address
    ], sig], signOverData2)).to.be.eq(false);

    expect(await hardhatBank.isChequeValid([[
      amount, chequeId, validFrom, validThru, payee, payer, hardhatBank.address
    ], sig], signOverData3)).to.be.eq(false);
  })
})