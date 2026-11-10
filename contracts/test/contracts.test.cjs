// 컨트랙트 테스트: cd contracts && npm test  (Hardhat 내장 체인에서 실행, 운영 체인에 붙지 않는다)
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const hre = require('hardhat')
const { BrowserProvider, ContractFactory, Interface, id, keccak256, toUtf8Bytes, parseEther, getBytes, ZeroAddress, ZeroHash } = require('ethers')

const results = []
async function test(name, run) {
  try {
    await run()
    results.push(true)
    console.log(`PASS  ${name}`)
  } catch (error) {
    results.push(false)
    console.log(`FAIL  ${name}\n      ${error.message.split('\n')[0]}`)
  }
}

/** 커스텀 오류 이름으로 되돌림을 확인한다 */
async function reverts(promise, errorName, iface) {
  try {
    const tx = await promise
    if (tx && tx.wait) await tx.wait()
  } catch (error) {
    const data = error.data ?? error.info?.error?.data ?? error.error?.data
    const parsed = data && iface ? iface.parseError(data) : null
    const got = parsed?.name ?? error.revert?.name ?? error.shortMessage ?? error.message
    assert.ok(String(got).includes(errorName), `expected ${errorName}, got ${got}`)
    return parsed
  }
  assert.fail(`expected revert ${errorName}`)
}

const CONTRACTS = ['PriceOracle', 'DIDRegistry', 'ComplianceGuard', 'BridgeGateway', 'RWAVault', 'CompositeExecutor']

