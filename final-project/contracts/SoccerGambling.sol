// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

// import "hardhat/console.sol";

contract SoccerGambling {
    // the quorum info
    address[] public approvers;
    uint256 public quorum;
    uint256 public constant rejectQuorum = 3;

    enum GambleOption {
        A,
        B
    }

    struct Rate {
        uint256 rateA;
        uint256 rateB;
    }
    struct Options {
        string optionA;
        string optionB;
    }

    struct Gamble {
        uint256 id;
        string title;
        string description;
        Options options;
        Rate rate;
        uint256 expiredAt;
        bool isRevealed;
        address owner;
        uint256 totalAmount;
        uint256 filledAmount;
        uint256 approvers;
        uint256 rejecters;
    }

    // id => GambleOption => user address[]
    mapping(uint256 => mapping(GambleOption => address[])) userGambles;
    // id => GambleOption => user input amount[]
    mapping(uint256 => mapping(GambleOption => uint256[])) userGambleAmount;
    mapping(uint256 => GambleOption) correctAnswers;

    // cro amount for users
    mapping(address => uint256) public userBalances;

    uint256 public nextId;
    Gamble[] public gambleList;

    modifier checkInputAmount(uint256 id, uint256 amount) {
        Gamble memory gamble = gambleList[id];
        uint256 leftAmount = gamble.totalAmount - gamble.filledAmount;
        require(leftAmount >= amount, "Not enough fill amount");
        _;
    }
    modifier maxInputAmount(uint256 id, uint256 amount) {
        Gamble memory gamble = gambleList[id];
        Rate memory rate = gamble.rate;

        // total amount = 1000 cro, rate [1, 2], maxFilledAmount = 500;
        // total amount = 1000 cro, rate [1, 1], maxFilledAmount = 1000;

        uint256 maxAmount = amount *
            (rate.rateA > rate.rateB ? rate.rateA : rate.rateB);

        require(
            gamble.totalAmount - maxAmount >= 0,
            "Cannot bigger than total prizes"
        );
        _;
    }

    constructor(address[] memory _approvers, uint256 _quorum) {
        approvers = _approvers;
        quorum = _quorum;
    }

    /**
    // rate, [1, 1] representing A and B both win 1 time
    // rate, [1, 2] representing A win 1 time, B win 2 times 
    // rate, [2, 1] representing A win 2 times, B win 1 time 
     */
    function createGamble(
        string calldata title,
        string calldata description,
        Options calldata options,
        Rate calldata rate,
        uint256 expiredAt
    ) external payable {
        Gamble memory gamble = Gamble(
            nextId,
            title,
            description,
            options,
            rate,
            expiredAt,
            false,
            msg.sender,
            msg.value,
            0,
            0,
            0
        );

        gambleList.push(gamble);

        // supply cro to earn tonic
    }

    function test() external view returns (uint256) {
        return gambleList[0].rate.rateA;
    }

    function playGamble(uint256 id, GambleOption option)
        external
        payable
        checkInputAmount(id, msg.value)
        maxInputAmount(id, msg.value)
    {
        require(msg.value >= 100, "Must put more than 100 cro");

        Gamble storage gamble = gambleList[id];
        uint256 rate = option == GambleOption.A
            ? gamble.rate.rateA
            : gamble.rate.rateB;

        userGambles[id][option].push(msg.sender);
        userGambleAmount[id][option].push(msg.value);
        gamble.filledAmount += (rate * msg.value);
    }

    function revealGamble(uint256 id, GambleOption correctOption) external {
        Gamble storage gamble = gambleList[id];
        require(!gamble.isRevealed, "Gamble has revealed");
        require(
            gamble.expiredAt <= block.timestamp,
            "Gamble can not reveal now"
        );

        gamble.isRevealed = true;
        correctAnswers[id] = correctOption;
    }

    function approveGamble(uint256 id) external {
        Gamble storage gamble = gambleList[id];
        require(gamble.isRevealed, "Gamble has not revealed");
        gamble.approvers += 1;

        if (gamble.approvers >= quorum) {
            GambleOption _correctAnswers = correctAnswers[id];
            address[] memory winners = getWinners(id, _correctAnswers);
            uint256 rate = _correctAnswers == GambleOption.A
                ? gamble.rate.rateA
                : gamble.rate.rateB;

            uint256 amountForGambleOwner = gamble.totalAmount;
            for (uint256 i = 0; i < winners.length; i++) {
                uint256 amount = userGambleAmount[id][_correctAnswers][i] *
                    rate;
                amountForGambleOwner -= amount;
                allocateReward(winners[i], amount);
            }
            if (amountForGambleOwner != 0) {
                allocateReward(gamble.owner, amountForGambleOwner);
            }

            // withdraw the supplied cro, and get tonic
        }
    }

    // reject the dishonest gamble owner, if the owner reveal the wrong result
    function rejectGamble(uint256 id) external {
        Gamble storage gamble = gambleList[id];
        gamble.rejecters += 1;
        if (rejectQuorum >= rejectQuorum) {
            // punish the gamble owner
        }
    }

    function getWinners(uint256 id, GambleOption correctOption)
        public
        view
        returns (address[] memory)
    {
        return userGambles[id][correctOption];
    }

    // get the unfilled amount of the gamble
    function leftFilledAmount(uint256 id)
        external
        view
        returns (uint256 leftAmount)
    {
        Gamble memory gamble = gambleList[id];

        leftAmount = gamble.totalAmount - gamble.filledAmount;
    }

    function allocateReward(address user, uint256 amount) private {
        userBalances[user] += amount;
    }

    function withdrawTo(uint256 _amount, address payable recipient) external {
        require(
            userBalances[recipient] >= _amount,
            "Failed to withdraw to recipient"
        );
        userBalances[recipient] -= _amount;

        (bool sent, ) = recipient.call{value: _amount}("");
        require(sent, "Failed to send Ether");
    }
}
