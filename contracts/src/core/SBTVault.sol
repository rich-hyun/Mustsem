// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/**
 * SBT(소울바운드 토큰) 발행 금고. 발급된 지갑에 묶여 다른 지갑으로 옮길 수 없다.
 *
 * - unlockTime이 0이면 영구 귀속. 0이 아니면 그 시각 이후에는 일반 NFT처럼 옮길 수 있다.
 * - 가디언은 토큰마다 1명. 자격이 만료·철회됐을 때 그 토큰을 폐기(revoke)할 수 있다. 가디언도 토큰을 옮기지는 못한다.
 * - 누구나 발급할 수 있다 (사이트의 /sbt 도구와 생성 코드가 호출한다).
 */
contract SBTVault is ERC721 {
    struct Soul {
        address guardian;
        uint256 unlockTime;
        string metadata;
    }

    uint256 public nextTokenId = 1;
    /// 사이트 ABI: sbts(tokenId) → (guardian, unlockTime, metadata)
    mapping(uint256 => Soul) public sbts;
    mapping(uint256 => string) private _labels;

    event Minted(uint256 indexed tokenId, address indexed to, string label, address guardian, uint256 unlockTime, string metadata);
    event Revoked(uint256 indexed tokenId, address indexed guardian);

    error EmptyLabel();
    error TextTooLong();
    error ZeroGuardian();
    error Soulbound(uint256 tokenId);
    error NotGuardian();

    constructor() ERC721("MUSTSEM SBT", "MSBT") {}

    function mintSBT(
        address to,
        string calldata label,
        address guardian,
        uint256 unlockTime,
        string calldata metadata
    ) external returns (uint256 tokenId) {
        if (bytes(label).length == 0) revert EmptyLabel();
        if (bytes(label).length > 128 || bytes(metadata).length > 4096) revert TextTooLong();
        if (guardian == address(0)) revert ZeroGuardian();
        tokenId = nextTokenId++;
        sbts[tokenId] = Soul({guardian: guardian, unlockTime: unlockTime, metadata: metadata});
        _labels[tokenId] = label;
        _mint(to, tokenId);
        emit Minted(tokenId, to, label, guardian, unlockTime, metadata);
    }

    /// 잠금이 풀렸는지 (unlockTime이 0이면 영구 귀속이라 언제나 false)
    function isUnlocked(uint256 tokenId) public view returns (bool) {
        _requireOwned(tokenId);
        uint256 unlockTime = sbts[tokenId].unlockTime;
        return unlockTime != 0 && block.timestamp >= unlockTime;
    }

    function labelOf(uint256 tokenId) external view returns (string memory) {
        _requireOwned(tokenId);
        return _labels[tokenId];
    }

    /// 가디언이 토큰을 폐기한다 (자격 만료·철회)
    function revoke(uint256 tokenId) external {
        _requireOwned(tokenId);
        if (msg.sender != sbts[tokenId].guardian) revert NotGuardian();
        _burn(tokenId);
        delete sbts[tokenId];
        delete _labels[tokenId];
        emit Revoked(tokenId, msg.sender);
    }

    /// 발급(from = 0)과 폐기(to = 0)만 허용하고, 잠금이 풀리기 전의 이전은 막는다
    function _update(address to, uint256 tokenId, address auth) internal override returns (address from) {
        from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) {
            uint256 unlockTime = sbts[tokenId].unlockTime;
            if (unlockTime == 0 || block.timestamp < unlockTime) revert Soulbound(tokenId);
        }
        return super._update(to, tokenId, auth);
    }
}
