// 배포한 컨트랙트에 첫 데이터를 넣는다: 명령 하나만 실행하고 물어보는 대로 답하면 된다.
//
//   node scripts/setup-interactive.cjs
//
// 하는 일 (이미 돼 있는 것은 건너뛴다. 여러 번 실행해도 같은 결과)
//   오라클  관리자 지갑을 리포터로 등록 → BTC/USD, QQQ/USD 피드 등록 → 최근 일별 종가를 온체인에 기록
//   DID     회사 DID(did:mst:mustsem) 등록 → 시연용 자격증명 1건 발급
// 관리자 지갑(배포에 쓴 지갑)의 개인키가 필요하다. 개인키는 화면·파일·기록에 남기지 않는다.
//
// 가격은 다시 실행할 때마다 새 종가가 있으면 한 라운드씩 추가된다. 피드는 갱신 주기(heartbeat)가 지나면 stale로 표시되므로
// 계속 최신으로 두려면 이 스크립트를 주기적으로 실행하거나 리포터 서버를 따로 둔다.
const fs = require('node:fs')
const path = require('node:path')
const { Contract, JsonRpcProvider, Wallet, formatEther, id, parseUnits, formatUnits } = require('ethers')
const { ask, askPrivateKey } = require('./prompt.cjs')

const deployment = JSON.parse(fs.readFileSync(process.env.DEPLOYMENT || path.join(__dirname, '..', 'deployments', 'mustsem.json'), 'utf8'))
const RPC_URL = process.env.RPC_URL || deployment.rpcUrl
const PRICE_SOURCE = 'https://www.mustsem.co.kr/api/market-data'
const artifact = (name) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'artifacts', `${name}.json`), 'utf8'))

const DAY = 86_400
/** 피드: 소수 2자리. 갱신 주기는 일별 종가 기준 (QQQ는 주말·휴장을 감안해 넉넉히) */
const FEEDS = [
  { pair: 'BTC/USD', series: 'btc', decimals: 2, heartbeat: 2 * DAY },
  { pair: 'QQQ/USD', series: 'qqq', decimals: 2, heartbeat: 5 * DAY },
]
const COMPANY_DID = 'did:mst:mustsem'
const COMPANY_DOCUMENT = 'https://www.mustsem.co.kr/'
const SAMPLE_SUBJECT = 'did:mst:example'
/** 시연용 자격증명의 원문 (이 문자열의 해시만 체인에 올라간다) */
const SAMPLE_CREDENTIAL = 'MUSTSEM sample credential: did:mst:mustsem -> did:mst:example'

/** 최근 일별 종가. 테스트에서는 PRICES_JSON으로 대신 넣는다: {"btc":{"date":"2026-11-10","close":74566.11}, ...} */
async function latestCloses() {
  if (process.env.PRICES_JSON) return JSON.parse(process.env.PRICES_JSON)
  const from = new Date(Date.now() - 14 * DAY * 1000).toISOString().slice(0, 10)
  const response = await fetch(`${PRICE_SOURCE}?from=${from}`, { signal: AbortSignal.timeout(20_000) })
  if (!response.ok) throw new Error('시세를 받아오지 못했습니다')
  const body = await response.json()
  const out = {}
  for (const key of ['btc', 'qqq']) {
    const last = body.data?.[key]?.at(-1)
    if (last && typeof last.close === 'number' && typeof last.date === 'string') out[key] = { date: last.date, close: last.close }
  }
  return out
}

