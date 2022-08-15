// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

// import "hardhat/console.sol";

interface IToken {
    // function balanceOfUnderlying(address owner) external returns (uint256);

    // function exchangeRateCurrent() external returns (uint256);

    function redeem(uint256 redeemTokens) external returns (uint256);

    function mint() external payable;

    function balanceOf(address owner) external view returns (uint256);
}

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

struct GambleStatus {
    bool isRevealed;
    bool isFinished;
    uint256 totalAmount;
    uint256 filledAmount;
    uint256 approvers;
    uint256 rejecters;
}
struct GambleInfo {
    string title;
    string description;
    address owner;
    Options options;
    Rate rate;
    uint256 expiredAt;
}

struct Gamble {
    uint256 id;
    GambleInfo gambleInfo;
    GambleStatus gambleStatus;
}

contract GamblePrize {
    Gamble private gamble;

    IToken private token;
    address private owner;

    constructor(
        uint256 id,
        string memory title,
        string memory description,
        Options memory options,
        Rate memory rate,
        uint256 expiredAt,
        address _token,
        address _owner,
        address _gambleOwner
    ) payable {
        gamble = Gamble({
            id: id,
            gambleInfo: GambleInfo({
                title: title,
                description: description,
                owner: _gambleOwner,
                options: options,
                rate: rate,
                expiredAt: expiredAt
            }),
            gambleStatus: GambleStatus({
                isRevealed: false,
                isFinished: false,
                totalAmount: msg.value,
                filledAmount: 0,
                approvers: 0,
                rejecters: 0
            })
        });

        token = IToken(_token);
        owner = _owner;

        supplyCro(msg.value);
    }

    function getGamble() external view returns (Gamble memory _gamble) {
        _gamble = gamble;
    }

    // supply cro to the tectonic contract
    function supplyCro(uint256 amount) private {
        require(address(this).balance >= amount, "Insufficient funds");
        token.mint{value: amount}();
    }

    function redeemCro() external {
        // cToken * rate = cro
        // cToken = cro / rate
        // uint256 redeemAmount = amount / (token.exchangeRateCurrent() / 10**18);
        uint256 redeemAmount = token.balanceOf(address(this));

        uint256 err = token.redeem(redeemAmount);
        require(err == 0, "Redeem failed");
        sendCro();
    }

    function sendCro() private {
        uint256 balance = address(this).balance;
        uint256 amount = gamble.gambleStatus.totalAmount;
        uint256 interest = balance - amount;
        // console.log(balance);
        // console.log(amount);
        // console.log(interest);

        if (interest > 0) {
            (bool _sent, ) = owner.call{value: interest}("");
            require(_sent, "Failed to send Ether to owner");
        }

        (bool sent, ) = msg.sender.call{value: amount}("");
        require(sent, "Failed to send Ether to contract");
    }

    receive() external payable {}

    fallback() external payable {}
}

