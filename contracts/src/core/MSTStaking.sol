// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

interface IERC20Staking {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

/**
 * wMST 스테이킹. wMST를 예치하면 연 이율(단리)로 MST 코인 보상이 쌓인다.
 *
 * - 원금(wMST)은 이 컨트랙트가 토큰으로 보관하고, 보상(MST 코인)은 관리자가 넣어 둔 보상 재원에서 나간다.
 *   둘은 섞이지 않는다. 보상 재원이 모자라도 원금은 언제나 뺄 수 있다.
 * - 보상은 마지막 수령 뒤 minClaimInterval이 지나야 다시 받을 수 있다 (첫 수령은 바로 가능).
 * - 이율과 수령 간격은 배포 때 정해지고 바뀌지 않는다. 관리자가 할 수 있는 일은 보상 재원을 넣고 빼는 것뿐이다.
 *   재원을 뺄 때도 이미 쌓인 보상(totalAccrued)만큼은 남겨야 한다.
 */
contract MSTStaking {
    struct Stake {
        uint256 amount;
        uint256 accrued; // 정산된 미수령 보상
        uint256 lastUpdate;
        uint256 lastClaimTime;
    }

    uint256 private constant YEAR = 365 days;
    uint256 private constant BPS = 10_000;

    IERC20Staking public immutable stakingToken;
    uint256 public immutable aprBps;
    uint256 public immutable minClaimInterval;

    address public owner;
    address public pendingOwner;
    /// 사이트 ABI: stakes(user) → (amount, accrued, lastUpdate, lastClaimTime)
    mapping(address => Stake) public stakes;
    uint256 public totalStaked;
    /// 정산을 마친 미수령 보상의 합 (재원 인출 한도 계산용. 정산 전 경과분은 포함하지 않는다)
    uint256 public totalAccrued;
    uint256 private _lock = 1;

    event OwnershipTransferStarted(address indexed owner, address indexed pendingOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);
    event RewardPoolFunded(address indexed from, uint256 amount);
    event RewardPoolWithdrawn(address indexed to, uint256 amount);

    error NotOwner();
    error ZeroAddress();
    error ZeroAmount();
    error InvalidApr();
    error InsufficientStake();
    error ClaimTooEarly(uint256 availableAt);
    error NothingToClaim();
    error RewardPoolInsufficient();
    error TokenTransferFailed();
    error NativeTransferFailed();
    error Reentrancy();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier nonReentrant() {
        if (_lock != 1) revert Reentrancy();
        _lock = 2;
        _;
        _lock = 1;
    }

    constructor(address initialOwner, address stakingToken_, uint256 aprBps_, uint256 minClaimInterval_) {
        if (initialOwner == address(0) || stakingToken_ == address(0)) revert ZeroAddress();
        if (aprBps_ == 0 || aprBps_ > BPS) revert InvalidApr();
        owner = initialOwner;
        stakingToken = IERC20Staking(stakingToken_);
        aprBps = aprBps_;
        minClaimInterval = minClaimInterval_;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    /* ── 보상 재원 ── */

    receive() external payable {
        emit RewardPoolFunded(msg.sender, msg.value);
    }

    function withdrawRewardPool(address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (address(this).balance < totalAccrued + amount) revert RewardPoolInsufficient();
        emit RewardPoolWithdrawn(to, amount);
        _sendNative(to, amount);
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

    /* ── 예치·인출 ── */

    /// 호출 전에 wMST.approve(이 컨트랙트, amount)가 필요하다
    function stake(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        _settle(msg.sender);
        stakes[msg.sender].amount += amount;
        totalStaked += amount;
        if (!stakingToken.transferFrom(msg.sender, address(this), amount)) revert TokenTransferFailed();
        emit Staked(msg.sender, amount);
    }

    function withdraw(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        _withdraw(msg.sender, amount);
    }

    /// 원금을 모두 빼고, 받을 수 있는 보상이 있으면 함께 받는다.
    /// 수령 간격이 안 됐거나 보상 재원이 모자라면 원금만 돌려주고 보상은 나중에 claim()으로 받는다.
    function exit() external nonReentrant {
        uint256 amount = stakes[msg.sender].amount;
        if (amount != 0) _withdraw(msg.sender, amount);
        else _settle(msg.sender);
        Stake storage position = stakes[msg.sender];
        uint256 reward = position.accrued;
        bool intervalOk = position.lastClaimTime == 0 || block.timestamp >= position.lastClaimTime + minClaimInterval;
        if (reward != 0 && intervalOk && address(this).balance >= reward) _pay(msg.sender, reward);
    }

    /* ── 보상 ── */

    function pendingReward(address user) public view returns (uint256) {
        Stake storage position = stakes[user];
        return position.accrued + _earned(position);
    }

    function claim() external nonReentrant {
        _settle(msg.sender);
        Stake storage position = stakes[msg.sender];
        if (position.lastClaimTime != 0) {
            uint256 availableAt = position.lastClaimTime + minClaimInterval;
            if (block.timestamp < availableAt) revert ClaimTooEarly(availableAt);
        }
        uint256 reward = position.accrued;
        if (reward == 0) revert NothingToClaim();
        if (address(this).balance < reward) revert RewardPoolInsufficient();
        _pay(msg.sender, reward);
    }

    /* ── 내부 ── */

    function _earned(Stake storage position) private view returns (uint256) {
        if (position.amount == 0) return 0;
        return (position.amount * aprBps * (block.timestamp - position.lastUpdate)) / (BPS * YEAR);
    }

    function _settle(address user) private {
        Stake storage position = stakes[user];
        uint256 earned = _earned(position);
        if (earned != 0) {
            position.accrued += earned;
            totalAccrued += earned;
        }
        position.lastUpdate = block.timestamp;
    }

    function _withdraw(address user, uint256 amount) private {
        _settle(user);
        Stake storage position = stakes[user];
        if (position.amount < amount) revert InsufficientStake();
        position.amount -= amount;
        totalStaked -= amount;
        if (!stakingToken.transfer(user, amount)) revert TokenTransferFailed();
        emit Withdrawn(user, amount);
    }

    function _pay(address user, uint256 reward) private {
        Stake storage position = stakes[user];
        position.accrued = 0;
        position.lastClaimTime = block.timestamp;
        totalAccrued -= reward;
        emit RewardPaid(user, reward);
        _sendNative(user, reward);
    }

    function _sendNative(address to, uint256 amount) private {
        (bool ok, ) = to.call{value: amount}("");
        if (!ok) revert NativeTransferFailed();
    }
}
