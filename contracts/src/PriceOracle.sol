// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

/**
 * 오라클 가격 피드.
 *
 * 피드(예: "MST/KRW")마다 허가된 리포터가 가격을 라운드 단위로 올리고, 누구나 최신 가격과 과거 라운드를 읽는다.
 * 가격은 소수 자릿수(decimals)를 곱한 정수다. 마지막 갱신이 heartbeat(초)보다 오래되면 stale로 알린다.
 *
 * API: POST /v1/oracle/feeds(registerFeed) · POST /v1/oracle/prices(submit)
 *      GET /v1/oracle/prices(latestPrice) · GET /v1/oracle/prices/history(getRound)
 */
contract PriceOracle {
    struct Feed {
        string pair;
        uint8 decimals;
        uint32 heartbeat;
        uint80 latestRound;
        bool exists;
    }

    struct Round {
        int256 answer;
        uint64 observedAt; // 가격을 관측한 시각 (리포터가 제출)
        uint64 updatedAt; // 체인에 기록된 시각
        address reporter;
    }

    address public owner;
    address public pendingOwner;
    mapping(address => bool) public reporters;

    mapping(bytes32 => Feed) private _feeds;
    mapping(bytes32 => mapping(uint80 => Round)) private _rounds;
    bytes32[] private _feedIds;

    event OwnershipTransferStarted(address indexed owner, address indexed pendingOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event ReporterSet(address indexed reporter, bool allowed);
    event FeedRegistered(bytes32 indexed feedId, string pair, uint8 decimals, uint32 heartbeat);
    event HeartbeatUpdated(bytes32 indexed feedId, uint32 heartbeat);
    event PriceSubmitted(bytes32 indexed feedId, uint80 indexed roundId, int256 answer, uint64 observedAt, address indexed reporter);

    error NotOwner();
    error NotReporter();
    error FeedExists();
    error FeedNotFound();
    error InvalidPair();
    error InvalidHeartbeat();
    error InvalidAnswer();
    error InvalidObservation();
    error RoundNotFound();
    error ZeroAddress();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address initialOwner) {
        if (initialOwner == address(0)) revert ZeroAddress();
        owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
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

    function setReporter(address reporter, bool allowed) external onlyOwner {
        if (reporter == address(0)) revert ZeroAddress();
        reporters[reporter] = allowed;
        emit ReporterSet(reporter, allowed);
    }

    function registerFeed(string calldata pair, uint8 decimals_, uint32 heartbeat) external onlyOwner returns (bytes32 feedId) {
        uint256 length = bytes(pair).length;
        if (length == 0 || length > 32) revert InvalidPair();
        if (heartbeat == 0) revert InvalidHeartbeat();
        feedId = feedIdOf(pair);
        if (_feeds[feedId].exists) revert FeedExists();
        _feeds[feedId] = Feed({pair: pair, decimals: decimals_, heartbeat: heartbeat, latestRound: 0, exists: true});
        _feedIds.push(feedId);
        emit FeedRegistered(feedId, pair, decimals_, heartbeat);
    }

    function setHeartbeat(string calldata pair, uint32 heartbeat) external onlyOwner {
        if (heartbeat == 0) revert InvalidHeartbeat();
        bytes32 feedId = feedIdOf(pair);
        if (!_feeds[feedId].exists) revert FeedNotFound();
        _feeds[feedId].heartbeat = heartbeat;
        emit HeartbeatUpdated(feedId, heartbeat);
    }

    /* ── 가격 제출 ── */

    /// @param observedAt 관측 시각(초). 미래일 수 없고, 직전 라운드보다 뒤여야 한다 (오래된 값으로 덮어쓰기 방지)
    function submit(string calldata pair, int256 answer, uint64 observedAt) external returns (uint80 roundId) {
        if (!reporters[msg.sender]) revert NotReporter();
        bytes32 feedId = feedIdOf(pair);
        Feed storage feed = _feeds[feedId];
        if (!feed.exists) revert FeedNotFound();
        if (answer <= 0) revert InvalidAnswer();
        if (observedAt > block.timestamp) revert InvalidObservation();
        if (feed.latestRound != 0 && observedAt <= _rounds[feedId][feed.latestRound].observedAt) revert InvalidObservation();

        roundId = feed.latestRound + 1;
        feed.latestRound = roundId;
        _rounds[feedId][roundId] = Round({answer: answer, observedAt: observedAt, updatedAt: uint64(block.timestamp), reporter: msg.sender});
        emit PriceSubmitted(feedId, roundId, answer, observedAt, msg.sender);
    }

    /* ── 조회 ── */

    function feedIdOf(string calldata pair) public pure returns (bytes32) {
        return keccak256(bytes(pair));
    }

    function feedCount() external view returns (uint256) {
        return _feedIds.length;
    }

    function feedAt(uint256 index) external view returns (string memory pair, uint8 decimals_, uint32 heartbeat, uint80 latestRound) {
        Feed storage feed = _feeds[_feedIds[index]];
        return (feed.pair, feed.decimals, feed.heartbeat, feed.latestRound);
    }

    function getFeed(string calldata pair) external view returns (uint8 decimals_, uint32 heartbeat, uint80 latestRound) {
        Feed storage feed = _feeds[feedIdOf(pair)];
        if (!feed.exists) revert FeedNotFound();
        return (feed.decimals, feed.heartbeat, feed.latestRound);
    }

    /// stale: 마지막 기록이 heartbeat보다 오래됐다 (값을 그대로 쓰면 안 된다)
    function latestPrice(string calldata pair)
        external
        view
        returns (uint80 roundId, int256 answer, uint8 decimals_, uint64 observedAt, uint64 updatedAt, bool stale)
    {
        bytes32 feedId = feedIdOf(pair);
        Feed storage feed = _feeds[feedId];
        if (!feed.exists) revert FeedNotFound();
        roundId = feed.latestRound;
        if (roundId == 0) revert RoundNotFound();
        Round storage round = _rounds[feedId][roundId];
        return (roundId, round.answer, feed.decimals, round.observedAt, round.updatedAt, block.timestamp - round.updatedAt > feed.heartbeat);
    }

    function getRound(string calldata pair, uint80 roundId)
        external
        view
        returns (int256 answer, uint64 observedAt, uint64 updatedAt, address reporter)
    {
        bytes32 feedId = feedIdOf(pair);
        if (!_feeds[feedId].exists) revert FeedNotFound();
        Round storage round = _rounds[feedId][roundId];
        if (round.updatedAt == 0) revert RoundNotFound();
        return (round.answer, round.observedAt, round.updatedAt, round.reporter);
    }
}
