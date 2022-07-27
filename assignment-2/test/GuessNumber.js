const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("GuessNumber contract", function () {
  async function case1DeployFixture() {
    const GuessNumber = await ethers.getContractFactory("GuessNumber");
    const [owner, addr1, addr2] = await ethers.getSigners();
    const abi = ethers.utils.defaultAbiCoder;

    const randomNonce = 'HELLO';
    const bytes32Nonce = ethers.utils.formatBytes32String(randomNonce);
    const resultNumber = 999;

    const nonceHash = ethers.utils.keccak256(abi.encode(['bytes32'], [bytes32Nonce]));
    const nonceNumHash = ethers.utils.keccak256(abi.encode(['bytes32', 'uint16'], [bytes32Nonce, resultNumber]));

    const hardhatGuessNumber = await GuessNumber.deploy(nonceHash, nonceNumHash, { value: ethers.utils.parseEther("1.0") });

    await hardhatGuessNumber.deployed();

    // Fixtures can return anything you consider useful for your tests
    return { hardhatGuessNumber, randomNonce, bytes32Nonce, resultNumber, owner, addr1, addr2 };
  }

  async function case3DeployFixture() {
    const GuessNumber = await ethers.getContractFactory("GuessNumber");
    const [owner, addr1, addr2] = await ethers.getSigners();
    const abi = ethers.utils.defaultAbiCoder;

    const randomNonce = 'HELLO';
    const bytes32Nonce = ethers.utils.formatBytes32String(randomNonce);
    const resultNumber = 500;

    const nonceHash = ethers.utils.keccak256(abi.encode(['bytes32'], [bytes32Nonce]));
    const nonceNumHash = ethers.utils.keccak256(abi.encode(['bytes32', 'uint16'], [bytes32Nonce, resultNumber]));

    const hardhatGuessNumber = await GuessNumber.deploy(nonceHash, nonceNumHash, { value: ethers.utils.parseEther("1.0") });

    await hardhatGuessNumber.deployed();

    // Fixtures can return anything you consider useful for your tests
    return { hardhatGuessNumber, randomNonce, bytes32Nonce, resultNumber, owner, addr1, addr2 };
  }
  async function case4DeployFixture() {
    const GuessNumber = await ethers.getContractFactory("GuessNumber");
    const [owner, addr1, addr2] = await ethers.getSigners();
    const abi = ethers.utils.defaultAbiCoder;

    const randomNonce = 'HELLO';
    const bytes32Nonce = ethers.utils.formatBytes32String(randomNonce);
    const resultNumber = 1415;

    const nonceHash = ethers.utils.keccak256(abi.encode(['bytes32'], [bytes32Nonce]));
    const nonceNumHash = ethers.utils.keccak256(abi.encode(['bytes32', 'uint16'], [bytes32Nonce, resultNumber]));

    const hardhatGuessNumber = await GuessNumber.deploy(nonceHash, nonceNumHash, { value: ethers.utils.parseEther("1.0") });

    await hardhatGuessNumber.deployed();

    // Fixtures can return anything you consider useful for your tests
    return { hardhatGuessNumber, randomNonce, bytes32Nonce, resultNumber, owner, addr1, addr2 };
  }


  describe.only("Game play", () => {
    it("Player 2 wins the game and receives 3 Ether as rewards.", async function () {
      const { hardhatGuessNumber, owner, addr1, addr2, resultNumber, bytes32Nonce } = await loadFixture(case1DeployFixture);

      await hardhatGuessNumber.connect(addr1).guess(800, { value: ethers.utils.parseEther("1.0") });
      await hardhatGuessNumber.connect(addr2).guess(900, { value: ethers.utils.parseEther("1.0") });
      await expect(hardhatGuessNumber.connect(owner).reveal(bytes32Nonce, resultNumber)).to.changeEtherBalances(
        [hardhatGuessNumber.address, addr2.address],
        [ethers.utils.parseEther('-3'), ethers.utils.parseEther('3')],
      )
    })
    it("Player 1 input is reverted since he does not attach 1 Ether as the deposit value.", async function () {
      const { hardhatGuessNumber, addr1 } = await loadFixture(case1DeployFixture);
      await expect(hardhatGuessNumber.connect(addr1).guess(800, { value: ethers.utils.parseEther("2.0") })).to.be.revertedWith('donnot send the same value with the host');
      // await hardhatGuessNumber.connect(addr2).guess(900, { value: ethers.utils.parseEther("1.0") });
    })

    it("Player 1 and 2 both receive 1.5 Ether as rewards since their guessings have the same delta.", async function () {
      const { hardhatGuessNumber, owner, addr1, addr2, resultNumber, bytes32Nonce } = await loadFixture(case3DeployFixture);

      await hardhatGuessNumber.connect(addr1).guess(450, { value: ethers.utils.parseEther("1.0") });
      await hardhatGuessNumber.connect(addr2).guess(550, { value: ethers.utils.parseEther("1.0") });

      await expect(hardhatGuessNumber.connect(owner).reveal(bytes32Nonce, resultNumber)).to.changeEtherBalances(
        [addr1.address, addr2.address],
        [ethers.utils.parseEther('1.5'), ethers.utils.parseEther('1.5')],
      )
    })

    it("Player 1 and 2 both receive 1.5 Ether as rewards since the host does not follow the rule (0<=n<1000).", async function () {
      const { hardhatGuessNumber, owner, addr1, addr2, resultNumber, bytes32Nonce } = await loadFixture(case4DeployFixture);

      await hardhatGuessNumber.connect(addr1).guess(1, { value: ethers.utils.parseEther("1.0") });
      await hardhatGuessNumber.connect(addr2).guess(2, { value: ethers.utils.parseEther("1.0") });

      await expect(hardhatGuessNumber.connect(owner).reveal(bytes32Nonce, resultNumber)).to.changeEtherBalances(
        [addr1.address, addr2.address],
        [ethers.utils.parseEther('1.5'), ethers.utils.parseEther('1.5')],
      )
    })
  })

})