contract MyFactory {
    event CreateGamble(
        address indexed owner,
        uint256 indexed id,
        string indexed title,
        uint256 value
    );
    event PlayGamble(
        address indexed user,
        uint256 indexed id,
        GambleOption option,
        uint256 amount
    );
    event RevealGamble(
        uint256 indexed id,
        GambleOption correctOption,
        uint256 revealTime
    );
    event ApproveGamble(
        address indexed approver,
        uint256 indexed id,
        uint256 approveTime
    );
    event RejectGamble(
        address indexed rejector,
        uint256 indexed id,
        uint256 rejectTime
    );
    // event PunishGambleOwner(uint256 indexed id, address indexed owner);
    event FinishGamble(
        address indexed user,
        uint256 indexed id,
        uint256 finishTime
    );
    // event WithdrawTo(
    //     uint256 amount,
    //     address indexed recipient,
    //     address indexed executor
    // );

    // the quorum info
    address[] private approvers;
    mapping(address => bool) private isApprover;
    uint256 private quorum;
    uint256 private rejectQuorum = 1;
    address private tokenAddress;

    uint256 public minCro = 100 ether;

    address private owner;

    // id => GambleOption => user address[]
    mapping(uint256 => mapping(GambleOption => address[])) public userGambles;
    // id => GambleOption => user input amount[]
    mapping(uint256 => mapping(GambleOption => uint256[]))
        private userGambleAmount;
    mapping(uint256 => GambleOption) public correctAnswers;
    // id => approver => bool
    mapping(uint256 => mapping(address => bool)) public isApprovedOrRejected;

    // cro amount for users
    mapping(address => uint256) public userBalances;

    struct GambleContact {
        uint256 id;
        GambleInfo gambleInfo;
        GambleStatus gambleStatus;
    }

    Gamble[] private gambleList;
    GamblePrize[] private gamblePrizes;

    modifier checkInputAmount(uint256 id, uint256 amount) {
        uint256 leftAmount = gambleList[id].gambleStatus.totalAmount -
            gambleList[id].gambleStatus.filledAmount;
        require(leftAmount >= amount, "Not enough fill amount");
        _;
    }

    modifier onlyApprover() {
        require(isApprover[msg.sender], "Not approver");
        _;
    }

    modifier gambleExists(uint256 id) {
        require(id < gambleList.length, "Gamble does not exist");
        _;
    }
    modifier notRevealed(uint256 id) {
        require(
            !gambleList[id].gambleStatus.isRevealed,
            "Gamble already revealed"
        );
        _;
    }
    modifier isRevealed(uint256 id) {
        require(
            gambleList[id].gambleStatus.isRevealed,
            "Gamble does not reveal"
        );
        _;
    }
    modifier notFinished(uint256 id) {
        require(
            !gambleList[id].gambleStatus.isFinished,
            "Gamble already finished"
        );
        _;
    }
    modifier notExpired(uint256 id) {
        require(
            gambleList[id].gambleInfo.expiredAt > block.timestamp,
            "Gamble expired"
        );
        _;
    }

    modifier notApprovedOrRejected(uint256 id) {
        require(
            !isApprovedOrRejected[id][msg.sender],
            "You already approved or rejected"
        );
        _;
    }

    constructor(
        address[] memory _approvers,
        uint256 _quorum,
        address _token
    ) {
        require(_token != address(0), "Invalid tectonic contract");
        uint256 len = _approvers.length;
        require(len > 0, "Approvers required");
        require(
            _quorum > 0 && _quorum <= len,
            "Invalid number of required quorum"
        );
        for (uint256 i = 0; i < len; i++) {
            address approver = _approvers[i];

            require(approver != address(0), "Invalid approver");
            require(!isApprover[approver], "Approver not unique");

            isApprover[approver] = true;
            approvers.push(approver);
        }

        quorum = _quorum;
        tokenAddress = _token;
        owner = msg.sender;
    }

    function createGamble(
        string calldata title,
        string calldata description,
        Options calldata options,
        Rate calldata rate,
        uint256 expiredAt
    ) external payable {
        require(
            msg.value > minCro,
            "Must put more than the amounts of minimum cro as the prizes value"
        );
        // require(
        //     expiredAt > block.timestamp,
        //     "Expired at must be greater than now"
        // );

        uint256 id = gamblePrizes.length;
        // console.log(msg.value);
        GamblePrize gamblePrize = new GamblePrize{value: msg.value}(
            id,
            title,
            description,
            options,
            rate,
            expiredAt,
            tokenAddress,
            owner,
            msg.sender
        );

        gamblePrizes.push(gamblePrize);

        Gamble memory gamble = gamblePrize.getGamble();

        gambleList.push(
            Gamble({
                id: id,
                gambleInfo: gamble.gambleInfo,
                gambleStatus: gamble.gambleStatus
            })
        );

        emit CreateGamble(msg.sender, id, title, msg.value);
    }

    function playGamble(uint256 id, GambleOption option)
        external
        payable
        gambleExists(id)
        notRevealed(id)
        notExpired(id)
        checkInputAmount(id, msg.value)
    {
        require(msg.value >= 1 ether, "Must bigger or equal to 1 cro");

        Gamble storage gamble = gambleList[id];
        uint256 rate = option == GambleOption.A
            ? gamble.gambleInfo.rate.rateA
            : gamble.gambleInfo.rate.rateB;
        uint256 maxAmount = msg.value * rate;

        require(
            gamble.gambleStatus.totalAmount >= maxAmount,
            "Cannot bigger than total prizes"
        );

        userGambles[id][option].push(msg.sender);
        userGambleAmount[id][option].push(msg.value);
        gamble.gambleStatus.filledAmount += (rate * msg.value);

        emit PlayGamble(msg.sender, id, option, msg.value);
    }

    function revealGamble(uint256 id, GambleOption correctOption)
        external
        gambleExists(id)
        notRevealed(id)
    {
        Gamble storage gamble = gambleList[id];
        require(
            gamble.gambleInfo.expiredAt <= block.timestamp,
            "Gamble is not expired"
        );
        require(
            gamble.gambleInfo.owner == msg.sender,
            "Not the owner of the gamble"
        );

        gamble.gambleStatus.isRevealed = true;
        correctAnswers[id] = correctOption;

        emit RevealGamble(id, correctOption, block.timestamp);
    }

    function approveGamble(uint256 id)
        external
        onlyApprover
        gambleExists(id)
        isRevealed(id)
        notFinished(id)
        notApprovedOrRejected(id)
    {
        Gamble storage gamble = gambleList[id];

        gamble.gambleStatus.approvers += 1;
        isApprovedOrRejected[id][msg.sender] = true;

        emit ApproveGamble(msg.sender, id, block.timestamp);
    }

    // reject the dishonest gamble owner, if the owner reveal the wrong result
    function rejectGamble(uint256 id)
        external
        onlyApprover
        gambleExists(id)
        isRevealed(id)
        notFinished(id)
        notApprovedOrRejected(id)
    {
        Gamble storage gamble = gambleList[id];

        gamble.gambleStatus.rejecters += 1;
        isApprovedOrRejected[id][msg.sender] = true;

        emit RejectGamble(msg.sender, id, block.timestamp);
    }

    // allocate money to the user and gamble owner
    function finishGamble(uint256 id)
        external
        gambleExists(id)
        isRevealed(id)
        notFinished(id)
    {
        Gamble storage gamble = gambleList[id];
        require(
            gamble.gambleStatus.rejecters >= rejectQuorum ||
                gamble.gambleStatus.approvers >= quorum,
            "Not enough approvers or rejecters"
        );

        GambleOption _correctAnswers = correctAnswers[id];
        bool isCollectAnswer = _correctAnswers == GambleOption.A;

        address[] memory winners = getWinners(id, _correctAnswers);
        uint256 amountForGambleOwner = gamble.gambleStatus.totalAmount;
        uint256 rate = isCollectAnswer
            ? gamble.gambleInfo.rate.rateA
            : gamble.gambleInfo.rate.rateB;

        // give money to the winners
        for (uint256 i = 0; i < winners.length; i++) {
            uint256 amount = userGambleAmount[id][_correctAnswers][i];
            amountForGambleOwner -= amount * rate;
            allocateReward(winners[i], amount * rate + amount);
        }

        // give the money to the other users
        if (gamble.gambleStatus.rejecters >= rejectQuorum) {
            if (amountForGambleOwner > 0) {
                address[] memory otherUsers = getFailures(id, _correctAnswers);
                uint256 _len = otherUsers.length;

                for (uint256 j = 0; j < _len; j++) {
                    uint256 othersAmount = userGambleAmount[id][
                        isCollectAnswer ? GambleOption.B : GambleOption.A
                    ][j];

                    amountForGambleOwner -= othersAmount;
                    allocateReward(otherUsers[j], othersAmount);
                }
            }
        } else {
            // give the money of failures to the owner
            uint256[] memory failureMounts = userGambleAmount[id][
                isCollectAnswer ? GambleOption.B : GambleOption.A
            ];
            for (uint256 j = 0; j < failureMounts.length; j++) {
                amountForGambleOwner += failureMounts[j];
            }
        }

        // give the money to the owner
        if (amountForGambleOwner > 0) {
            allocateReward(gamble.gambleInfo.owner, amountForGambleOwner);
        }

        gamble.gambleStatus.isFinished = true;

        GamblePrize gamblePrize = gamblePrizes[id];
        gamblePrize.redeemCro();

        emit FinishGamble(msg.sender, id, block.timestamp);
    }

    function getWinners(uint256 id, GambleOption correctOption)
        private
        view
        returns (address[] memory)
    {
        return userGambles[id][correctOption];
    }

    function getFailures(uint256 id, GambleOption correctOption)
        private
        view
        returns (address[] memory)
    {
        return
            userGambles[id][
                correctOption == GambleOption.A
                    ? GambleOption.B
                    : GambleOption.A
            ];
    }

    // get the unfilled amount of the gamble
    function leftFilledAmount(uint256 id)
        private
        view
        returns (uint256 leftAmount)
    {
        Gamble memory gamble = gambleList[id];

        leftAmount =
            gamble.gambleStatus.totalAmount -
            gamble.gambleStatus.filledAmount;
    }

    function getApprovers() external view returns (address[] memory) {
        return approvers;
    }

    function allocateReward(address user, uint256 amount) private {
        userBalances[user] += amount;
    }

    function withdrawTo(uint256 _amount, address payable recipient) external {
        require(
            userBalances[msg.sender] >= _amount,
            "Not enough funds to withdraw"
        );
        userBalances[msg.sender] -= _amount;

        (bool sent, ) = recipient.call{value: _amount}("");
        require(sent, "Failed to send Ether");

        // emit WithdrawTo(_amount, recipient, msg.sender);
    }

    function getGambleList() external view returns (Gamble[] memory) {
        return gambleList;
    }

    function getFactoryBalance() external view returns (uint256 balance) {
        balance = address(this).balance;
    }

    receive() external payable {}

    fallback() external payable {}
}