async function main() {
  await hre.run('compile', { quiet: true })
  // cacheTimeout -1: ethers는 같은 요청의 결과를 250ms 동안 재사용한다. 상태를 바꾼 직후 같은 호출을 다시 확인하므로 끈다
  const provider = new BrowserProvider(hre.network.provider, undefined, { cacheTimeout: -1 })
  const signers = await Promise.all([0, 1, 2, 3, 4, 5].map((i) => provider.getSigner(i)))
  const [owner, alice, bob, carol, relayerA, relayerB] = signers
  const addr = Object.fromEntries(await Promise.all(Object.entries({ owner, alice, bob, carol, relayerA, relayerB }).map(async ([k, s]) => [k, await s.getAddress()])))
  const artifact = (name) => hre.artifacts.readArtifactSync(name)
  const deploy = async (name, args = [], signer = owner) => {
    const a = artifact(name)
    const contract = await new ContractFactory(a.abi, a.bytecode, signer).deploy(...args)
    await contract.waitForDeployment()
    return contract
  }
  const now = async () => (await provider.getBlock('latest')).timestamp
  const increase = async (seconds) => {
    await hre.network.provider.send('evm_increaseTime', [seconds])
    await hre.network.provider.send('evm_mine')
  }
  const wait = async (txPromise) => (await txPromise).wait()

  /* ── PriceOracle ── */
  const oracle = await deploy('PriceOracle', [addr.owner])
  const oracleI = oracle.interface
  await test('오라클: 관리자만 피드 등록, 중복 등록 거절', async () => {
    await reverts(oracle.connect(alice).registerFeed('MST/KRW', 2, 3600), 'NotOwner', oracleI)
    await wait(oracle.registerFeed('MST/KRW', 2, 3600))
    await reverts(oracle.registerFeed('MST/KRW', 2, 3600), 'FeedExists', oracleI)
    await reverts(oracle.registerFeed('', 2, 3600), 'InvalidPair', oracleI)
    assert.equal(await oracle.feedCount(), 1n)
    assert.equal((await oracle.feedAt(0)).pair, 'MST/KRW')
  })
  await test('오라클: 허가된 리포터만 제출, 0 이하·미래 시각·역순 관측 거절', async () => {
    const t = await now()
    await reverts(oracle.connect(alice).submit('MST/KRW', 150000, t), 'NotReporter', oracleI)
    await wait(oracle.setReporter(addr.alice, true))
    await reverts(oracle.connect(alice).submit('BTC/KRW', 1, t), 'FeedNotFound', oracleI)
    await reverts(oracle.connect(alice).submit('MST/KRW', 0, t), 'InvalidAnswer', oracleI)
    await reverts(oracle.connect(alice).submit('MST/KRW', 150000, t + 10_000), 'InvalidObservation', oracleI)
    await reverts(oracle.latestPrice('MST/KRW'), 'RoundNotFound', oracleI)
    await wait(oracle.connect(alice).submit('MST/KRW', 150000, t))
    await reverts(oracle.connect(alice).submit('MST/KRW', 151000, t), 'InvalidObservation', oracleI)
    await wait(oracle.connect(alice).submit('MST/KRW', 151000, t + 1))
  })
  await test('오라클: 최신 가격·라운드 이력 조회, heartbeat 지나면 stale', async () => {
    const latest = await oracle.latestPrice('MST/KRW')
    assert.equal(latest.roundId, 2n)
    assert.equal(latest.answer, 151000n)
    assert.equal(latest.decimals_, 2n)
    assert.equal(latest.stale, false)
    const first = await oracle.getRound('MST/KRW', 1)
    assert.equal(first.answer, 150000n)
    assert.equal(first.reporter, addr.alice)
    await reverts(oracle.getRound('MST/KRW', 9), 'RoundNotFound', oracleI)
    await increase(3601)
    assert.equal((await oracle.latestPrice('MST/KRW')).stale, true)
  })
  await test('오라클: 리포터 해제 후 제출 불가, 소유권 이전은 수락해야 완료', async () => {
    await wait(oracle.setReporter(addr.alice, false))
    await reverts(oracle.connect(alice).submit('MST/KRW', 1, await now()), 'NotReporter', oracleI)
    await wait(oracle.transferOwnership(addr.bob))
    assert.equal(await oracle.owner(), addr.owner)
    await reverts(oracle.connect(alice).acceptOwnership(), 'NotOwner', oracleI)
    await wait(oracle.connect(bob).acceptOwnership())
    assert.equal(await oracle.owner(), addr.bob)
  })

  /* ── DIDRegistry ── */
  const did = await deploy('DIDRegistry')
  const didI = did.interface
  const issuerDid = id('did:mst:issuer')
  const subjectDid = id('did:mst:subject')
  const credential = keccak256(toUtf8Bytes('credential-1'))
  await test('DID: 등록·조회, 중복 등록 거절, 컨트롤러만 문서 수정', async () => {
    assert.equal(await did.didOf('did:mst:issuer'), issuerDid)
    await wait(did.connect(alice).register(issuerDid, 'ipfs://issuer-doc'))
    await reverts(did.connect(bob).register(issuerDid, 'ipfs://x'), 'DIDExists', didI)
    await reverts(did.connect(alice).register(id('did:mst:empty'), ''), 'InvalidDocument', didI)
    await reverts(did.resolve(id('did:mst:none')), 'DIDNotFound', didI)
    const resolved = await did.resolve(issuerDid)
    assert.equal(resolved.controller, addr.alice)
    assert.equal(resolved.documentURI, 'ipfs://issuer-doc')
    assert.equal(resolved.active, true)
    await reverts(did.connect(bob).updateDocument(issuerDid, 'ipfs://hacked'), 'NotController', didI)
    await wait(did.connect(alice).updateDocument(issuerDid, 'ipfs://issuer-doc-v2'))
    assert.equal((await did.resolve(issuerDid)).documentURI, 'ipfs://issuer-doc-v2')
  })
  await test('DID: 발급자 컨트롤러만 자격증명 발급, 중복·과거 만료 거절', async () => {
    await reverts(did.connect(bob).issueCredential(credential, issuerDid, subjectDid, 0), 'NotController', didI)
    await reverts(did.connect(alice).issueCredential(credential, issuerDid, subjectDid, 1), 'InvalidExpiry', didI)
    await reverts(did.connect(alice).issueCredential(ZeroHash, issuerDid, subjectDid, 0), 'ZeroHash', didI)
    const expires = (await now()) + 1000
    await wait(did.connect(alice).issueCredential(credential, issuerDid, subjectDid, expires))
    await reverts(did.connect(alice).issueCredential(credential, issuerDid, subjectDid, 0), 'CredentialExists', didI)
    const verified = await did.verifyCredential(credential)
    assert.equal(verified.valid, true)
    assert.equal(verified.issuer, issuerDid)
    assert.equal(verified.subject, subjectDid)
    assert.equal((await did.verifyCredential(id('unknown'))).valid, false)
  })
  await test('DID: 만료·폐기·발급자 비활성화 시 검증 실패', async () => {
    await increase(1001)
    assert.equal((await did.verifyCredential(credential)).valid, false, '만료')
    const second = id('credential-2')
    await wait(did.connect(alice).issueCredential(second, issuerDid, subjectDid, 0))
    await reverts(did.connect(bob).revokeCredential(second), 'NotController', didI)
    await wait(did.connect(alice).revokeCredential(second))
    await reverts(did.connect(alice).revokeCredential(second), 'AlreadyRevoked', didI)
    const revoked = await did.verifyCredential(second)
    assert.equal(revoked.valid, false)
    assert.equal(revoked.revoked, true)
    const third = id('credential-3')
    await wait(did.connect(alice).issueCredential(third, issuerDid, subjectDid, 0))
    assert.equal((await did.verifyCredential(third)).valid, true)
    await wait(did.connect(alice).changeController(issuerDid, addr.carol))
    await reverts(did.connect(alice).deactivate(issuerDid), 'NotController', didI)
    await wait(did.connect(carol).deactivate(issuerDid))
    assert.equal((await did.verifyCredential(third)).valid, false, '발급자 비활성')
    await reverts(did.connect(carol).issueCredential(id('credential-4'), issuerDid, subjectDid, 0), 'DIDInactive', didI)
  })

  /* ── ComplianceGuard ── */
  const guard = await deploy('ComplianceGuard', [addr.owner, 80, 95])
  const guardI = guard.interface
  const REASON = id('AMOUNT_SPIKE')
  await test('이상거래 대응: 탐지기만 보고, 점수에 따라 자동 동결·블랙리스트', async () => {
    await reverts(guard.connect(alice).report(addr.bob, 90, REASON, ZeroHash), 'NotDetector', guardI)
    await wait(guard.setDetector(addr.alice, true))
    await reverts(guard.connect(alice).report(addr.bob, 0, REASON, ZeroHash), 'InvalidScore', guardI)
    await reverts(guard.connect(alice).report(addr.bob, 101, REASON, ZeroHash), 'InvalidScore', guardI)
    await wait(guard.connect(alice).report(addr.bob, 79, REASON, ZeroHash))
    assert.equal(await guard.isRestricted(addr.bob), false, '기준 미만은 기록만')
    await wait(guard.connect(alice).report(addr.bob, 85, REASON, ZeroHash))
    assert.equal(await guard.frozen(addr.bob), true)
    assert.equal(await guard.blacklisted(addr.bob), false)
    assert.equal(await guard.canTransfer(addr.bob, addr.carol), false)
    assert.equal(await guard.canTransfer(addr.carol, addr.bob), false)
    await wait(guard.connect(alice).report(addr.carol, 97, REASON, ZeroHash))
    assert.equal(await guard.frozen(addr.carol), true)
    assert.equal(await guard.blacklisted(addr.carol), true)
  })
  await test('이상거래 대응: 탐지기는 해제 불가, 동결 해제는 운영자, 블랙리스트 해제는 관리자', async () => {
    await reverts(guard.connect(alice).unfreeze(addr.bob), 'NotOperator', guardI)
    await wait(guard.setOperator(addr.relayerA, true))
    await wait(guard.connect(relayerA).unfreeze(addr.bob))
    assert.equal(await guard.isRestricted(addr.bob), false)
    await reverts(guard.connect(relayerA).removeFromBlacklist(addr.carol), 'NotOwner', guardI)
    await wait(guard.removeFromBlacklist(addr.carol))
    await wait(guard.unfreeze(addr.carol))
    assert.equal(await guard.isRestricted(addr.carol), false)
  })
  await test('이상거래 대응: 관리자·운영자 지갑은 자동 조치 제외, 정책 0이면 자동 대응 끔', async () => {
    await wait(guard.connect(alice).report(addr.owner, 100, REASON, ZeroHash))
    await wait(guard.connect(alice).report(addr.relayerA, 100, REASON, ZeroHash))
    assert.equal(await guard.isRestricted(addr.owner), false)
    assert.equal(await guard.isRestricted(addr.relayerA), false)
    await reverts(guard.freeze(addr.owner, REASON), 'ProtectedAccount', guardI)
    await reverts(guard.connect(alice).setPolicy(0, 0), 'NotOwner', guardI)
    await wait(guard.setPolicy(0, 0))
    await wait(guard.connect(alice).report(addr.bob, 100, REASON, ZeroHash))
    assert.equal(await guard.isRestricted(addr.bob), false)
    await wait(guard.setPolicy(80, 95))
  })

  /* ── RWAVault ── */
  const payout = await deploy('TestToken')
  const SHARES = parseEther('1000')
  const vault = await deploy('RWAVault', ['Seoul Office Share', 'SOS', addr.carol, 7, SHARES, addr.owner, await payout.getAddress(), await guard.getAddress()])
  const vaultI = vault.interface
  const vaultAddress = await vault.getAddress()
  await test('RWA 지분: 발행인에게 전량 발행, 지분 이전과 지분율 조회', async () => {
    assert.equal(await vault.totalSupply(), SHARES)
    assert.equal(await vault.balanceOf(addr.owner), SHARES)
    assert.equal(await vault.assetTokenId(), 7n)
    await wait(vault.transfer(addr.alice, parseEther('300')))
    await wait(vault.transfer(addr.bob, parseEther('100')))
    const info = await vault.holderInfo(addr.alice)
    assert.equal(info.shares, parseEther('300'))
    assert.equal(info.shareBps, 3000n)
    await reverts(vault.connect(alice).transfer(addr.bob, parseEther('301')), 'InsufficientBalance', vaultI)
  })
  await test('RWA 지분: 수익은 분배 시점 지분대로, 이전 뒤에도 기존 몫 유지', async () => {
    await wait(payout.mint(addr.owner, parseEther('10000')))
    await wait(payout.approve(vaultAddress, parseEther('10000')))
    await reverts(vault.connect(alice).distribute(1), 'NotIssuer', vaultI)
    await reverts(vault.distribute(0), 'ZeroAmount', vaultI)
    await wait(vault.distribute(parseEther('1000'))) // owner 600, alice 300, bob 100
    assert.equal(await vault.withdrawableOf(addr.alice), parseEther('300'))
    assert.equal(await vault.withdrawableOf(addr.bob), parseEther('100'))
    assert.equal(await vault.withdrawableOf(addr.owner), parseEther('600'))
    // alice가 지분 전부를 bob에게 넘겨도 이미 쌓인 300은 alice 몫
    await wait(vault.connect(alice).transfer(addr.bob, parseEther('300')))
    assert.equal(await vault.withdrawableOf(addr.alice), parseEther('300'))
    assert.equal(await vault.withdrawableOf(addr.bob), parseEther('100'))
    await wait(vault.distribute(parseEther('500'))) // owner 300, bob 200
    assert.equal(await vault.withdrawableOf(addr.alice), parseEther('300'))
    assert.equal(await vault.withdrawableOf(addr.bob), parseEther('300'))
    await wait(vault.connect(alice).claim())
    assert.equal(await payout.balanceOf(addr.alice), parseEther('300'))
    await reverts(vault.connect(alice).claim(), 'NothingToClaim', vaultI)
    await wait(vault.connect(bob).claim())
    await wait(vault.claim())
    assert.equal(await payout.balanceOf(vaultAddress), 0n, '분배금이 남거나 모자라지 않는다')
    assert.equal(await vault.totalDistributed(), parseEther('1500'))
  })
  await test('RWA 지분: 동결된 지갑은 지분을 주고받을 수 없다', async () => {
    await wait(guard.freeze(addr.bob, REASON))
    await reverts(vault.connect(bob).transfer(addr.alice, 1), 'TransferRestricted', vaultI)
    await reverts(vault.transfer(addr.bob, 1), 'TransferRestricted', vaultI)
    await wait(guard.unfreeze(addr.bob))
    await wait(vault.connect(bob).transfer(addr.alice, parseEther('1')))
    await reverts(vault.connect(alice).setGuard(ZeroAddress), 'NotIssuer', vaultI)
  })
  await test('RWA 지분: 승인 한도 안에서만 대리 이전', async () => {
    await wait(vault.connect(bob).approve(addr.alice, parseEther('5')))
    await reverts(vault.connect(alice).transferFrom(addr.bob, addr.carol, parseEther('6')), 'InsufficientAllowance', vaultI)
    await wait(vault.connect(alice).transferFrom(addr.bob, addr.carol, parseEther('5')))
    assert.equal(await vault.balanceOf(addr.carol), parseEther('5'))
    assert.equal(await vault.allowance(addr.bob, addr.alice), 0n)
  })

  /* ── BridgeGateway ── */
  const token = await deploy('TestToken')
  const tokenAddress = await token.getAddress()
  const bridge = await deploy('BridgeGateway', [addr.owner, [addr.relayerA, addr.relayerB], 2])
  const bridgeI = bridge.interface
  const bridgeAddress = await bridge.getAddress()
  const chainId = (await provider.getNetwork()).chainId
  const DST = 7707n
  // 서명은 주소 오름차순으로 낸다
  const sortedRelayers = [
    [addr.relayerA, relayerA],
    [addr.relayerB, relayerB],
  ].sort((x, y) => (BigInt(x[0]) < BigInt(y[0]) ? -1 : 1))
  // eth_sign은 접두를 붙여 서명하므로, 컨트랙트 다이제스트의 "접두 전" 해시를 직접 계산해 넘긴다
  const { AbiCoder, hashMessage } = require('ethers')
  const coder = AbiCoder.defaultAbiCoder()
  const claimInner = (src, transferId, tok, recipient, amount) =>
    keccak256(coder.encode(['bytes32', 'uint256', 'address', 'uint256', 'bytes32', 'address', 'address', 'uint256'], [id('MustsemBridgeClaim'), chainId, bridgeAddress, src, transferId, tok, recipient, amount]))
  const refundInner = (transferId) => keccak256(coder.encode(['bytes32', 'uint256', 'address', 'bytes32'], [id('MustsemBridgeRefund'), chainId, bridgeAddress, transferId]))
  const signInner = (inner, list = sortedRelayers) => Promise.all(list.map(async ([address]) => hre.network.provider.send('eth_sign', [address, inner])))

  let transferId
  await test('브릿지: 경로 설정과 조회, 꺼진 경로·범위 밖 금액 거절', async () => {
    await reverts(bridge.connect(alice).setRoute(DST, tokenAddress, true, 30, 1, parseEther('1000')), 'NotOwner', bridgeI)
    await reverts(bridge.setRoute(DST, tokenAddress, true, 1001, 1, parseEther('1000')), 'InvalidFee', bridgeI)
    await reverts(bridge.setRoute(chainId, tokenAddress, true, 30, 1, parseEther('1000')), 'RouteDisabled', bridgeI)
    await wait(token.mint(addr.alice, parseEther('500')))
    await wait(token.connect(alice).approve(bridgeAddress, parseEther('500')))
    await reverts(bridge.connect(alice).send(tokenAddress, parseEther('10'), DST, addr.bob), 'RouteDisabled', bridgeI)
    await wait(bridge.setRoute(DST, tokenAddress, true, 30, parseEther('1'), parseEther('100')))
    const route = await bridge.getRoute(DST, tokenAddress)
    assert.deepEqual([route.enabled, route.feeBps, route.minAmount, route.maxAmount], [true, 30n, parseEther('1'), parseEther('100')])
    await reverts(bridge.connect(alice).send(tokenAddress, parseEther('101'), DST, addr.bob), 'AmountOutOfRange', bridgeI)
    await reverts(bridge.connect(alice).send(tokenAddress, 1, DST, addr.bob), 'AmountOutOfRange', bridgeI)
  })
  await test('브릿지: 전송 요청 시 토큰 잠금, 수수료 계산, 상태 조회', async () => {
    const receipt = await wait(bridge.connect(alice).send(tokenAddress, parseEther('100'), DST, addr.bob))
    const event = receipt.logs.map((log) => bridgeI.parseLog(log)).find((log) => log?.name === 'TransferRequested')
    transferId = event.args.transferId
    assert.equal(event.args.amount, parseEther('99.7'))
    assert.equal(event.args.fee, parseEther('0.3'))
    assert.equal(await token.balanceOf(bridgeAddress), parseEther('100'))
    assert.equal(await bridge.accruedFees(tokenAddress), parseEther('0.3'))
    const stored = await bridge.getTransfer(transferId)
    assert.equal(stored.sender, addr.alice)
    assert.equal(stored.recipient, addr.bob)
    assert.equal(stored.status, 1n)
  })
  await test('브릿지: 수령은 릴레이어 정족수 서명 필요, 한 번만 가능', async () => {
    const src = 7601n
    const inboundId = id('inbound-1')
    const amount = parseEther('40')
    // 도착 체인 쪽 지급 재원 (출발 체인에서 잠긴 자산과 별개)
    await wait(token.mint(bridgeAddress, amount))
    const inner = claimInner(src, inboundId, tokenAddress, addr.carol, amount)
    assert.equal(await bridge.claimDigest(src, inboundId, tokenAddress, addr.carol, amount), hashMessage(getBytes(inner)))
    const signatures = await signInner(inner)
    await reverts(bridge.claim(src, inboundId, tokenAddress, addr.carol, amount, [signatures[0]]), 'NotEnoughSignatures', bridgeI)
    await reverts(bridge.claim(src, inboundId, tokenAddress, addr.carol, amount, [signatures[0], signatures[0]]), 'InvalidSignature', bridgeI)
    await reverts(bridge.claim(src, inboundId, tokenAddress, addr.carol, amount, [signatures[1], signatures[0]]), 'InvalidSignature', bridgeI)
    // 금액을 바꾸면 서명이 맞지 않는다
    await reverts(bridge.claim(src, inboundId, tokenAddress, addr.carol, amount + 1n, signatures), 'InvalidSignature', bridgeI)
    // 릴레이어가 아닌 사람의 서명
    const outsider = await hre.network.provider.send('eth_sign', [addr.alice, inner])
    await reverts(bridge.claim(src, inboundId, tokenAddress, addr.carol, amount, [outsider, signatures[1]]), 'InvalidSignature', bridgeI)
    await reverts(bridge.claim(src, inboundId, tokenAddress, addr.carol, amount, [signatures[1], outsider]), 'InvalidSignature', bridgeI)
    await wait(bridge.connect(carol).claim(src, inboundId, tokenAddress, addr.carol, amount, signatures))
    assert.equal(await token.balanceOf(addr.carol), amount)
    assert.equal(await bridge.isClaimed(src, inboundId), true)
    await reverts(bridge.claim(src, inboundId, tokenAddress, addr.carol, amount, signatures), 'AlreadyClaimed', bridgeI)
  })
  await test('브릿지: 환불은 릴레이어 환불 서명으로만, 수수료 포함 전액, 한 번만', async () => {
    await reverts(bridge.connect(alice).refund(transferId, []), 'NotEnoughSignatures', bridgeI)
    // 수령 서명을 환불에 재사용할 수 없다
    const wrong = await signInner(claimInner(7601n, transferId, tokenAddress, addr.alice, parseEther('100')))
    await reverts(bridge.refund(transferId, wrong), 'InvalidSignature', bridgeI)
    const before = await token.balanceOf(addr.alice)
    await wait(bridge.refund(transferId, await signInner(refundInner(transferId))))
    assert.equal((await token.balanceOf(addr.alice)) - before, parseEther('100'))
    assert.equal(await bridge.accruedFees(tokenAddress), 0n)
    assert.equal((await bridge.getTransfer(transferId)).status, 2n)
    await reverts(bridge.refund(transferId, await signInner(refundInner(transferId))), 'TransferNotPending', bridgeI)
  })
  await test('브릿지: 일시정지, 수수료만 인출, 정족수보다 적게 릴레이어를 줄일 수 없음', async () => {
    await wait(bridge.setPaused(true))
    await reverts(bridge.connect(alice).send(tokenAddress, parseEther('10'), DST, addr.bob), 'IsPaused', bridgeI)
    await wait(bridge.setPaused(false))
    await wait(bridge.connect(alice).send(tokenAddress, parseEther('10'), DST, addr.bob))
    await reverts(bridge.connect(alice).withdrawFees(tokenAddress, addr.alice), 'NotOwner', bridgeI)
    const before = await token.balanceOf(addr.owner)
    await wait(bridge.withdrawFees(tokenAddress, addr.owner))
    assert.equal((await token.balanceOf(addr.owner)) - before, parseEther('0.03'))
    await reverts(bridge.withdrawFees(tokenAddress, addr.owner), 'NothingToWithdraw', bridgeI)
    await reverts(bridge.setRelayer(addr.relayerA, false), 'InvalidThreshold', bridgeI)
    await reverts(bridge.setThreshold(3), 'InvalidThreshold', bridgeI)
  })

  /* ── CompositeExecutor ── */
  const executor = await deploy('CompositeExecutor', [addr.owner])
  const execI = executor.interface
  const target = await deploy('TestTarget')
  const targetAddress = await target.getAddress()
  const targetI = new Interface(artifact('TestTarget').abi)
  const call = (fn, args = [], value = 0n) => ({ target: targetAddress, value, data: targetI.encodeFunctionData(fn, args) })
  await test('복합 실행: 운영자만, 허용된 대상만 호출', async () => {
    await reverts(executor.connect(alice).execute([call('set', [1])], true), 'NotOperator', execI)
    await wait(executor.setOperator(addr.alice, true))
    await reverts(executor.connect(alice).execute([], true), 'EmptyBatch', execI)
    await reverts(executor.connect(alice).execute([call('set', [1])], true), 'TargetNotAllowed', execI)
    await reverts(executor.setTarget(await executor.getAddress(), true), 'ZeroAddress', execI)
    await wait(executor.setTarget(targetAddress, true))
    await wait(executor.connect(alice).execute([call('set', [1]), call('set', [5])], true))
    assert.equal(await target.value(), 5n)
    assert.equal(await executor.batchCount(), 1n)
  })
  await test('복합 실행: atomic이면 하나라도 실패 시 전부 되돌림', async () => {
    const parsed = await reverts(executor.connect(alice).execute([call('set', [9]), call('fail')], true), 'CallFailed', execI)
    assert.equal(parsed.args.index, 1n)
    assert.equal(await target.value(), 5n, '앞선 호출도 되돌려진다')
  })
  await test('복합 실행: atomic이 아니면 실패만 건너뛰고 결과를 돌려줌, 남은 코인 환불', async () => {
    const calls = [call('set', [7], parseEther('1')), call('fail'), call('set', [8])]
    const preview = await executor.connect(alice).execute.staticCall(calls, false, { value: parseEther('3') })
    assert.deepEqual(preview.map((r) => r.success), [true, false, true])
    assert.equal(targetI.decodeFunctionResult('set', preview[0].returnData)[0], 14n)
    await wait(executor.connect(alice).execute(calls, false, { value: parseEther('3') }))
    assert.equal(await target.value(), 8n)
    assert.equal(await target.received(), parseEther('1'))
    assert.equal(await provider.getBalance(await executor.getAddress()), 0n, '실행기에 코인이 남지 않는다')
    await reverts(executor.connect(alice).execute([call('set', [1], parseEther('2'))], true, { value: parseEther('1') }), 'ValueMismatch', execI)
  })
  await test('복합 실행: simulate는 결과를 돌려주고 상태를 남기지 않음', async () => {
    const parsed = await reverts(executor.connect(alice).simulate.staticCall([call('set', [99]), call('fail')]), 'Simulation', execI)
    assert.deepEqual(parsed.args.results.map((r) => r.success), [true, false])
    assert.equal(await target.value(), 8n)
  })

  // 배포·연동에 쓰는 ABI와 바이트코드를 내보낸다
  const out = path.join(__dirname, '..', 'artifacts')
  fs.mkdirSync(out, { recursive: true })
  for (const name of CONTRACTS) {
    const a = artifact(name)
    fs.writeFileSync(
      path.join(out, `${name}.json`),
      `${JSON.stringify({ contractName: name, compiler: 'solc 0.8.24, optimizer 200 runs, evmVersion london', abi: a.abi, bytecode: a.bytecode }, null, 2)}\n`,
    )
    console.log(`      ${name}: ${(a.deployedBytecode.length - 2) / 2} bytes`)
  }

  await test('배포 스크립트: 내보낸 ABI·바이트코드로 배포, 관리자와 정책 설정', async () => {
    const { deployAll } = require('../scripts/deploy.cjs')
    const deployed = await deployAll(owner, { owner: addr.bob, relayers: [addr.relayerA, addr.relayerB, addr.carol] })
    assert.deepEqual(Object.keys(deployed).sort(), ['BridgeGateway', 'ComplianceGuard', 'CompositeExecutor', 'DIDRegistry', 'PriceOracle'])
    for (const address of Object.values(deployed)) assert.notEqual(await provider.getCode(address), '0x')
    const at = (name) => new (require('ethers').Contract)(deployed[name], artifact(name).abi, provider)
    assert.equal(await at('PriceOracle').owner(), addr.bob)
    assert.equal(await at('ComplianceGuard').autoFreezeScore(), 80n)
    assert.equal(await at('ComplianceGuard').autoBlacklistScore(), 95n)
    assert.equal(await at('BridgeGateway').threshold(), 2n, '릴레이어 3명의 과반')
    const withoutBridge = await deployAll(owner, {})
    assert.equal(withoutBridge.BridgeGateway, undefined, '릴레이어가 없으면 브릿지는 배포하지 않는다')
    await assert.rejects(deployAll(owner, { relayers: [addr.relayerA], threshold: 2 }))
  })

  const passed = results.filter(Boolean).length
  console.log(`\n${passed}/${results.length} passed`)
  process.exit(passed === results.length ? 0 : 1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
