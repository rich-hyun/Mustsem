// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

/// 테스트 전용 ERC-20 (누구나 발행 가능). 운영에 배포하지 않는다.
contract TestToken {
    string public name = "Test Token";
    string public symbol = "TEST";
    uint8 public constant decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function mint(address to, uint256 value) external {
        totalSupply += value;
        balanceOf[to] += value;
        emit Transfer(address(0), to, value);
    }

    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transfer(address to, uint256 value) external returns (bool) {
        _move(msg.sender, to, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        allowance[from][msg.sender] -= value;
        _move(from, to, value);
        return true;
    }

    function _move(address from, address to, uint256 value) private {
        balanceOf[from] -= value;
        balanceOf[to] += value;
        emit Transfer(from, to, value);
    }
}

/// 테스트 전용: 복합 실행 대상 (값 저장, 실패 유도)
contract TestTarget {
    uint256 public value;
    uint256 public received;

    function set(uint256 next) external payable returns (uint256) {
        value = next;
        received += msg.value;
        return next * 2;
    }

    function fail() external pure {
        revert("target failed");
    }
}
