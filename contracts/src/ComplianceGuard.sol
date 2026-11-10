// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

/**
 * 이상거래 대응 등록부 (지갑 동결 · 블랙리스트).
 *
 * 이상거래 탐지 솔루션이 위험도를 보고하면(report) 정책 점수 이상일 때 지갑을 자동으로 동결하거나 블랙리스트에 올린다.
 * 토큰 컨트랙트는 전송 전에 canTransfer(from, to)를 물어 동결·블랙리스트 지갑의 전송을 막는다.
 *
 * - 동결(freeze): 일시 조치. 운영자가 해제할 수 있다.
 * - 블랙리스트: 관리자만 해제할 수 있다.
 * - 탐지기(detector) 권한은 보고만 할 수 있고, 해제는 못 한다 (오탐 시 사람이 푼다).
 */
contract ComplianceGuard {
    address public owner;
    address public pendingOwner;
    mapping(address => bool) public operators;
    mapping(address => bool) public detectors;

    mapping(address => bool) public frozen;
    mapping(address => bool) public blacklisted;

    /// 이 점수 이상이면 자동 동결 (0이면 끔). 점수 범위 1~100
    uint8 public autoFreezeScore;
    /// 이 점수 이상이면 자동 블랙리스트 (0이면 끔)
    uint8 public autoBlacklistScore;

    event OwnershipTransferStarted(address indexed owner, address indexed pendingOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event OperatorSet(address indexed account, bool allowed);
    event DetectorSet(address indexed account, bool allowed);
    event PolicyUpdated(uint8 autoFreezeScore, uint8 autoBlacklistScore);
    event Frozen(address indexed account, address indexed by, bytes32 reason);
    event Unfrozen(address indexed account, address indexed by);
    event Blacklisted(address indexed account, address indexed by, bytes32 reason);
    event BlacklistRemoved(address indexed account, address indexed by);
    event RiskReported(address indexed account, uint8 score, bytes32 indexed reason, bytes32 txHash, address indexed detector);

    error NotOwner();
    error NotOperator();
    error NotDetector();
    error ZeroAddress();
    error InvalidScore();
    error ProtectedAccount();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyOperator() {
        if (msg.sender != owner && !operators[msg.sender]) revert NotOperator();
        _;
    }

    constructor(address initialOwner, uint8 freezeScore, uint8 blacklistScore) {
        if (initialOwner == address(0)) revert ZeroAddress();
        if (freezeScore > 100 || blacklistScore > 100) revert InvalidScore();
        owner = initialOwner;
        autoFreezeScore = freezeScore;
        autoBlacklistScore = blacklistScore;
        emit OwnershipTransferred(address(0), initialOwner);
        emit PolicyUpdated(freezeScore, blacklistScore);
    }

    /* ── 관리 ── */

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

    function setDetector(address account, bool allowed) external onlyOwner {
        if (account == address(0)) revert ZeroAddress();
        detectors[account] = allowed;
        emit DetectorSet(account, allowed);
    }

    function setPolicy(uint8 freezeScore, uint8 blacklistScore) external onlyOwner {
        if (freezeScore > 100 || blacklistScore > 100) revert InvalidScore();
        autoFreezeScore = freezeScore;
        autoBlacklistScore = blacklistScore;
        emit PolicyUpdated(freezeScore, blacklistScore);
    }

    /* ── 수동 조치 ── */

    function freeze(address account, bytes32 reason) external onlyOperator {
        _freeze(account, reason);
    }

    function unfreeze(address account) external onlyOperator {
        if (frozen[account]) {
            frozen[account] = false;
            emit Unfrozen(account, msg.sender);
        }
    }

    function addToBlacklist(address account, bytes32 reason) external onlyOperator {
        _blacklist(account, reason);
    }

    function removeFromBlacklist(address account) external onlyOwner {
        if (blacklisted[account]) {
            blacklisted[account] = false;
            emit BlacklistRemoved(account, msg.sender);
        }
    }

    /* ── 탐지 결과 보고와 자동 대응 ── */

    /// @param score  위험도 1~100
    /// @param reason 탐지 사유 코드 (예: keccak256("AMOUNT_SPIKE"))
    /// @param txHash 근거가 된 거래 해시 (없으면 0)
    /// @return didFreeze 이 보고로 동결됐다
    /// @return didBlacklist 이 보고로 블랙리스트에 올랐다
    function report(address account, uint8 score, bytes32 reason, bytes32 txHash) external returns (bool didFreeze, bool didBlacklist) {
        if (!detectors[msg.sender]) revert NotDetector();
        if (account == address(0)) revert ZeroAddress();
        if (score == 0 || score > 100) revert InvalidScore();
        emit RiskReported(account, score, reason, txHash, msg.sender);
        // 관리자·운영자 지갑은 자동 조치 대상에서 뺀다 (탐지기 키가 유출돼도 운영이 잠기지 않게)
        if (account == owner || operators[account]) return (false, false);
        if (autoFreezeScore != 0 && score >= autoFreezeScore && !frozen[account]) {
            _freeze(account, reason);
            didFreeze = true;
        }
        if (autoBlacklistScore != 0 && score >= autoBlacklistScore && !blacklisted[account]) {
            _blacklist(account, reason);
            didBlacklist = true;
        }
    }

    /* ── 토큰이 묻는 조회 ── */

    function isRestricted(address account) public view returns (bool) {
        return frozen[account] || blacklisted[account];
    }

    function canTransfer(address from, address to) external view returns (bool) {
        return !isRestricted(from) && !isRestricted(to);
    }

    function _freeze(address account, bytes32 reason) private {
        if (account == address(0)) revert ZeroAddress();
        if (account == owner) revert ProtectedAccount();
        if (!frozen[account]) {
            frozen[account] = true;
            emit Frozen(account, msg.sender, reason);
        }
    }

    function _blacklist(address account, bytes32 reason) private {
        if (account == address(0)) revert ZeroAddress();
        if (account == owner) revert ProtectedAccount();
        if (!blacklisted[account]) {
            blacklisted[account] = true;
            emit Blacklisted(account, msg.sender, reason);
        }
    }
}
