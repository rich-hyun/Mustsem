// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/**
 * RWA(실물자산) 토큰. 자산의 원본 자료(감정서·계약서 등)를 IPFS에 올린 뒤 그 CID를 담아 발행한다.
 * tokenURI는 발행 때 넣은 CID(또는 URI)를 그대로 돌려준다. 누구나 발행할 수 있다 (사이트의 /rwa 도구가 호출한다).
 */
contract RWAToken is ERC721 {
    uint256 public nextId = 1;
    mapping(uint256 => string) private _cids;

    error EmptyCid();
    error TextTooLong();

    constructor() ERC721("MUSTSEM RWA", "MRWA") {}

    function mintRWA(address to, string calldata cid) external returns (uint256 tokenId) {
        uint256 length = bytes(cid).length;
        if (length == 0) revert EmptyCid();
        if (length > 512) revert TextTooLong();
        tokenId = nextId++;
        _cids[tokenId] = cid;
        _mint(to, tokenId);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return _cids[tokenId];
    }
}
