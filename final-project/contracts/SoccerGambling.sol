// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

// import "hardhat/console.sol";

contract SoccerGambling {
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
    event PunishGambleOwner(uint256 indexed id, address indexed owner);
    event FinishGamble(
        address indexed user,
        uint256 indexed id,
        uint256 finishTime
    );
    event WithdrawTo(
        uint256 amount,
        address indexed recipient,
        address indexed executor
    );

    // the quorum info
    address[] public approvers;
    mapping(address => bool) public isApprover;
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

    // id => GambleOption => user address[]
    mapping(uint256 => mapping(GambleOption => address[])) public userGambles;
    // id => GambleOption => user input amount[]
    mapping(uint256 => mapping(GambleOption => uint256[]))
        public userGambleAmount;
    mapping(uint256 => GambleOption) public correctAnswers;
    // id => approver => bool
    mapping(uint256 => mapping(address => bool)) public isApprovedOrRejected;

    // cro amount for users
    mapping(address => uint256) public userBalances;

    Gamble[] public gambleList;

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

    constructor(address[] memory _approvers, uint256 _quorum) {
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
        require(
            msg.value > 100 ether,
            "Must put more than 100 cro as the prizes value"
        );

        uint256 id = gambleList.length;
        gambleList.push(
            Gamble({
                id: id,
                gambleInfo: GambleInfo({
                    title: title,
                    description: description,
                    owner: msg.sender,
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
            })
        );

        emit CreateGamble(msg.sender, id, title, msg.value);

        // supply cro to earn tonic
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

    // punish the gamble owner
    function punishDishonestOwner(uint256 id)
        external
        gambleExists(id)
        notFinished(id)
    {
        Gamble storage gamble = gambleList[id];
        require(
            gamble.gambleStatus.rejecters >= rejectQuorum,
            "Cannot execute punish"
        );

        GambleOption _correctAnswers = correctAnswers[id];
        address[] memory winners = getWinners(id, _correctAnswers);
        uint256 amountForGambleOwner = gamble.gambleStatus.totalAmount;
        uint256 rate = _correctAnswers == GambleOption.A
            ? gamble.gambleInfo.rate.rateA
            : gamble.gambleInfo.rate.rateB;

        for (uint256 i = 0; i < winners.length; i++) {
            uint256 amount = userGambleAmount[id][_correctAnswers][i];
            amountForGambleOwner -= amount * rate;
            allocateReward(winners[i], amount * rate + amount);
        }

        // give the money to the other users
        if (amountForGambleOwner > 0) {
            address[] memory otherUsers = getFailures(id, _correctAnswers);
            uint256 _len = otherUsers.length;

            for (uint256 j = 0; j < _len; j++) {
                uint256 othersAmount = userGambleAmount[id][
                    _correctAnswers == GambleOption.A
                        ? GambleOption.B
                        : GambleOption.A
                ][j];

                amountForGambleOwner -= othersAmount;
                allocateReward(otherUsers[j], othersAmount);
            }
        }
        // give the money to the owner
        if (amountForGambleOwner > 0) {
            allocateReward(gamble.gambleInfo.owner, amountForGambleOwner);
        }

        gamble.gambleStatus.isFinished = true;

        emit PunishGambleOwner(id, gamble.gambleInfo.owner);
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
            gamble.gambleStatus.approvers >= quorum,
            "Not enough approvers"
        );

        GambleOption _correctAnswers = correctAnswers[id];
        address[] memory winners = getWinners(id, _correctAnswers);
        uint256 amountForGambleOwner = gamble.gambleStatus.totalAmount;
        uint256 rate = _correctAnswers == GambleOption.A
            ? gamble.gambleInfo.rate.rateA
            : gamble.gambleInfo.rate.rateB;

        // give money to the winners
        for (uint256 i = 0; i < winners.length; i++) {
            uint256 amount = userGambleAmount[id][_correctAnswers][i];
            amountForGambleOwner -= amount * rate;
            allocateReward(winners[i], amount * rate + amount);
        }

        // give the money of failures to the owner
        uint256[] memory failureMounts = userGambleAmount[id][
            _correctAnswers == GambleOption.A ? GambleOption.B : GambleOption.A
        ];
        for (uint256 j = 0; j < failureMounts.length; j++) {
            amountForGambleOwner += failureMounts[j];
        }
        if (amountForGambleOwner > 0) {
            allocateReward(gamble.gambleInfo.owner, amountForGambleOwner);
        }

        gamble.gambleStatus.isFinished = true;

        emit FinishGamble(msg.sender, id, block.timestamp);
        // withdraw the supplied cro, and get tonic
    }

    function getWinners(uint256 id, GambleOption correctOption)
        public
        view
        returns (address[] memory)
    {
        return userGambles[id][correctOption];
    }

    function getFailures(uint256 id, GambleOption correctOption)
        public
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
        external
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

    function getGambleList() external view returns (Gamble[] memory) {
        return gambleList;
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

        emit WithdrawTo(_amount, recipient, msg.sender);
    }

    receive() external payable {}

    fallback() external payable {}
}
