// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

interface IERC20Bridge {
    function balanceOf(address account) external view returns (uint256);
}

/**
 * 크로스체인 브릿지 게이트웨이 (잠금 → 릴레이어 서명 → 수령).
 *
 * 출발 체인에서 send()로 토큰을 이 컨트랙트에 잠그면, 릴레이어들이 도착 체인의 같은 컨트랙트에 대해 수령 메시지에 서명한다.
 * 받는 사람(또는 누구든)이 claim()에 정족수 이상의 서명을 내면 도착 체인의 토큰이 지급된다.
 * 도착 체인 처리가 불가능하면 릴레이어 정족수의 환불 서명으로만 refund()가 된다
 * (시간만 지나면 환불되는 방식은 도착 체인 수령과 겹쳐 이중 지급이 날 수 있어 쓰지 않는다).
 *
 * - 서명은 체인 ID와 컨트랙트 주소에 묶여 있어 다른 체인·다른 게이트웨이에서 재사용할 수 없다.
 * - 같은 (출발 체인, 전송 ID)는 한 번만 수령된다.
 * - 관리자는 수수료만 인출할 수 있고, 잠긴 사용자 자산에는 손댈 수 없다.
 *
 * API: POST /v1/bridge/transfers(send) · GET /v1/bridge/transfers/status(getTransfer·isClaimed)
 *      GET /v1/bridge/routes(getRoute) · POST /v1/bridge/claim(claim) · POST /v1/bridge/refund(refund)
 */
