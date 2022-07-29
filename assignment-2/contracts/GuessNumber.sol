// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.7.0 <0.9.0;

import "hardhat/console.sol";

contract GuessNumber {
    bytes32 public nonceHash;
    bytes32 public nonceNumHash;
    uint256 public initDepositValue;
    uint256 constant guessUsers = 2;
    bool concluded;
    struct Guess {
        address payable user;
        uint16 num;
        bool guessed;
    }
    Guess[] userGuess;
    address payable[] playAddress;
    address public host;
    uint16[] winUserIndexes;
    address payable[] winAddresses;

    constructor(bytes32 _nonceHash, bytes32 _nonceNumHash) payable {
        host = msg.sender;
        nonceHash = _nonceHash;
        nonceNumHash = _nonceNumHash;
        initDepositValue = msg.value;
    }

    function guess(uint16 _num)
        external
        payable
        checkNumberRange(_num)
        onlyGuessOnce
        uniqueNumber(_num)
    {
        require(concluded == false, "the game has concluded");
        require(
            msg.value == initDepositValue,
            "donnot send the same value with the host"
        );

        userGuess.push(
            Guess({user: payable(msg.sender), num: _num, guessed: true})
        );
        playAddress.push(payable(msg.sender));
    }

    function reveal(bytes32 _nonce, uint16 _num) external {
        require(msg.sender == host, "only the host is allowed");
        require(
            userGuess.length == guessUsers,
            "require 2 paly gusse the number"
        );
        require(concluded == false, "the game has concluded");
        require(
            keccak256(abi.encode(_nonce)) == nonceHash,
            "the nonce is not equal with init nonce"
        );

        require(
            keccak256(abi.encode(_nonce, _num)) == nonceNumHash,
            "the number is not equal with init number"
        );

        address payable[] memory winnerAddresses = winningGame(_num);
        uint256 depositValue_ = address(this).balance / winnerAddresses.length;
        for (uint16 i = 0; i < winnerAddresses.length; i++) {
            console.log(depositValue_, winnerAddresses[i]);
            // winnerAddresses[i].transfer(depositValue_);
            transfer(winnerAddresses[i], depositValue_);
        }
        concluded = true;
    }

    function transfer(address payable _to, uint _amount) public {
        (bool success, ) = _to.call{value: _amount}("");
        require(success, "Failed to send Ether");
    }

    function winningGame(uint16 _num)
        public
        returns (address payable[] memory winUsers)
    {
        // out of the range of number
        if (_num < 0 || _num >= 1000) {
            // return all addresses
            return playAddress;
        } else {
            uint16 delta1 = userGuess[0].num > _num
                ? userGuess[0].num - _num
                : _num - userGuess[0].num;
            uint16 delta2 = userGuess[1].num > _num
                ? userGuess[1].num - _num
                : _num - userGuess[1].num;

            if (delta1 > delta2) {
                winAddresses.push(userGuess[1].user);
            } else if (delta1 == delta2) {
                winAddresses.push(userGuess[0].user);
                winAddresses.push(userGuess[1].user);
            } else {
                winAddresses.push(userGuess[0].user);
            }
            console.log(delta1, delta2);
            return winAddresses;

            // uint16[] memory deltas;
            // uint16 currentDelta = 0;

            // for (uint16 i = 0; i < userGuess.length; i++) {
            //     if (userGuess[i].num > _num) {
            //         deltas[i] = userGuess[i].num - _num;
            //     } else {
            //         deltas[i] = _num - userGuess[i].num;
            //     }
            //     if (deltas[i] > currentDelta) {
            //         currentDelta = deltas[i];
            //         delete winUserIndexes;
            //         winUserIndexes.push(i);
            //     } else if (deltas[i] == currentDelta) {
            //         winUserIndexes.push(i);
            //     }
            // }

            // return this.getWinnerAddresses();
        }
    }

    function getWinnerAddresses()
        external
        view
        returns (address payable[] memory winUsers)
    {
        for (uint16 i = 0; i < winUserIndexes.length; i++) {
            winUsers[i] = userGuess[winUserIndexes[i]].user;
        }
        return winUsers;
    }

    modifier onlyGuessOnce() {
        bool hasGuessed = false;
        for (uint8 i = 0; i < playAddress.length; i++) {
            if (playAddress[i] == msg.sender) {
                hasGuessed = true;
            }
        }
        require(hasGuessed == false, "only guess once");
        _;
    }
    modifier uniqueNumber(uint16 _num) {
        bool unique = false;
        for (uint8 i = 0; i < userGuess.length; i++) {
            if (userGuess[i].num == _num) {
                unique = true;
            }
        }
        require(unique == false, "the number has been guessed");
        _;
    }

    modifier checkNumberRange(uint16 _num) {
        bool inRange = true;
        if (_num < 0 || _num >= 1000) {
            inRange = false;
        }
        require(inRange == true, "the number is out of range");
        _;
    }
}
