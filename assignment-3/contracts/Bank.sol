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
        REVOKED,
        EXPIRED
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
    struct Cheque {
        ChequeInfo chequeInfo;
        bytes sig;
    }
    // chequeId => status
    mapping(bytes32 => Status) public chequeStatus;
    // user => balance
    mapping(address => uint256) public userBalances;

    // constructor() payable {}

    modifier isChequeRedeemed(bytes32 _chequeId) {
        bool exits = false;
        if (chequeStatus[_chequeId] == Status.REDEEMED) {
            exits = true;
        }
        require(exits == false, "Cheque id redeemed");
        _;
    }
    modifier isChequeRevoked(bytes32 _chequeId) {
        bool exits = false;
        if (chequeStatus[_chequeId] == Status.REVOKED) {
            exits = true;
        }
        require(exits == false, "Cheque id revoked");
        _;
    }

    function issueECheque(bytes32 _chequeId) public {
        if (chequeStatus[_chequeId] != Status.NOTISSUED) {
            revert("Cheque id exists");
        }

        chequeStatus[_chequeId] = Status.ISSUED;
    }

    function deposit() public payable {
        require(msg.sender != address(0));
        require(msg.value > 0, "Deposit must be bigger than 0");
        userBalances[msg.sender] += msg.value;
    }

    function withdraw(uint256 _amount) public {
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

    function withdrawTo(uint256 amount, address payable recipient) external {}

    function redeem(Cheque memory chequeData)
        external
        isChequeRevoked(chequeData.chequeInfo.chequeId)
        isChequeRedeemed(chequeData.chequeInfo.chequeId)
        nonReentrant
    {
        address payable payee = payable(chequeData.chequeInfo.payee);
        require(isChequeValid(payee, chequeData), "Invalid cheque");
        address payer = chequeData.chequeInfo.payer;
        uint amount = chequeData.chequeInfo.amount;
        bytes32 chequeId = chequeData.chequeInfo.chequeId;
        require(userBalances[payer] >= amount, "Not enough money");

        userBalances[payer] -= amount;
        chequeStatus[chequeId] = Status.REDEEMED;
        (bool sent, ) = payee.call{value: amount}("");
        require(sent, "Failed to send Ether");
    }

    function revoke(bytes32 chequeId) external isChequeRedeemed(chequeId) {
        chequeStatus[chequeId] = Status.REVOKED;
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

    function isChequeValid(address payee, Cheque memory chequeData)
        public
        pure
        returns (
            // SignOver[] memory signOverData
            bool
        )
    {
        bytes32 messageHash = getMessageHash(
            chequeData.chequeInfo.chequeId,
            chequeData.chequeInfo.payer,
            payee,
            chequeData.chequeInfo.amount,
            chequeData.chequeInfo.validFrom,
            chequeData.chequeInfo.validThru,
            chequeData.chequeInfo.contractAddress
        );
        bytes32 ethSignedMessageHash = getEthSignedMessageHash(messageHash);

        return
            recoverSigner(ethSignedMessageHash, chequeData.sig) ==
            chequeData.chequeInfo.payer;
    }
}