contract BridgeGateway {
    enum Status {
        None,
        Pending,
        Refunded
    }

    struct Route {
        bool enabled;
        uint16 feeBps;
        uint256 minAmount;
        uint256 maxAmount;
    }

    struct Outbound {
        address sender;
        address token;
        uint256 amount; // 수수료를 뺀 전송 금액
        uint256 fee;
        uint256 dstChainId;
        address recipient;
        uint64 createdAt;
        Status status;
    }

    uint16 public constant MAX_FEE_BPS = 1000; // 10%
    bytes32 private constant CLAIM_TYPEHASH = keccak256("MustsemBridgeClaim");
    bytes32 private constant REFUND_TYPEHASH = keccak256("MustsemBridgeRefund");
    // secp256k1 차수의 절반: s가 이보다 크면 같은 서명의 변형이므로 거절한다
    uint256 private constant HALF_N = 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0;

    address public owner;
    address public pendingOwner;
    bool public paused;

    mapping(address => bool) public relayers;
    uint256 public relayerCount;
    uint256 public threshold;

    mapping(uint256 => mapping(address => Route)) private _routes; // 도착 체인 → 토큰
    mapping(bytes32 => Outbound) private _outbound;
    mapping(uint256 => mapping(bytes32 => bool)) private _claimed; // 출발 체인 → 전송 ID
    mapping(address => uint256) public accruedFees;
    uint256 public nonce;
    uint256 private _lock = 1;

    event OwnershipTransferStarted(address indexed owner, address indexed pendingOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event Paused(bool paused);
    event RelayerSet(address indexed relayer, bool allowed);
    event ThresholdUpdated(uint256 threshold);
    event RouteUpdated(uint256 indexed dstChainId, address indexed token, bool enabled, uint16 feeBps, uint256 minAmount, uint256 maxAmount);
    event TransferRequested(
        bytes32 indexed transferId,
        address indexed sender,
        address indexed token,
        uint256 amount,
        uint256 fee,
        uint256 dstChainId,
        address recipient
    );
    event TransferClaimed(uint256 indexed srcChainId, bytes32 indexed transferId, address indexed token, address recipient, uint256 amount);
    event TransferRefunded(bytes32 indexed transferId, address indexed sender, uint256 amount);
    event FeesWithdrawn(address indexed token, address indexed to, uint256 amount);

    error NotOwner();
    error IsPaused();
    error Reentrancy();
    error ZeroAddress();
    error InvalidThreshold();
    error InvalidFee();
    error InvalidRange();
    error RouteDisabled();
    error AmountOutOfRange();
    error UnsupportedToken();
    error TransferNotPending();
    error AlreadyClaimed();
    error InvalidSignature();
    error NotEnoughSignatures();
    error TokenTransferFailed();
    error NothingToWithdraw();

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

    constructor(address initialOwner, address[] memory initialRelayers, uint256 initialThreshold) {
        if (initialOwner == address(0)) revert ZeroAddress();
        owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
        for (uint256 i = 0; i < initialRelayers.length; i++) {
            address relayer = initialRelayers[i];
            if (relayer == address(0)) revert ZeroAddress();
            if (!relayers[relayer]) {
                relayers[relayer] = true;
                relayerCount++;
                emit RelayerSet(relayer, true);
            }
        }
        if (initialThreshold == 0 || initialThreshold > relayerCount) revert InvalidThreshold();
        threshold = initialThreshold;
        emit ThresholdUpdated(initialThreshold);
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

    function setPaused(bool value) external onlyOwner {
        paused = value;
        emit Paused(value);
    }

    function setRelayer(address relayer, bool allowed) external onlyOwner {
        if (relayer == address(0)) revert ZeroAddress();
        if (relayers[relayer] == allowed) return;
        if (!allowed && relayerCount - 1 < threshold) revert InvalidThreshold();
        relayers[relayer] = allowed;
        relayerCount = allowed ? relayerCount + 1 : relayerCount - 1;
        emit RelayerSet(relayer, allowed);
    }

    function setThreshold(uint256 value) external onlyOwner {
        if (value == 0 || value > relayerCount) revert InvalidThreshold();
        threshold = value;
        emit ThresholdUpdated(value);
    }

    function setRoute(uint256 dstChainId, address token, bool enabled, uint16 feeBps, uint256 minAmount, uint256 maxAmount) external onlyOwner {
        if (token == address(0)) revert ZeroAddress();
        if (dstChainId == block.chainid) revert RouteDisabled();
        if (feeBps > MAX_FEE_BPS) revert InvalidFee();
        if (minAmount == 0 || maxAmount < minAmount) revert InvalidRange();
        _routes[dstChainId][token] = Route({enabled: enabled, feeBps: feeBps, minAmount: minAmount, maxAmount: maxAmount});
        emit RouteUpdated(dstChainId, token, enabled, feeBps, minAmount, maxAmount);
    }

    function withdrawFees(address token, address to) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        uint256 amount = accruedFees[token];
        if (amount == 0) revert NothingToWithdraw();
        accruedFees[token] = 0;
        _safeTransfer(token, to, amount);
        emit FeesWithdrawn(token, to, amount);
    }

    /* ── 출발 체인: 전송 요청 ── */

    /// 호출 전에 token.approve(이 컨트랙트, amount)가 필요하다
    function send(address token, uint256 amount, uint256 dstChainId, address recipient) external nonReentrant returns (bytes32 transferId) {
        if (paused) revert IsPaused();
        if (recipient == address(0)) revert ZeroAddress();
        Route memory route = _routes[dstChainId][token];
        if (!route.enabled) revert RouteDisabled();
        if (amount < route.minAmount || amount > route.maxAmount) revert AmountOutOfRange();

        // 전송 시 수수료를 떼는 토큰은 잠긴 수량이 어긋나므로 받지 않는다
        uint256 before = IERC20Bridge(token).balanceOf(address(this));
        _safeTransferFrom(token, msg.sender, address(this), amount);
        if (IERC20Bridge(token).balanceOf(address(this)) - before != amount) revert UnsupportedToken();

        uint256 fee = (amount * route.feeBps) / 10_000;
        accruedFees[token] += fee;
        transferId = keccak256(abi.encode(block.chainid, address(this), ++nonce));
        _outbound[transferId] = Outbound({
            sender: msg.sender,
            token: token,
            amount: amount - fee,
            fee: fee,
            dstChainId: dstChainId,
            recipient: recipient,
            createdAt: uint64(block.timestamp),
            status: Status.Pending
        });
        emit TransferRequested(transferId, msg.sender, token, amount - fee, fee, dstChainId, recipient);
    }

    /// 도착 체인에서 처리할 수 없을 때: 릴레이어 정족수의 환불 서명으로 보낸 사람에게 전액(수수료 포함) 돌려준다
    function refund(bytes32 transferId, bytes[] calldata signatures) external nonReentrant {
        Outbound storage transfer_ = _outbound[transferId];
        if (transfer_.status != Status.Pending) revert TransferNotPending();
        _verify(refundDigest(transferId), signatures);
        transfer_.status = Status.Refunded;
        accruedFees[transfer_.token] -= transfer_.fee;
        uint256 total = transfer_.amount + transfer_.fee;
        _safeTransfer(transfer_.token, transfer_.sender, total);
        emit TransferRefunded(transferId, transfer_.sender, total);
    }

    /* ── 도착 체인: 수령 ── */

    /// @param token 이 체인(도착 체인)에서 지급할 토큰 주소
    function claim(
        uint256 srcChainId,
        bytes32 transferId,
        address token,
        address recipient,
        uint256 amount,
        bytes[] calldata signatures
    ) external nonReentrant {
        if (paused) revert IsPaused();
        if (recipient == address(0) || token == address(0)) revert ZeroAddress();
        if (_claimed[srcChainId][transferId]) revert AlreadyClaimed();
        _verify(claimDigest(srcChainId, transferId, token, recipient, amount), signatures);
        _claimed[srcChainId][transferId] = true;
        _safeTransfer(token, recipient, amount);
        emit TransferClaimed(srcChainId, transferId, token, recipient, amount);
    }

    /* ── 조회 ── */

    function getRoute(uint256 dstChainId, address token) external view returns (bool enabled, uint16 feeBps, uint256 minAmount, uint256 maxAmount) {
        Route memory route = _routes[dstChainId][token];
        return (route.enabled, route.feeBps, route.minAmount, route.maxAmount);
    }

    function getTransfer(bytes32 transferId)
        external
        view
        returns (
            address sender,
            address token,
            uint256 amount,
            uint256 fee,
            uint256 dstChainId,
            address recipient,
            uint64 createdAt,
            Status status
        )
    {
        Outbound memory t = _outbound[transferId];
        return (t.sender, t.token, t.amount, t.fee, t.dstChainId, t.recipient, t.createdAt, t.status);
    }

    function isClaimed(uint256 srcChainId, bytes32 transferId) external view returns (bool) {
        return _claimed[srcChainId][transferId];
    }

    /// 릴레이어가 서명할 수령 메시지 (personal_sign 형식의 32바이트 해시)
    function claimDigest(uint256 srcChainId, bytes32 transferId, address token, address recipient, uint256 amount) public view returns (bytes32) {
        return _toSignedHash(keccak256(abi.encode(CLAIM_TYPEHASH, block.chainid, address(this), srcChainId, transferId, token, recipient, amount)));
    }

    /// 릴레이어가 서명할 환불 메시지
    function refundDigest(bytes32 transferId) public view returns (bytes32) {
        return _toSignedHash(keccak256(abi.encode(REFUND_TYPEHASH, block.chainid, address(this), transferId)));
    }

    /* ── 내부 ── */

    function _toSignedHash(bytes32 hash) private pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
    }

    /// 서명자는 주소 오름차순으로 내야 한다 (같은 릴레이어의 서명을 두 번 세지 않기 위해)
    function _verify(bytes32 digest, bytes[] calldata signatures) private view {
        if (signatures.length < threshold) revert NotEnoughSignatures();
        address last = address(0);
        for (uint256 i = 0; i < signatures.length; i++) {
            address signer = _recover(digest, signatures[i]);
            if (signer <= last || !relayers[signer]) revert InvalidSignature();
            last = signer;
        }
    }

    function _recover(bytes32 digest, bytes calldata signature) private pure returns (address) {
        if (signature.length != 65) revert InvalidSignature();
        bytes32 r = bytes32(signature[0:32]);
        bytes32 s = bytes32(signature[32:64]);
        uint8 v = uint8(signature[64]);
        if (uint256(s) > HALF_N || (v != 27 && v != 28)) revert InvalidSignature();
        address signer = ecrecover(digest, v, r, s);
        if (signer == address(0)) revert InvalidSignature();
        return signer;
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
