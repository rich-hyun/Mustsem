// 한 번에 배포하기: 명령 하나만 실행하면 물어보는 대로 답하면 된다.
//
//   node scripts/deploy-interactive.cjs
//
// 1) 개인키를 물어본다 (입력한 글자는 화면에 보이지 않고, 파일이나 기록에 남지 않는다)
// 2) 체인, 배포 지갑, 잔액을 보여 주고 배포할지 묻는다
// 3) PriceOracle, DIDRegistry, ComplianceGuard, CompositeExecutor를 배포한다 (브릿지·RWA 지분은 제외)
// 4) 주소를 contracts/deployed.json에 저장한다 (주소만 들어 있고 개인키는 없다)
const fs = require('node:fs')
const path = require('node:path')
const { JsonRpcProvider, Wallet, formatEther } = require('ethers')
const { deployAll } = require('./deploy.cjs')
const { ask, askPrivateKey } = require('./prompt.cjs')

const RPC_URL = process.env.RPC_URL || 'https://block.mustree.kr'
const OUT = path.join(__dirname, '..', 'deployed.json')

async function main() {
  console.log('MUSTSEM 확장 컨트랙트 배포\n')
  const key = await askPrivateKey()
  if (!key) {
    console.log('\n개인키 형식이 아닙니다. 64자리(0~9, a~f)여야 합니다. 아무것도 배포하지 않았습니다.')
    process.exit(1)
  }
  const provider = new JsonRpcProvider(RPC_URL)
  const signer = new Wallet(key, provider)
  let network
  let balance
  try {
    network = await provider.getNetwork()
    balance = await provider.getBalance(signer.address)
  } catch {
    console.log('\n네트워크에 연결하지 못했습니다. 잠시 후 다시 실행하세요. 아무것도 배포하지 않았습니다.')
    process.exit(1)
  }
  console.log(`\n  네트워크   체인 ID ${network.chainId}`)
  console.log(`  배포 지갑  ${signer.address}`)
  console.log(`  잔액       ${formatEther(balance)} (가스비로 쓰입니다)`)
  console.log('  배포 대상  PriceOracle, DIDRegistry, ComplianceGuard, CompositeExecutor')
  console.log('  관리자     배포 지갑 (나중에 다른 주소로 넘길 수 있습니다)\n')
  if (balance === 0n) {
    console.log('잔액이 0이라 가스비를 낼 수 없습니다. 이 지갑에 코인을 넣은 뒤 다시 실행하세요. 아무것도 배포하지 않았습니다.')
    process.exit(1)
  }
  const answer = await ask('이대로 배포할까요? y 입력 후 Enter (그 밖은 취소): ')
  if (answer.toLowerCase() !== 'y') {
    console.log('취소했습니다. 아무것도 배포하지 않았습니다.')
    process.exit(0)
  }
  console.log('\n배포 중입니다. 1분쯤 걸릴 수 있습니다...')
  const contracts = await deployAll(signer, { log: (line) => console.log(`  ${line}`) })
  fs.writeFileSync(OUT, `${JSON.stringify({ chainId: Number(network.chainId), deployer: signer.address, deployedAt: new Date().toISOString(), contracts }, null, 2)}\n`)
  console.log(`\n완료했습니다. 주소를 ${OUT} 에 저장했습니다.`)
  console.log('이제 Claude에게 "배포 끝났어"라고 알려 주세요.')
  process.exit(0)
}

main().catch((error) => {
  console.error(`\n배포에 실패했습니다: ${error.shortMessage ?? error.message}`)
  process.exit(1)
})
