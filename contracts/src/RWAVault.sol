// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

interface ITransferGuard {
    function canTransfer(address from, address to) external view returns (bool);
}

/**
 * RWA 지분 토큰과 수익 분배.
 *
 * 실물자산 토큰(RWA NFT) 하나에 대한 지분을 ERC-20으로 나눠 발행한다. 발행인이 수익(payoutToken)을 넣으면
 * 그 시점의 지분 비율대로 쌓이고, 보유자는 언제든 자기 몫을 찾아간다. 지분을 넘겨도 넘기기 전에 쌓인 몫은 원래 보유자 것이다.
 *
 * - 지분 총량은 발행 때 정해지고 늘거나 줄지 않는다.
 * - guard(ComplianceGuard)가 설정돼 있으면 동결·블랙리스트 지갑은 지분을 주고받을 수 없다.
 *
 * API: POST /v1/rwa/distribute(distribute) · GET /v1/rwa/holders(holderInfo, Transfer 이벤트)
 */
contract RWAVault {
    /* ── ERC-20 ── */
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    /* ── 자산과 분배 ── */
    address public immutable issuer;
    address public immutable assetContract; // RWA NFT 컨트랙트
    uint256 public immutable assetTokenId;
    address public immutable payoutToken; // 수익을 지급하는 ERC-20
    ITransferGuard public guard;

    uint256 private constant MAGNITUDE = 2 ** 128;
    uint256 private _magnifiedPerShare;
    mapping(address => int256) private _corrections;
    mapping(address => uint256) public withdrawnOf;
    uint256 public totalDistributed;
    uint256 public distributionCount;
    uint256 private _lock = 1;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event GuardUpdated(address indexed guard);
    event Distributed(uint256 indexed round, address indexed from, uint256 amount);
    event Claimed(address indexed holder, uint256 amount);

    error NotIssuer();
    error ZeroAddress();
    error ZeroAmount();
    error AmountTooLarge();
    error InsufficientBalance();
    error InsufficientAllowance();
    error TransferRestricted();
    error NothingToClaim();
    error TokenTransferFailed();
    error Reentrancy();

    modifier nonReentrant() {
        if (_lock != 1) revert Reentrancy();
        _lock = 2;
        _;
        _lock = 1;
    }

    constructor(
        string memory name_,
        string memory symbol_,
        address assetContract_,
        uint256 assetTokenId_,
        uint256 totalShares,
        address issuer_,
        address payoutToken_,
        address guard_
    ) {
        if (issuer_ == address(0) || payoutToken_ == address(0) || assetContract_ == address(0)) revert ZeroAddress();
        if (totalShares == 0) revert ZeroAmount();
        if (totalShares > type(uint128).max) revert AmountTooLarge();
        name = name_;
        symbol = symbol_;
        assetContract = assetContract_;
        assetTokenId = assetTokenId_;
        issuer = issuer_;
        payoutToken = payoutToken_;
        guard = ITransferGuard(guard_);
        totalSupply = totalShares;
        balanceOf[issuer_] = totalShares;
        emit Transfer(address(0), issuer_, totalShares);
        emit GuardUpdated(guard_);
    }

    /* ── ERC-20 ── */

    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transfer(address to, uint256 value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            if (allowed < value) revert InsufficientAllowance();
            allowance[from][msg.sender] = allowed - value;
        }
        _transfer(from, to, value);
        return true;
    }

    function _transfer(address from, address to, uint256 value) private {
        if (to == address(0)) revert ZeroAddress();
        if (address(guard) != address(0) && !guard.canTransfer(from, to)) revert TransferRestricted();
        uint256 balance = balanceOf[from];
        if (balance < value) revert InsufficientBalance();
        balanceOf[from] = balance - value;
        balanceOf[to] += value;
        // 넘기기 전에 쌓인 수익은 원래 보유자 몫으로 남긴다
        int256 shift = int256(_magnifiedPerShare * value);
        _corrections[from] += shift;
        _corrections[to] -= shift;
        emit Transfer(from, to, value);
    }

    /* ── 수익 분배 ── */

    function setGuard(address guard_) external {
        if (msg.sender != issuer) revert NotIssuer();
        guard = ITransferGuard(guard_);
        emit GuardUpdated(guard_);
    }

    /// 호출 전에 payoutToken.approve(이 컨트랙트, amount)가 필요하다
    function distribute(uint256 amount) external nonReentrant {
        if (msg.sender != issuer) revert NotIssuer();
        if (amount == 0) revert ZeroAmount();
        if (amount > type(uint128).max) revert AmountTooLarge();
        _safeTransferFrom(payoutToken, msg.sender, address(this), amount);
        _magnifiedPerShare += (amount * MAGNITUDE) / totalSupply;
        totalDistributed += amount;
        emit Distributed(++distributionCount, msg.sender, amount);
    }

    function withdrawableOf(address holder) public view returns (uint256) {
        return _accumulativeOf(holder) - withdrawnOf[holder];
    }

    function claim() external nonReentrant returns (uint256 amount) {
        amount = withdrawableOf(msg.sender);
        if (amount == 0) revert NothingToClaim();
        withdrawnOf[msg.sender] += amount;
        _safeTransfer(payoutToken, msg.sender, amount);
        emit Claimed(msg.sender, amount);
    }

    /// shareBps: 지분율 (1만분율)
    function holderInfo(address holder) external view returns (uint256 shares, uint256 shareBps, uint256 withdrawable, uint256 withdrawn) {
        shares = balanceOf[holder];
        return (shares, (shares * 10_000) / totalSupply, withdrawableOf(holder), withdrawnOf[holder]);
    }

    function _accumulativeOf(address holder) private view returns (uint256) {
        return uint256(int256(_magnifiedPerShare * balanceOf[holder]) + _corrections[holder]) / MAGNITUDE;
    }

    function _safeTransfer(address token, address to, uint256 amount) private {
        (bool ok, bytes memory data) = token.call(abi.encodeWithSelector(0xa9059cbb, to, amount));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool))) || token.code.length == 0) revert TokenTransferFailed();
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) private {
        (bool ok, bytes memory data) = token.call(abi.encodeWithSelector(0x23b872dd, from, to, amount));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool))) || token.code.length == 0) revert TokenTransferFailed();
    }
}
