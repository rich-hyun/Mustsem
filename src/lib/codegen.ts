/**
 * NFT·SBT·RWA 도구의 코드 생성기.
 * 생성 코드는 선택한 네트워크의 실제 배포 주소와 체크섬 주소를 그대로 담아
 * 복사해서 바로 컴파일·실행할 수 있게 만든다.
 */
import { Interface } from 'ethers'
import type { ChainNetwork } from '@/config/networks'

const UNDEPLOYED_NOTE = '이 네트워크에는 아직 배포되지 않았습니다. 배포 후 주소를 입력하세요.'

/** Solidity 문자열 리터럴. 한글 등 비ASCII 문자가 있으면 unicode"…" 형식을 쓴다. */
export function solidityString(value: string): string {
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/[\u0000-\u001f\u007f]/g, (c) => `\\x${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
  const needsUnicode = /[^\u0000-\u007f]/.test(value)
  return `${needsUnicode ? 'unicode' : ''}"${escaped}"`
}

/** 네트워크 이름을 Solidity 식별자로 (예: JKK-TMZ → JKK_TMZ) */
export function solidityIdentifier(value: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9_]/g, '_')
  return /^[0-9]/.test(cleaned) ? `_${cleaned}` : cleaned
}

/** 상수 선언의 우변 (세미콜론 포함). 미배포 네트워크는 address(0)과 안내 주석을 넣는다. */
const contractExpression = (iface: string, address: string | null) =>
  address ? `${iface}(${address});` : `${iface}(address(0)); // ${UNDEPLOYED_NOTE}`

const header = (network: ChainNetwork) =>
  `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// 네트워크: ${network.name} (chainId ${network.chainId})`

interface NftCodeInput {
  network: ChainNetwork
  contract: string | null
  to: string
  label: string
  metadata: string
}

export function nftSolidity({ network, contract, to, label, metadata }: NftCodeInput): string {
  const vault = contractExpression('INFTVault', contract)
  return `${header(network)}

interface INFTVault {
    function mintNFT(address to, string calldata label, string calldata metadata) external returns (uint256);
}

contract NFT_Mint_${solidityIdentifier(network.name)} {
    INFTVault public constant VAULT = ${vault}

    function createNFT() external returns (uint256 tokenId) {
        tokenId = VAULT.mintNFT(
            ${to},
            ${solidityString(label)},
            ${solidityString(metadata)}
        );
    }
}
`
}

interface SbtCodeInput {
  network: ChainNetwork
  contract: string | null
  to: string
  label: string
  guardian: string
}

export function sbtSolidity({ network, contract, to, label, guardian }: SbtCodeInput): string {
  const vault = contractExpression('ISBTVault', contract)
  return `${header(network)}

interface ISBTVault {
    function mintSBT(
        address to,
        string calldata label,
        address guardian,
        uint256 unlockTime,
        string calldata metadata
    ) external returns (uint256);
}

contract SBT_Mint_${solidityIdentifier(network.name)} {
    ISBTVault public constant VAULT = ${vault}

    function createSBT() external returns (uint256 tokenId) {
        tokenId = VAULT.mintSBT(
            ${to},
            ${solidityString(label)},
            ${guardian},
            0, // unlockTime 0 = 영구 귀속
            "{}"
        );
    }
}
`
}

const NFT_PYTHON_ABI = new Interface([
  'function mintNFT(address to, string label, string metadata) returns (uint256)',
  'function nextTokenId() view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
]).formatJson()

/** web3.py(v7) 발행 스크립트. 개인키는 파일에 적지 않고 환경변수로 받는다. */
export function nftPython({ network, contract, to, label, metadata }: NftCodeInput): string {
  const contractLine = contract ? `"${contract}"` : `""  # ${UNDEPLOYED_NOTE}`
  return `# ----------------------------------------------------------
# MUSTSEM NFT 발행 스크립트 (자동 생성)
# 네트워크: ${network.name} (chainId ${network.chainId})
# ----------------------------------------------------------
# 설치:  pip install "web3>=7"
# 실행:  서명할 지갑의 개인키를 환경변수 MUSTSEM_PRIVATE_KEY 에 넣은 뒤 실행합니다.
#        개인키를 이 파일에 직접 적지 마세요.

import json
import os

from web3 import Web3
from web3.logs import DISCARD

RPC_URL = "${network.rpcUrl}"
CHAIN_ID = ${network.chainId}
CONTRACT = ${contractLine}

PRIVATE_KEY = os.environ.get("MUSTSEM_PRIVATE_KEY")
if not PRIVATE_KEY:
    raise SystemExit("환경변수 MUSTSEM_PRIVATE_KEY 를 설정하세요.")

ABI = json.loads(r"""${NFT_PYTHON_ABI}""")

w3 = Web3(Web3.HTTPProvider(RPC_URL))
account = w3.eth.account.from_key(PRIVATE_KEY)
contract = w3.eth.contract(address=CONTRACT, abi=ABI)

tx = contract.functions.mintNFT(
    Web3.to_checksum_address("${to}"),
    ${JSON.stringify(label)},
    ${JSON.stringify(metadata)},
).build_transaction({
    "from": account.address,
    "nonce": w3.eth.get_transaction_count(account.address),
    "gas": 600000,
    "gasPrice": w3.eth.gas_price,
    "chainId": CHAIN_ID,
})

signed = account.sign_transaction(tx)
tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
print("전송된 트랜잭션:", tx_hash.hex())

receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
if receipt["status"] != 1:
    raise SystemExit("발행이 실패했습니다. (트랜잭션이 되돌려졌습니다)")

# Transfer 이벤트에서 토큰 번호를 읽고, 이벤트를 읽을 수 없는 네트워크에서는 다음 번호로 계산한다
events = contract.events.Transfer().process_receipt(receipt, errors=DISCARD)
token_id = events[0]["args"]["tokenId"] if events else contract.functions.nextTokenId().call() - 1
owner = contract.functions.ownerOf(token_id).call()

print("발행 완료")
print("  Token ID :", token_id)
print("  Owner    :", owner)
print("  Contract :", CONTRACT)
print("  Block    :", receipt["blockNumber"])
`
}

interface RwaCodeInput {
  network: ChainNetwork
  contract: string | null
  to: string
  tokenUri: string
}

export function rwaSolidity({ network, contract, to, tokenUri }: RwaCodeInput): string {
  const token = contractExpression('IRWAToken', contract)
  return `${header(network)}

interface IRWAToken {
    function mintRWA(address to, string calldata cid) external returns (uint256);
}

contract RWA_Mint_${solidityIdentifier(network.name)} {
    IRWAToken public constant RWA = ${token}

    function mintExample() external returns (uint256 tokenId) {
        tokenId = RWA.mintRWA(${to}, ${solidityString(tokenUri)});
    }
}
`
}

export function rwaEthers({ network, contract, to, tokenUri }: RwaCodeInput): string {
  return `// 네트워크: ${network.name} (chainId ${network.chainId})
import { BrowserProvider, Contract } from "ethers";

const RWA_ABI = ["function mintRWA(address to, string cid) returns (uint256)"];
const RWA_CONTRACT = ${contract ? JSON.stringify(contract) : `"" // ${UNDEPLOYED_NOTE}`};

const provider = new BrowserProvider(window.ethereum);
const signer = await provider.getSigner();
const rwa = new Contract(RWA_CONTRACT, RWA_ABI, signer);

const tx = await rwa.mintRWA(${JSON.stringify(to)}, ${JSON.stringify(tokenUri)});
console.log("TX Hash:", tx.hash);

const receipt = await tx.wait();
console.log("Block:", receipt.blockNumber);
`
}
