/**
 * 컨트랙트 주소와 ABI — 배포 주소가 바뀌면 이 파일만 수정한다.
 * ABI는 화면에서 실제로 호출하는 함수·이벤트·오류만 사람이 읽을 수 있는 형태로 둔다.
 * 주소가 null인 네트워크는 해당 컨트랙트가 아직 배포되지 않은 것으로 취급한다.
 */
import type { NetworkKey } from './networks'

export type ContractMap = Readonly<Record<NetworkKey, string | null>>

/* ── 브릿지: JKK-TMZ 체인 TMZ → wTMZ → (릴레이) → Mustsem 체인 wMST ── */
export const BRIDGE = {
  network: 'jkk-tmz',
  wrappedToken: '0x0D1BFd55283a07e199D52459a7800B66A22b6790', // wTMZ (JKK-TMZ)
  requester: '0x41bf31f5cfa121deA3875e435382fd0a890ab938', // 브릿지 요청 컨트랙트 (JKK-TMZ)
  destinationNetwork: 'mustsem',
  destinationToken: '0x3Dfc5a626a046CE0F01B130fA92dd4ef4A3f714B', // wMST (Mustsem)
} as const satisfies { network: NetworkKey; destinationNetwork: NetworkKey } & Record<string, string>

/* ── 스테이킹: Mustsem 체인 MST ↔ wMST 래핑 + wMST 스테이킹(보상 MST) ── */
export const STAKING = {
  network: 'mustsem',
  wrappedToken: '0x3Dfc5a626a046CE0F01B130fA92dd4ef4A3f714B', // wMST
  staking: '0x8Fb01DA4FA713Ce590546dC440165170E02e7D07',
} as const satisfies { network: NetworkKey } & Record<string, string>

/** 스테이킹 안내 문구에 쓰는 상품 조건 */
export const STAKING_TERMS = { aprPercent: 2, claimIntervalDays: 7 } as const

/* ── 토큰 발행 컨트랙트 (네트워크별) ── */
export const NFT_CONTRACTS: ContractMap = {
  mustsem: '0x6255a7Fbbc3BBccD177E38936062F84A7580B24d',
  'jkk-tmz': '0x522802a049B7B8940bBC03aB835954321f7872EC',
  kukminbank: null,
  mdpcd: '0xD8e691d62aA912a3e735Ef2723A8544885358517',
  nabizam: '0xd57EAf9e0EEA6226ed0240643Ce409B5253dBcEa',
}

export const SBT_CONTRACTS: ContractMap = {
  mustsem: '0x58EA439b075e01E7a681b7798e3d8022e619eAD8',
  'jkk-tmz': '0xcc2E2778a0F2148f9C09D38C6917b0FcD6728bf0',
  kukminbank: null,
  mdpcd: '0xf6fF21b1860541DD781F5E36801906Aa207bEB03',
  nabizam: '0xe02bF2Df1919f4dA20e10a2304648072fBD34E94',
}

export const RWA_CONTRACTS: ContractMap = {
  mustsem: '0x44FDE9228ED16B64Af6C4Bf8f4f985079184c639',
  'jkk-tmz': '0xB30821a1BF6C15E2C08036984D56f50706b1FFcB',
  kukminbank: null,
  mdpcd: '0xd153a0fCF7147CB9503c527875f7395e35f3185B',
  nabizam: '0x65b2C826E206b4691ffA94BfFF0a2d8dDc270ffD',
}

/* ── ABI ── */
const ERC721_TRANSFER_EVENT =
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'

/** OpenZeppelin ERC721 커스텀 오류 — 되돌림 사유를 이름으로 해석하기 위해 포함한다 */
const ERC721_ERRORS = [
  'error ERC721IncorrectOwner(address sender, uint256 tokenId, address owner)',
  'error ERC721InsufficientApproval(address operator, uint256 tokenId)',
  'error ERC721InvalidApprover(address approver)',
  'error ERC721InvalidOperator(address operator)',
  'error ERC721InvalidOwner(address owner)',
  'error ERC721InvalidReceiver(address receiver)',
  'error ERC721InvalidSender(address sender)',
  'error ERC721NonexistentToken(uint256 tokenId)',
] as const

export const NFT_ABI = [
  'function mintNFT(address to, string label, string metadata) returns (uint256)',
  'function nextTokenId() view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function nftInfo(uint256 tokenId) view returns (string label, string metadata)',
  ERC721_TRANSFER_EVENT,
  ...ERC721_ERRORS,
] as const

export const SBT_ABI = [
  'function mintSBT(address to, string label, address guardian, uint256 unlockTime, string metadata) returns (uint256)',
  'function sbts(uint256 tokenId) view returns (address guardian, uint256 unlockTime, string metadata)',
  'function isUnlocked(uint256 tokenId) view returns (bool)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'event Minted(uint256 indexed tokenId, address indexed to, string label, address guardian, uint256 unlockTime, string metadata)',
  ERC721_TRANSFER_EVENT,
] as const

export const RWA_ABI = [
  'function mintRWA(address to, string cid) returns (uint256)',
  'function nextId() view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  ERC721_TRANSFER_EVENT,
  ...ERC721_ERRORS,
] as const

/** WETH 형태의 래핑 토큰 (wTMZ, wMST) */
export const WRAPPED_NATIVE_ABI = [
  'function deposit() payable',
  'function withdraw(uint256 amount)',
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
] as const

export const BRIDGE_REQUEST_ABI = ['function request(uint256 amount, address mstRecipient)'] as const

export const STAKING_ABI = [
  'function stake(uint256 amount)',
  'function withdraw(uint256 amount)',
  'function claim()',
  'function exit()',
  'function pendingReward(address user) view returns (uint256)',
  'function stakes(address user) view returns (uint256 amount, uint256 accrued, uint256 lastUpdate, uint256 lastClaimTime)',
  'function minClaimInterval() view returns (uint256)',
] as const
