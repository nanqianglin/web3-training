const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("GuessNumber contract", function (accounts) {
  async function case1DeployFixture() {
    const GuessNumber = await ethers.getContractFactory("GuessNumber");
    const [owner, addr1, addr2, addr3, addr4, addr5, addr6] = await ethers.getSigners();

    const randomNonce = 'HELLO';
    const resultNumber = 999;
    const _nonce = ethers.utils.formatBytes32String(randomNonce);
    const _nonceNum = ethers.utils.formatBytes32String(randomNonce + resultNumber);
    const hardhatGuessNumber = await GuessNumber.deploy(_nonce, resultNumber, { value: ethers.utils.parseEther("1.0") });

    await hardhatGuessNumber.deployed();

    // Fixtures can return anything you consider useful for your tests
    return { GuessNumber, hardhatGuessNumber, randomNonce, _nonce, _nonceNum, resultNumber, owner, addr1, addr2 };
  }

  async function case3DeployFixture() {
    const GuessNumber = await ethers.getContractFactory("GuessNumber");
    const [owner, addr1, addr2, addr3, addr4, addr5, addr6] = await ethers.getSigners();

    const randomNonce = 'HELLO';
    const resultNumber = 500;
    const _nonce = ethers.utils.formatBytes32String(randomNonce);
    const _nonceNum = ethers.utils.formatBytes32String(randomNonce + resultNumber);
    const hardhatGuessNumber = await GuessNumber.deploy(_nonce, resultNumber, { value: ethers.utils.parseEther("1.0") });

    await hardhatGuessNumber.deployed();

    // Fixtures can return anything you consider useful for your tests
    return { GuessNumber, hardhatGuessNumber, randomNonce, _nonce, _nonceNum, resultNumber, owner, addr1, addr2 };
  }
  async function case4DeployFixture() {
    const GuessNumber = await ethers.getContractFactory("GuessNumber");
    const [owner, addr1, addr2, addr3, addr4, addr5, addr6] = await ethers.getSigners();

    const randomNonce = 'HELLO';
    const resultNumber = 1415;
    const _nonce = ethers.utils.formatBytes32String(randomNonce);
    const _nonceNum = ethers.utils.formatBytes32String(randomNonce + resultNumber);
    const hardhatGuessNumber = await GuessNumber.deploy(_nonce, resultNumber, { value: ethers.utils.parseEther("1.0") });

    await hardhatGuessNumber.deployed();

    // Fixtures can return anything you consider useful for your tests
    return { GuessNumber, hardhatGuessNumber, randomNonce, _nonce, _nonceNum, resultNumber, owner, addr1, addr2 };
  }


  describe("Game play", () => {
    it("Player 2 wins the game and receives 3 Ether as rewards.", async function () {
      const { hardhatGuessNumber, owner, addr1, addr2, resultNumber, _nonce } = await loadFixture(case1DeployFixture);

      await hardhatGuessNumber.connect(addr1).guess(800, { value: ethers.utils.parseEther("1.0") });
      await hardhatGuessNumber.connect(addr2).guess(900, { value: ethers.utils.parseEther("1.0") });

      await expect(hardhatGuessNumber.connect(owner).reveal(_nonce, resultNumber)).to.changeEtherBalances(
        [hardhatGuessNumber.address, addr2.address],
        [ethers.utils.parseEther('-3'), ethers.utils.parseEther('3')],
      )

    })
    it("Player 1 input is reverted since he does not attach 1 Ether as the deposit value.", async function () {
      const { hardhatGuessNumber, addr1, addr2 } = await loadFixture(case1DeployFixture);
      await expect(hardhatGuessNumber.connect(addr1).guess(800, { value: ethers.utils.parseEther("2.0") })).to.be.revertedWith('donnot send the same value with the host');
      // await hardhatGuessNumber.connect(addr2).guess(900, { value: ethers.utils.parseEther("1.0") });
    })

    it("Player 1 and 2 both receive 1.5 Ether as rewards since their guessings have the same delta.", async function () {
      const { hardhatGuessNumber, owner, addr1, addr2, resultNumber, _nonce } = await loadFixture(case3DeployFixture);

      await hardhatGuessNumber.connect(addr1).guess(450, { value: ethers.utils.parseEther("1.0") });
      await hardhatGuessNumber.connect(addr2).guess(550, { value: ethers.utils.parseEther("1.0") });

      await expect(hardhatGuessNumber.connect(owner).reveal(_nonce, resultNumber)).to.changeEtherBalances(
        [addr1.address, addr2.address],
        [ethers.utils.parseEther('1.5'), ethers.utils.parseEther('1.5')],
      )
    })

    it("Player 1 and 2 both receive 1.5 Ether as rewards since the host does not follow the rule (0<=n<1000).", async function () {
      const { hardhatGuessNumber, owner, addr1, addr2, resultNumber, _nonce } = await loadFixture(case4DeployFixture);

      await hardhatGuessNumber.connect(addr1).guess(1, { value: ethers.utils.parseEther("1.0") });
      await hardhatGuessNumber.connect(addr2).guess(2, { value: ethers.utils.parseEther("1.0") });

      await expect(hardhatGuessNumber.connect(owner).reveal(_nonce, resultNumber)).to.changeEtherBalances(
        [addr1.address, addr2.address],
        [ethers.utils.parseEther('1.5'), ethers.utils.parseEther('1.5')],
      )
    })
  })

})