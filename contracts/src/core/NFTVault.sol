// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/**
 * NFT 발행 금고. 누구나 이름표(label)와 메타데이터를 붙여 NFT를 발행할 수 있다 (사이트의 /nft 도구와 생성 코드가 호출한다).
 * 발행된 NFT는 일반 ERC-721이라 자유롭게 옮길 수 있다. 토큰 번호는 1부터 차례로 붙는다.
 */
contract NFTVault is ERC721 {
    struct Info {
        string label;
        string metadata;
    }

    uint256 public nextTokenId = 1;
    mapping(uint256 => Info) private _info;

    error EmptyLabel();
    error TextTooLong();

    constructor() ERC721("MUSTSEM NFT", "MNFT") {}

    function mintNFT(address to, string calldata label, string calldata metadata) external returns (uint256 tokenId) {
        if (bytes(label).length == 0) revert EmptyLabel();
        if (bytes(label).length > 128 || bytes(metadata).length > 4096) revert TextTooLong();
        tokenId = nextTokenId++;
        _info[tokenId] = Info({label: label, metadata: metadata});
        _mint(to, tokenId);
    }

    function nftInfo(uint256 tokenId) external view returns (string memory label, string memory metadata) {
        _requireOwned(tokenId);
        Info storage info = _info[tokenId];
        return (info.label, info.metadata);
    }
}
