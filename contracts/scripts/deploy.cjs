// 확장 컨트랙트 배포 (contracts/artifacts의 ABI·바이트코드 사용, 컴파일러 불필요)
//
//   RPC_URL=https://block.mustree.kr PRIVATE_KEY=0x... node scripts/deploy.cjs
//
// 환경변수
//   RPC_URL       배포할 네트워크의 RPC
//   PRIVATE_KEY   배포 지갑의 개인키 (저장소·문서·채팅에 남기지 말 것)
//   OWNER         관리자 주소 (생략하면 배포 지갑)
//   RELAYERS      브릿지 릴레이어 주소, 쉼표 구분 (생략하면 브릿지 게이트웨이는 배포하지 않는다)
//   THRESHOLD     브릿지 서명 정족수 (기본: 릴레이어 수의 과반)
//   FREEZE_SCORE / BLACKLIST_SCORE  이상거래 자동 대응 기준 점수 (기본 80 / 95, 0이면 끔)
//   DRY_RUN=1     배포하지 않고 계획만 출력
//
// 배포 뒤 출력되는 주소를 src/config/contracts.ts의 해당 네트워크 칸에 넣으면 /api/v1 조회 API가 그 컨트랙트를 읽는다.
// RWAVault는 자산마다 따로 배포하므로 여기서 다루지 않는다 (생성자 인자는 contracts/README.md).
const fs = require('node:fs')
const path = require('node:path')
const { ContractFactory, JsonRpcProvider, Wallet, isAddress } = require('ethers')

const artifact = (name) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'artifacts', `${name}.json`), 'utf8'))

/**
 * @param signer  배포 지갑 (ethers Signer)
 * @param options { owner, relayers, threshold, freezeScore, blacklistScore, log }
 * @returns 컨트랙트 이름 → 주소
 */
async function deployAll(signer, options = {}) {
  const log = options.log ?? (() => undefined)
  const owner = options.owner ?? (await signer.getAddress())
  if (!isAddress(owner)) throw new Error('OWNER가 올바른 주소가 아닙니다')
  const relayers = options.relayers ?? []
  if (relayers.some((address) => !isAddress(address))) throw new Error('RELAYERS에 올바르지 않은 주소가 있습니다')
  const threshold = options.threshold ?? Math.floor(relayers.length / 2) + 1
  if (relayers.length > 0 && (threshold < 1 || threshold > relayers.length)) throw new Error('THRESHOLD는 1 이상, 릴레이어 수 이하여야 합니다')
  const freezeScore = options.freezeScore ?? 80
  const blacklistScore = options.blacklistScore ?? 95

  const plan = [
    ['PriceOracle', [owner]],
    ['DIDRegistry', []],
    ['ComplianceGuard', [owner, freezeScore, blacklistScore]],
    ['CompositeExecutor', [owner]],
    ...(relayers.length > 0 ? [['BridgeGateway', [owner, relayers, threshold]]] : []),
  ]
  const deployed = {}
  for (const [name, args] of plan) {
    const { abi, bytecode } = artifact(name)
    const contract = await new ContractFactory(abi, bytecode, signer).deploy(...args)
    await contract.waitForDeployment()
    deployed[name] = await contract.getAddress()
    log(`${name}: ${deployed[name]}`)
  }
  return deployed
}

async function main() {
  const { RPC_URL, PRIVATE_KEY, OWNER, RELAYERS, THRESHOLD, FREEZE_SCORE, BLACKLIST_SCORE, DRY_RUN } = process.env
  if (!RPC_URL || !PRIVATE_KEY) {
    console.error('RPC_URL과 PRIVATE_KEY 환경변수가 필요합니다 (파일 머리 주석 참고)')
    process.exit(1)
  }
  const provider = new JsonRpcProvider(RPC_URL)
  const signer = new Wallet(PRIVATE_KEY, provider)
  const network = await provider.getNetwork()
  const balance = await provider.getBalance(signer.address)
  const options = {
    owner: OWNER || undefined,
    relayers: RELAYERS ? RELAYERS.split(',').map((value) => value.trim()).filter(Boolean) : [],
    threshold: THRESHOLD ? Number(THRESHOLD) : undefined,
    freezeScore: FREEZE_SCORE ? Number(FREEZE_SCORE) : undefined,
    blacklistScore: BLACKLIST_SCORE ? Number(BLACKLIST_SCORE) : undefined,
    log: (line) => console.log(line),
  }
  console.log(`체인 ID ${network.chainId} · 배포 지갑 ${signer.address} · 잔액 ${balance} wei`)
  console.log(`관리자 ${options.owner ?? signer.address} · 릴레이어 ${options.relayers.length}명${options.relayers.length ? '' : ' (브릿지 게이트웨이 생략)'}`)
  if (DRY_RUN === '1') {
    console.log('DRY_RUN: 배포하지 않았습니다')
    return
  }
  const deployed = await deployAll(signer, options)
  console.log('\nsrc/config/contracts.ts에 넣을 주소:')
  console.log(JSON.stringify(deployed, null, 2))
}

module.exports = { deployAll }

if (require.main === module) {
  main().catch((error) => {
    console.error(error.shortMessage ?? error.message)
    process.exit(1)
  })
}