async function main() {
  console.log('MUSTSEM 컨트랙트 초기 설정 (오라클 가격, DID)\n')
  const key = await askPrivateKey()
  if (!key) {
    console.log('\n개인키 형식이 아닙니다. 64자리(0~9, a~f)여야 합니다. 아무것도 바꾸지 않았습니다.')
    process.exit(1)
  }
  const provider = new JsonRpcProvider(RPC_URL)
  const signer = new Wallet(key, provider)
  const oracle = new Contract(deployment.contracts.PriceOracle, artifact('PriceOracle').abi, signer)
  const registry = new Contract(deployment.contracts.DIDRegistry, artifact('DIDRegistry').abi, signer)

  let network, balance, owner, closes
  try {
    ;[network, balance, owner] = await Promise.all([provider.getNetwork(), provider.getBalance(signer.address), oracle.owner()])
  } catch {
    console.log('\n네트워크에 연결하지 못했습니다. 잠시 후 다시 실행하세요. 아무것도 바꾸지 않았습니다.')
    process.exit(1)
  }
  if (Number(network.chainId) !== deployment.chainId) {
    console.log(`\n체인 ID가 다릅니다 (연결 ${network.chainId}, 배포 기록 ${deployment.chainId}). 아무것도 바꾸지 않았습니다.`)
    process.exit(1)
  }
  if (owner !== signer.address) {
    console.log(`\n이 지갑(${signer.address})은 오라클 관리자가 아닙니다. 관리자는 ${owner} 입니다. 아무것도 바꾸지 않았습니다.`)
    process.exit(1)
  }
  try {
    closes = await latestCloses()
  } catch {
    closes = {}
  }

  // ── 할 일 계산 (조회만) ──
  const now = (await provider.getBlock('latest')).timestamp
  const plan = []
  if (!(await oracle.reporters(signer.address))) plan.push({ text: '오라클: 관리자 지갑을 리포터로 등록', run: (o) => oracle.setReporter(signer.address, true, o) })
  for (const feed of FEEDS) {
    let latestObserved = 0n
    let exists = true
    try {
      const info = await oracle.getFeed(feed.pair)
      if (info.latestRound > 0n) latestObserved = (await oracle.getRound(feed.pair, info.latestRound)).observedAt
    } catch {
      exists = false
    }
    if (!exists) plan.push({ text: `오라클: ${feed.pair} 피드 등록 (소수 ${feed.decimals}자리, 갱신 주기 ${feed.heartbeat / DAY}일)`, run: (o) => oracle.registerFeed(feed.pair, feed.decimals, feed.heartbeat, o) })
    const close = closes[feed.series]
    if (!close) {
      console.log(`  (${feed.pair}: 시세를 받아오지 못해 가격 기록은 건너뜁니다)`)
      continue
    }
    // 일별 종가의 관측 시각은 그날 0시(UTC). 체인 시각보다 미래일 수 없고, 직전 라운드보다 뒤여야 한다
    const observedAt = Math.min(Math.floor(Date.parse(`${close.date}T00:00:00Z`) / 1000), now)
    const answer = parseUnits(close.close.toFixed(feed.decimals), feed.decimals)
    if (BigInt(observedAt) > latestObserved) {
      plan.push({ text: `오라클: ${feed.pair} = ${formatUnits(answer, feed.decimals)} 기록 (${close.date} 종가)`, run: (o) => oracle.submit(feed.pair, answer, observedAt, o) })
    }
  }
  const companyDid = id(COMPANY_DID)
  const credentialHash = id(SAMPLE_CREDENTIAL)
  let didExists = true
  try {
    await registry.resolve(companyDid)
  } catch {
    didExists = false
  }
  if (!didExists) plan.push({ text: `DID: ${COMPANY_DID} 등록 (문서 주소 ${COMPANY_DOCUMENT})`, run: (o) => registry.register(companyDid, COMPANY_DOCUMENT, o) })
  if ((await registry.verifyCredential(credentialHash)).issuedAt === 0n) {
    plan.push({ text: `DID: 시연용 자격증명 발급 (${COMPANY_DID} → ${SAMPLE_SUBJECT}, 만료 없음)`, run: (o) => registry.issueCredential(credentialHash, companyDid, id(SAMPLE_SUBJECT), 0, o) })
  }

  console.log(`\n  네트워크   체인 ID ${network.chainId}`)
  console.log(`  관리자 지갑 ${signer.address}`)
  console.log(`  잔액       ${formatEther(balance)} (가스비로 쓰입니다)\n`)
  if (plan.length === 0) {
    console.log('이미 모두 설정돼 있습니다. 새로 기록할 가격도 없습니다. 아무것도 바꾸지 않았습니다.')
    printSummary(credentialHash)
    process.exit(0)
  }
  console.log('할 일:')
  plan.forEach((step, index) => console.log(`  ${index + 1}. ${step.text}`))
  if (balance === 0n) {
    console.log('\n잔액이 0이라 가스비를 낼 수 없습니다. 아무것도 바꾸지 않았습니다.')
    process.exit(1)
  }
  const answer = await ask('\n이대로 실행할까요? y 입력 후 Enter (그 밖은 취소): ')
  if (answer.toLowerCase() !== 'y') {
    console.log('취소했습니다. 아무것도 바꾸지 않았습니다.')
    process.exit(0)
  }

  console.log('\n실행 중입니다...')
  let nonce = await signer.getNonce('pending')
  for (const [index, step] of plan.entries()) {
    const tx = await step.run({ nonce: nonce++ })
    await tx.wait()
    console.log(`  ${index + 1}/${plan.length} 완료: ${step.text}`)
  }
  console.log('\n모두 완료했습니다.')
  printSummary(credentialHash)
  console.log('\n이제 Claude에게 "설정 끝났어"라고 알려 주세요.')
  process.exit(0)
}

function printSummary(credentialHash) {
  console.log('\n확인용 값')
  console.log(`  DID             ${COMPANY_DID}`)
  console.log(`  자격증명 해시   ${credentialHash}`)
}

main().catch((error) => {
  console.error(`\n실패했습니다: ${error.shortMessage ?? error.message}`)
  console.error('이미 끝난 단계는 그대로 남아 있습니다. 다시 실행하면 남은 단계만 이어서 합니다.')
  process.exit(1)
})
