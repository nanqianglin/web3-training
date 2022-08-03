// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

// import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

// Import this file to use console.log
import "hardhat/console.sol";

contract Bank is ReentrancyGuard {
    // using ECDSA for bytes32;
    enum Status {
        NOTISSUED,
        ISSUED,
        REDEEMED,
        REVOKED
    }
    struct ChequeInfo {
        uint amount;
        bytes32 chequeId;
        uint32 validFrom;
        uint32 validThru;
        address payee;
        address payer;
        address contractAddress;
    }
    struct SignOverInfo {
        uint32 magicNum;
        uint8 counter;
        bytes32 chequeId;
        address oldPayee;
        address newPayee;
    }
    struct Cheque {
        ChequeInfo chequeInfo;
        bytes sig;
    }
    struct SignOver {
        SignOverInfo signOverInfo;
        bytes sig;
    }
    struct ChequeOwner {
        Status status;
        address owner;
    }
    // chequeId => ChequeOwner
    mapping(bytes32 => ChequeOwner) public chequeStatus;
    // user => balance
    mapping(address => uint256) public userBalances;
    // payee => amount
    mapping(address => uint) public pendingWithdraws;
    uint8 constant maxSignOver = 6;

    // constructor() payable {}

    modifier isChequeRedeemed(bytes32 _chequeId) {
        bool exits = false;
        if (chequeStatus[_chequeId].status == Status.REDEEMED) {
            exits = true;
        }
        require(exits == false, "Cheque id redeemed");
        _;
    }
    modifier isChequeRevoked(bytes32 _chequeId) {
        bool exits = false;
        if (chequeStatus[_chequeId].status == Status.REVOKED) {
            exits = true;
        }
        require(exits == false, "Cheque id revoked");
        _;
    }

    function issueECheque(bytes32 _chequeId) public {
        if (chequeStatus[_chequeId].status != Status.NOTISSUED) {
            revert("Cheque id exists");
        }

        chequeStatus[_chequeId].status = Status.ISSUED;
        chequeStatus[_chequeId].owner = msg.sender;
    }

    function deposit() external payable {
        require(msg.sender != address(0));
        require(msg.value > 0, "Deposit must be bigger than 0");
        userBalances[msg.sender] += msg.value;
    }

    function withdraw(uint256 _amount) external {
        address sender = msg.sender;
        require(sender != address(0));
        require(_amount > 0, "Withdraw must be bigger than 0");
        require(
            userBalances[sender] >= _amount,
            "Withdraw must be less than your balance"
        );
        userBalances[sender] -= _amount;
        (bool sent, ) = sender.call{value: _amount}("");
        require(sent, "Failed to send Ether");
    }

    // withdraw by payee
    function withdrawTo(uint256 _amount, address payable recipient) external {
        require(
            pendingWithdraws[recipient] >= _amount,
            "Failed to withdraw to recipient"
        );
        pendingWithdraws[recipient] -= _amount;

        (bool sent, ) = recipient.call{value: _amount}("");
        require(sent, "Failed to send Ether");
    }

    function redeem(Cheque memory chequeData)
        external
        isChequeRevoked(chequeData.chequeInfo.chequeId)
        isChequeRedeemed(chequeData.chequeInfo.chequeId)
        nonReentrant
    {
        address payee = chequeData.chequeInfo.payee;
        address payer = chequeData.chequeInfo.payer;
        bytes32 chequeId = chequeData.chequeInfo.chequeId;
        require(
            chequeStatus[chequeId].owner == payer,
            "Cheque has signed over"
        );
        require(isChequeValid(chequeData, new SignOver[](0)), "Invalid cheque");
        uint32 validFrom = chequeData.chequeInfo.validFrom;
        uint32 validThru = chequeData.chequeInfo.validThru;

        require(
            validFrom == 0 || validFrom <= block.number,
            "The cheque not start yet"
        );
        require(
            validThru == 0 || validThru > block.number,
            "The cheque expired"
        );

        uint amount = chequeData.chequeInfo.amount;
        require(userBalances[payer] >= amount, "Not enough money");

        userBalances[payer] -= amount;
        chequeStatus[chequeId].status = Status.REDEEMED;
        pendingWithdraws[payee] = amount;
    }

    function revoke(bytes32 chequeId)
        external
        isChequeRevoked(chequeId)
        isChequeRedeemed(chequeId)
    {
        require(
            msg.sender == chequeStatus[chequeId].owner,
            "No the owner of the cheque"
        );
        chequeStatus[chequeId].status = Status.REVOKED;
    }

    function notifySignOver(SignOver memory signOverData)
        external
        isChequeRevoked(signOverData.signOverInfo.chequeId)
    {
        require(validSignOverData(signOverData), "Invalid sign over signature");
        SignOverInfo memory signOverInfo = signOverData.signOverInfo;
        require(signOverInfo.counter <= maxSignOver, "Max sign over time is 6");
        bytes32 chequeId = signOverInfo.chequeId;

        chequeStatus[chequeId].owner = signOverInfo.oldPayee;
    }

    function redeemSignOver(
        Cheque memory chequeData,
        SignOver[] memory signOverData
    )
        external
        isChequeRevoked(chequeData.chequeInfo.chequeId)
        isChequeRedeemed(chequeData.chequeInfo.chequeId)
        nonReentrant
    {
        // address payee = chequeData.chequeInfo.payee;
        address payer = chequeData.chequeInfo.payer;
        bytes32 chequeId = chequeData.chequeInfo.chequeId;
        address lastOldPayee = signOverData[signOverData.length - 1]
            .signOverInfo
            .oldPayee;

        require(
            chequeStatus[chequeId].owner != payer,
            "Cheque has not signed over"
        );
        require(
            chequeStatus[chequeId].owner == lastOldPayee,
            "Cheque has signed over again"
        );
        require(
            isChequeValid(chequeData, signOverData),
            "Invalid sign over cheque"
        );
        uint32 validFrom = chequeData.chequeInfo.validFrom;
        uint32 validThru = chequeData.chequeInfo.validThru;

        require(
            validFrom == 0 || validFrom <= block.number,
            "The cheque not start yet"
        );
        require(
            validThru == 0 || validThru > block.number,
            "The cheque expired"
        );

        uint amount = chequeData.chequeInfo.amount;
        require(userBalances[payer] >= amount, "Not enough money");

        userBalances[payer] -= amount;
        chequeStatus[chequeId].status = Status.REDEEMED;
        // after sign over the cheque, pay to the last new payee
        address newPayee = signOverData[signOverData.length - 1]
            .signOverInfo
            .newPayee;
        pendingWithdraws[newPayee] = amount;
    }

    function getMessageHash(
        bytes32 _chequeId,
        address _payer,
        address _payee,
        uint256 _amount,
        uint32 _validFrom,
        uint32 _validThru,
        address _contractAddress
    ) public pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    _chequeId,
                    _payer,
                    _payee,
                    _amount,
                    _validFrom,
                    _validThru,
                    _contractAddress
                )
            );
    }

    function getEthSignedMessageHash(bytes32 _messageHash)
        public
        pure
        returns (bytes32)
    {
        return
            keccak256(
                abi.encodePacked(
                    "\x19Ethereum Signed Message:\n32",
                    _messageHash
                )
            );
    }

    function recoverSigner(
        bytes32 _ethSignedMessageHash,
        bytes memory _signature
    ) public pure returns (address) {
        (bytes32 r, bytes32 s, uint8 v) = splitSignature(_signature);

        return ecrecover(_ethSignedMessageHash, v, r, s);
    }

    function splitSignature(bytes memory sig)
        public
        pure
        returns (
            bytes32 r,
            bytes32 s,
            uint8 v
        )
    {
        require(sig.length == 65, "invalid signature length");

        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
    }

    function isChequeValid(
        Cheque memory chequeData,
        SignOver[] memory signOverData
    ) public pure returns (bool) {
        bytes32 messageHash = getMessageHash(
            chequeData.chequeInfo.chequeId,
            chequeData.chequeInfo.payer,
            chequeData.chequeInfo.payee,
            chequeData.chequeInfo.amount,
            chequeData.chequeInfo.validFrom,
            chequeData.chequeInfo.validThru,
            chequeData.chequeInfo.contractAddress
        );
        bytes32 ethSignedMessageHash = getEthSignedMessageHash(messageHash);

        bool isSignOverValid = isSignOversChequeValid(signOverData);

        return
            recoverSigner(ethSignedMessageHash, chequeData.sig) ==
            chequeData.chequeInfo.payer &&
            isSignOverValid;
    }

    function getSignOverMessageHash(
        uint32 magicNum,
        uint8 counter,
        bytes32 chequeId,
        address oldPayee,
        address newPayee
    ) public pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    magicNum,
                    counter,
                    chequeId,
                    oldPayee,
                    newPayee
                )
            );
    }

    function validSignOverData(SignOver memory signOverData)
        internal
        pure
        returns (bool)
    {
        SignOverInfo memory signOverInfo = signOverData.signOverInfo;
        bytes32 messageHash = getSignOverMessageHash(
            signOverInfo.magicNum,
            signOverInfo.counter,
            signOverInfo.chequeId,
            signOverInfo.oldPayee,
            signOverInfo.newPayee
        );

        bytes32 ethSignedMessageHash = getEthSignedMessageHash(messageHash);

        return
            recoverSigner(ethSignedMessageHash, signOverData.sig) ==
            signOverInfo.oldPayee;
    }

    function isSignOversChequeValid(SignOver[] memory signOverData)
        internal
        pure
        returns (bool)
    {
        bool isAllValid = true;
        uint len = signOverData.length;
        uint i = 0;

        for (i; i < len; i++) {
            bool isValid = validSignOverData(signOverData[i]);

            if (!isValid) {
                isAllValid = false;
            }
        }
        return isAllValid;
    }
}
