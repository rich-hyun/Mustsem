// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

/**
 * DID 신원 등록부와 자격증명(VC) 앵커.
 *
 * - DID는 문자열(did:mst:...)의 keccak256 값으로 다룬다. 등록한 지갑이 컨트롤러가 되고, DID 문서는 주소(URI·CID)만 올린다.
 * - 자격증명은 원문이 아니라 해시만 올린다(개인정보는 체인에 두지 않는다). 발급·폐기는 발급자 DID의 컨트롤러만 한다.
 * - 검증: 발급 기록이 있고, 폐기되지 않았고, 만료 전이고, 발급자 DID가 활성이어야 유효하다.
 *
 * API: POST /v1/did/register(register) · GET /v1/did/resolve(resolve)
 *      POST /v1/did/credentials/issue(issueCredential) · GET /v1/did/credentials/verify(verifyCredential)
 *      POST /v1/did/credentials/revoke(revokeCredential)
 */
contract DIDRegistry {
    struct Identity {
        address controller;
        uint64 createdAt;
        uint64 updatedAt;
        bool active;
        string documentURI;
    }

    struct Credential {
        bytes32 issuer;
        bytes32 subject;
        uint64 issuedAt;
        uint64 expiresAt; // 0이면 만료 없음
        bool revoked;
    }

    mapping(bytes32 => Identity) private _identities;
    mapping(bytes32 => Credential) private _credentials;

    event DIDRegistered(bytes32 indexed did, address indexed controller, string documentURI);
    event DIDDocumentUpdated(bytes32 indexed did, string documentURI);
    event DIDControllerChanged(bytes32 indexed did, address indexed previousController, address indexed newController);
    event DIDDeactivated(bytes32 indexed did);
    event CredentialIssued(bytes32 indexed credentialHash, bytes32 indexed issuer, bytes32 indexed subject, uint64 expiresAt);
    event CredentialRevoked(bytes32 indexed credentialHash, bytes32 indexed issuer);

    error DIDExists();
    error DIDNotFound();
    error DIDInactive();
    error NotController();
    error InvalidDocument();
    error ZeroAddress();
    error ZeroHash();
    error CredentialExists();
    error CredentialNotFound();
    error AlreadyRevoked();
    error InvalidExpiry();

    modifier onlyController(bytes32 did) {
        Identity storage identity = _identities[did];
        if (identity.controller == address(0)) revert DIDNotFound();
        if (identity.controller != msg.sender) revert NotController();
        _;
    }

    /* ── DID ── */

    function didOf(string calldata did) external pure returns (bytes32) {
        return keccak256(bytes(did));
    }

    function register(bytes32 did, string calldata documentURI) external {
        if (did == bytes32(0)) revert ZeroHash();
        if (_identities[did].controller != address(0)) revert DIDExists();
        _checkDocument(documentURI);
        _identities[did] = Identity({
            controller: msg.sender,
            createdAt: uint64(block.timestamp),
            updatedAt: uint64(block.timestamp),
            active: true,
            documentURI: documentURI
        });
        emit DIDRegistered(did, msg.sender, documentURI);
    }

    function updateDocument(bytes32 did, string calldata documentURI) external onlyController(did) {
        Identity storage identity = _identities[did];
        if (!identity.active) revert DIDInactive();
        _checkDocument(documentURI);
        identity.documentURI = documentURI;
        identity.updatedAt = uint64(block.timestamp);
        emit DIDDocumentUpdated(did, documentURI);
    }

    function changeController(bytes32 did, address newController) external onlyController(did) {
        if (newController == address(0)) revert ZeroAddress();
        Identity storage identity = _identities[did];
        if (!identity.active) revert DIDInactive();
        emit DIDControllerChanged(did, identity.controller, newController);
        identity.controller = newController;
        identity.updatedAt = uint64(block.timestamp);
    }

    /// 되돌릴 수 없다. 이 DID가 발급한 자격증명은 모두 무효로 검증된다.
    function deactivate(bytes32 did) external onlyController(did) {
        Identity storage identity = _identities[did];
        if (!identity.active) revert DIDInactive();
        identity.active = false;
        identity.updatedAt = uint64(block.timestamp);
        emit DIDDeactivated(did);
    }

    function resolve(bytes32 did)
        external
        view
        returns (address controller, string memory documentURI, uint64 createdAt, uint64 updatedAt, bool active)
    {
        Identity storage identity = _identities[did];
        if (identity.controller == address(0)) revert DIDNotFound();
        return (identity.controller, identity.documentURI, identity.createdAt, identity.updatedAt, identity.active);
    }

    /* ── 자격증명 ── */

    function issueCredential(bytes32 credentialHash, bytes32 issuer, bytes32 subject, uint64 expiresAt) external onlyController(issuer) {
        if (credentialHash == bytes32(0) || subject == bytes32(0)) revert ZeroHash();
        if (!_identities[issuer].active) revert DIDInactive();
        if (_credentials[credentialHash].issuedAt != 0) revert CredentialExists();
        if (expiresAt != 0 && expiresAt <= block.timestamp) revert InvalidExpiry();
        _credentials[credentialHash] = Credential({
            issuer: issuer,
            subject: subject,
            issuedAt: uint64(block.timestamp),
            expiresAt: expiresAt,
            revoked: false
        });
        emit CredentialIssued(credentialHash, issuer, subject, expiresAt);
    }

    function revokeCredential(bytes32 credentialHash) external {
        Credential storage credential = _credentials[credentialHash];
        if (credential.issuedAt == 0) revert CredentialNotFound();
        if (_identities[credential.issuer].controller != msg.sender) revert NotController();
        if (credential.revoked) revert AlreadyRevoked();
        credential.revoked = true;
        emit CredentialRevoked(credentialHash, credential.issuer);
    }

    /// @return valid 발급 기록이 있고, 폐기·만료되지 않았고, 발급자 DID가 활성이다
    function verifyCredential(bytes32 credentialHash)
        external
        view
        returns (bool valid, bytes32 issuer, bytes32 subject, uint64 issuedAt, uint64 expiresAt, bool revoked)
    {
        Credential storage credential = _credentials[credentialHash];
        if (credential.issuedAt == 0) return (false, bytes32(0), bytes32(0), 0, 0, false);
        bool expired = credential.expiresAt != 0 && block.timestamp >= credential.expiresAt;
        valid = !credential.revoked && !expired && _identities[credential.issuer].active;
        return (valid, credential.issuer, credential.subject, credential.issuedAt, credential.expiresAt, credential.revoked);
    }

    function _checkDocument(string calldata documentURI) private pure {
        uint256 length = bytes(documentURI).length;
        if (length == 0 || length > 256) revert InvalidDocument();
    }
}
