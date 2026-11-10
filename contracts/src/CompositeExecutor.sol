// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

/**
 * 복합 컨트랙트 실행기 (여러 컨트랙트 호출을 한 트랜잭션으로).
 *
 * 예: "NFT 발행 → SBT 발급 → 수수료 정책 등록"을 한 번에 실행하고, 하나라도 실패하면 전부 되돌린다(atomic).
 * atomic이 아니면 실패한 호출만 건너뛰고 결과를 각각 돌려준다.
 *
 * - 운영자(operator)만 실행할 수 있고, 관리자가 허용한 대상 컨트랙트만 호출한다.
 * - 이 컨트랙트는 자산을 보관하지 않는다 (보낸 코인은 호출에 모두 쓰여야 한다).
 * - simulate()는 실행 결과를 담아 항상 되돌린다. eth_call로 불러 실행 전에 결과를 확인하는 용도다.
 *
 * API: POST /v1/composite/execute(execute) · POST /v1/composite/simulate(simulate)
 */
contract CompositeExecutor {
    struct Call {
        address target;
        uint256 value;
        bytes data;
    }

    struct Result {
        bool success;
        bytes returnData;
    }

    uint256 public constant MAX_CALLS = 32;

    address public owner;
    address public pendingOwner;
    mapping(address => bool) public operators;
    mapping(address => bool) public allowedTargets;
    uint256 public batchCount;
    uint256 private _lock = 1;

    event OwnershipTransferStarted(address indexed owner, address indexed pendingOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event OperatorSet(address indexed account, bool allowed);
    event TargetSet(address indexed target, bool allowed);
    event BatchExecuted(uint256 indexed batchId, address indexed operator, uint256 calls, uint256 succeeded, bool atomic);

    error NotOwner();
    error NotOperator();
    error ZeroAddress();
    error Reentrancy();
    error EmptyBatch();
    error TooManyCalls();
    error TargetNotAllowed(uint256 index, address target);
    error ValueMismatch();
    error CallFailed(uint256 index, bytes returnData);
    error Simulation(Result[] results);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyOperator() {
        if (!operators[msg.sender]) revert NotOperator();
        _;
    }

    modifier nonReentrant() {
        if (_lock != 1) revert Reentrancy();
        _lock = 2;
        _;
        _lock = 1;
    }

    constructor(address initialOwner) {
        if (initialOwner == address(0)) revert ZeroAddress();
        owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NotOwner();
        emit OwnershipTransferred(owner, msg.sender);
        owner = msg.sender;
        pendingOwner = address(0);
    }

    function setOperator(address account, bool allowed) external onlyOwner {
        if (account == address(0)) revert ZeroAddress();
        operators[account] = allowed;
        emit OperatorSet(account, allowed);
    }

    function setTarget(address target, bool allowed) external onlyOwner {
        // 자기 자신을 대상으로 두면 권한 설정 함수를 우회 호출할 수 있다
        if (target == address(0) || target == address(this)) revert ZeroAddress();
        allowedTargets[target] = allowed;
        emit TargetSet(target, allowed);
    }

    /// @param atomic true면 하나라도 실패할 때 전부 되돌린다
    function execute(Call[] calldata calls, bool atomic) external payable onlyOperator nonReentrant returns (Result[] memory results) {
        uint256 succeeded;
        (results, succeeded) = _run(calls, atomic);
        emit BatchExecuted(++batchCount, msg.sender, calls.length, succeeded, atomic);
    }

    /// eth_call 전용: 실행 결과를 Simulation 오류에 담아 항상 되돌린다 (상태가 남지 않는다)
    function simulate(Call[] calldata calls) external payable onlyOperator nonReentrant {
        (Result[] memory results, ) = _run(calls, false);
        revert Simulation(results);
    }

    function _run(Call[] calldata calls, bool atomic) private returns (Result[] memory results, uint256 succeeded) {
        uint256 count = calls.length;
        if (count == 0) revert EmptyBatch();
        if (count > MAX_CALLS) revert TooManyCalls();
        results = new Result[](count);
        uint256 spent;
        for (uint256 i = 0; i < count; i++) {
            Call calldata call_ = calls[i];
            if (!allowedTargets[call_.target]) revert TargetNotAllowed(i, call_.target);
            spent += call_.value;
            if (spent > msg.value) revert ValueMismatch();
            (bool ok, bytes memory returnData) = call_.target.call{value: call_.value}(call_.data);
            if (!ok && atomic) revert CallFailed(i, returnData);
            if (ok) succeeded++;
            else spent -= call_.value; // 실패한 호출의 코인은 쓰이지 않았다
            results[i] = Result({success: ok, returnData: returnData});
        }
        // 쓰이지 않은 코인은 보낸 사람에게 돌려준다 (이 컨트랙트에 남기지 않는다)
        uint256 leftover = msg.value - spent;
        if (leftover != 0) {
            (bool refunded, ) = msg.sender.call{value: leftover}("");
            if (!refunded) revert ValueMismatch();
        }
    }
}
