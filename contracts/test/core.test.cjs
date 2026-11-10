// 기본 컨트랙트(NFT, SBT, RWA, wMST, 스테이킹) 테스트: cd contracts && npm test
// Hardhat 내장 체인에서 실행한다. 사이트가 쓰는 ABI(src/config/contracts.ts)와 맞는지도 함께 확인한다.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const hre = require('hardhat')
const { BrowserProvider, ContractFactory, Interface, parseEther, ZeroAddress } = require('ethers')

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

const CORE = ['NFTVault', 'SBTVault', 'RWAToken', 'WrappedMST', 'MSTStaking']

/** 사이트가 실제로 부르는 함수·이벤트 (src/config/contracts.ts와 같아야 한다) */
const SITE_ABI = {
  NFTVault: [
    'function mintNFT(address to, string label, string metadata) returns (uint256)',
    'function nextTokenId() view returns (uint256)',
    'function ownerOf(uint256 tokenId) view returns (address)',
    'function nftInfo(uint256 tokenId) view returns (string label, string metadata)',
    'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
    'error ERC721NonexistentToken(uint256 tokenId)',
    'error ERC721InvalidReceiver(address receiver)',
  ],
  SBTVault: [
    'function mintSBT(address to, string label, address guardian, uint256 unlockTime, string metadata) returns (uint256)',
    'function sbts(uint256 tokenId) view returns (address guardian, uint256 unlockTime, string metadata)',
    'function isUnlocked(uint256 tokenId) view returns (bool)',
    'function ownerOf(uint256 tokenId) view returns (address)',
    'event Minted(uint256 indexed tokenId, address indexed to, string label, address guardian, uint256 unlockTime, string metadata)',
    'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
  ],
  RWAToken: [
    'function mintRWA(address to, string cid) returns (uint256)',
    'function nextId() view returns (uint256)',
    'function ownerOf(uint256 tokenId) view returns (address)',
    'function tokenURI(uint256 tokenId) view returns (string)',
    'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
  ],
  WrappedMST: [
    'function deposit() payable',
    'function withdraw(uint256 amount)',
    'function balanceOf(address owner) view returns (uint256)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)',
  ],
  MSTStaking: [
    'function stake(uint256 amount)',
    'function withdraw(uint256 amount)',
    'function claim()',
    'function exit()',
    'function pendingReward(address user) view returns (uint256)',
    'function stakes(address user) view returns (uint256 amount, uint256 accrued, uint256 lastUpdate, uint256 lastClaimTime)',
    'function minClaimInterval() view returns (uint256)',
  ],
}

async function main() {
  await hre.run('compile', { quiet: true })
  const provider = new BrowserProvider(hre.network.provider, undefined, { cacheTimeout: -1 })
  const [owner, alice, bob, carol] = await Promise.all([0, 1, 2, 3].map((i) => provider.getSigner(i)))
  const addr = { owner: await owner.getAddress(), alice: await alice.getAddress(), bob: await bob.getAddress(), carol: await carol.getAddress() }
  const artifact = (name) => hre.artifacts.readArtifactSync(name)
  const deploy = async (name, args = []) => {
    const a = artifact(name)
    const contract = await new ContractFactory(a.abi, a.bytecode, owner).deploy(...args)
    await contract.waitForDeployment()
    return contract
  }
  const now = async () => (await provider.getBlock('latest')).timestamp
  const increase = async (seconds) => {
    await hre.network.provider.send('evm_increaseTime', [seconds])
    await hre.network.provider.send('evm_mine')
  }
  const wait = async (txPromise) => (await txPromise).wait()
  const DAY = 86_400

  await test('사이트 ABI와 일치: 사이트가 부르는 함수·이벤트가 모두 컴파일 결과에 있다', async () => {
    for (const name of CORE) {
      const compiled = new Interface(artifact(name).abi)
      new Interface(SITE_ABI[name]).forEachFunction((fn) => {
        const match = compiled.getFunction(fn.selector)
        assert.ok(match, `${name}.${fn.format()} 없음`)
        assert.equal(match.format('sighash'), fn.format('sighash'))
        assert.deepEqual(match.outputs.map((o) => o.type), fn.outputs.map((o) => o.type), `${name}.${fn.name} 반환 형식`)
        assert.equal(match.stateMutability, fn.stateMutability, `${name}.${fn.name} 상태 변경`)
      })
      new Interface(SITE_ABI[name]).forEachEvent((event) => assert.ok(compiled.getEvent(event.topicHash), `${name} 이벤트 ${event.name} 없음`))
      new Interface(SITE_ABI[name]).forEachError((error) => assert.ok(compiled.getError(error.selector), `${name} 오류 ${error.name} 없음`))
    }
  })

  /* ── NFT ── */
  const nft = await deploy('NFTVault')
  const nftI = nft.interface
  await test('NFT: 누구나 발행, 번호는 1부터, 이름표·메타데이터 조회', async () => {
    assert.equal(await nft.nextTokenId(), 1n)
    const receipt = await wait(nft.connect(alice).mintNFT(addr.bob, '한글 이름표', '{"a":1}'))
    const transfer = receipt.logs.map((log) => nftI.parseLog(log)).find((log) => log?.name === 'Transfer')
    assert.equal(transfer.args.tokenId, 1n)
    assert.equal(transfer.args.from, ZeroAddress)
    assert.equal(await nft.ownerOf(1), addr.bob)
    assert.deepEqual([...(await nft.nftInfo(1))], ['한글 이름표', '{"a":1}'])
    assert.equal(await nft.nextTokenId(), 2n)
    await reverts(nft.mintNFT(addr.bob, '', '{}'), 'EmptyLabel', nftI)
    await reverts(nft.mintNFT(ZeroAddress, 'x', '{}'), 'ERC721InvalidReceiver', nftI)
    await reverts(nft.nftInfo(99), 'ERC721NonexistentToken', nftI)
    await reverts(nft.ownerOf(99), 'ERC721NonexistentToken', nftI)
  })
  await test('NFT: 보유자만 이전', async () => {
    await reverts(nft.connect(alice).transferFrom(addr.bob, addr.alice, 1), 'ERC721InsufficientApproval', nftI)
    await wait(nft.connect(bob).transferFrom(addr.bob, addr.carol, 1))
    assert.equal(await nft.ownerOf(1), addr.carol)
  })

  /* ── SBT ── */
  const sbt = await deploy('SBTVault')
  const sbtI = sbt.interface
  await test('SBT: 발급과 조회, 영구 귀속(unlockTime 0)은 이전 불가', async () => {
    const receipt = await wait(sbt.connect(alice).mintSBT(addr.bob, '수료증', addr.carol, 0, '{}'))
    const minted = receipt.logs.map((log) => sbtI.parseLog(log)).find((log) => log?.name === 'Minted')
    assert.deepEqual([minted.args.tokenId, minted.args.to, minted.args.label, minted.args.guardian, minted.args.unlockTime], [1n, addr.bob, '수료증', addr.carol, 0n])
    assert.equal(await sbt.ownerOf(1), addr.bob)
    const soul = await sbt.sbts(1)
    assert.deepEqual([soul.guardian, soul.unlockTime, soul.metadata], [addr.carol, 0n, '{}'])
    assert.equal(await sbt.isUnlocked(1), false)
    assert.equal(await sbt.labelOf(1), '수료증')
    await reverts(sbt.connect(bob).transferFrom(addr.bob, addr.alice, 1), 'Soulbound', sbtI)
    await wait(sbt.connect(bob).approve(addr.alice, 1))
    await reverts(sbt.connect(alice).transferFrom(addr.bob, addr.alice, 1), 'Soulbound', sbtI)
    await reverts(sbt.connect(bob)['safeTransferFrom(address,address,uint256)'](addr.bob, addr.alice, 1), 'Soulbound', sbtI)
    await reverts(sbt.mintSBT(addr.bob, '수료증', ZeroAddress, 0, '{}'), 'ZeroGuardian', sbtI)
    await reverts(sbt.mintSBT(addr.bob, '', addr.carol, 0, '{}'), 'EmptyLabel', sbtI)
  })
  await test('SBT: 잠금 시각이 지나면 이전 가능', async () => {
    const unlock = (await now()) + 1000
    await wait(sbt.mintSBT(addr.bob, '기간제', addr.carol, unlock, '{}'))
    assert.equal(await sbt.isUnlocked(2), false)
    await reverts(sbt.connect(bob).transferFrom(addr.bob, addr.alice, 2), 'Soulbound', sbtI)
    await increase(1001)
    assert.equal(await sbt.isUnlocked(2), true)
    await wait(sbt.connect(bob).transferFrom(addr.bob, addr.alice, 2))
    assert.equal(await sbt.ownerOf(2), addr.alice)
    assert.equal(await sbt.isUnlocked(1), false, '영구 귀속은 시간이 지나도 그대로')
  })
  await test('SBT: 가디언만 폐기, 가디언도 이전은 불가', async () => {
    await reverts(sbt.connect(carol).transferFrom(addr.bob, addr.carol, 1), 'Soulbound', sbtI)
    await reverts(sbt.connect(bob).revoke(1), 'NotGuardian', sbtI)
    await reverts(sbt.connect(alice).revoke(1), 'NotGuardian', sbtI)
    await wait(sbt.connect(carol).revoke(1))
    await reverts(sbt.ownerOf(1), 'ERC721NonexistentToken', sbtI)
    await reverts(sbt.connect(carol).revoke(1), 'ERC721NonexistentToken', sbtI)
  })

  /* ── RWA ── */
  const rwa = await deploy('RWAToken')
  const rwaI = rwa.interface
  await test('RWA: CID를 담아 발행, tokenURI는 넣은 값 그대로', async () => {
    assert.equal(await rwa.nextId(), 1n)
    const cid = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'
    await wait(rwa.connect(alice).mintRWA(addr.bob, cid))
    assert.equal(await rwa.ownerOf(1), addr.bob)
    assert.equal(await rwa.tokenURI(1), cid)
    assert.equal(await rwa.nextId(), 2n)
    await reverts(rwa.mintRWA(addr.bob, ''), 'EmptyCid', rwaI)
    await reverts(rwa.tokenURI(9), 'ERC721NonexistentToken', rwaI)
    await wait(rwa.connect(bob).transferFrom(addr.bob, addr.carol, 1))
    assert.equal(await rwa.ownerOf(1), addr.carol)
  })

  /* ── wMST ── */
  const wmst = await deploy('WrappedMST')
  const wmstI = wmst.interface
  const wmstAddress = await wmst.getAddress()
  await test('wMST: MST를 넣으면 같은 수량의 wMST, 빼면 MST를 돌려받음', async () => {
    await wait(wmst.connect(alice).deposit({ value: parseEther('10') }))
    assert.equal(await wmst.balanceOf(addr.alice), parseEther('10'))
    assert.equal(await wmst.totalSupply(), parseEther('10'))
    assert.equal(await provider.getBalance(wmstAddress), parseEther('10'))
    await wait(alice.sendTransaction({ to: wmstAddress, value: parseEther('2') }))
    assert.equal(await wmst.balanceOf(addr.alice), parseEther('12'), '코인을 그냥 보내도 래핑')
    const before = await provider.getBalance(addr.alice)
    const receipt = await wait(wmst.connect(alice).withdraw(parseEther('5')))
    const gas = receipt.gasUsed * receipt.gasPrice
    assert.equal((await provider.getBalance(addr.alice)) - before + gas, parseEther('5'))
    assert.equal(await wmst.balanceOf(addr.alice), parseEther('7'))
    assert.equal(await wmst.totalSupply(), parseEther('7'))
    await reverts(wmst.connect(alice).withdraw(parseEther('8')), 'InsufficientBalance', wmstI)
    await reverts(wmst.connect(bob).withdraw(1), 'InsufficientBalance', wmstI)
  })
  await test('wMST: 전송과 승인 한도', async () => {
    await wait(wmst.connect(alice).transfer(addr.bob, parseEther('1')))
    assert.equal(await wmst.balanceOf(addr.bob), parseEther('1'))
    await reverts(wmst.connect(carol).transferFrom(addr.alice, addr.carol, 1), 'InsufficientAllowance', wmstI)
    await wait(wmst.connect(alice).approve(addr.carol, parseEther('2')))
    assert.equal(await wmst.allowance(addr.alice, addr.carol), parseEther('2'))
    await reverts(wmst.connect(carol).transferFrom(addr.alice, addr.carol, parseEther('3')), 'InsufficientAllowance', wmstI)
    await wait(wmst.connect(carol).transferFrom(addr.alice, addr.carol, parseEther('2')))
    assert.equal(await wmst.allowance(addr.alice, addr.carol), 0n)
    await reverts(wmst.connect(alice).transfer(ZeroAddress, 1), 'ZeroAddress', wmstI)
    assert.equal(await wmst.totalSupply(), await provider.getBalance(wmstAddress), '총량 = 보관한 MST')
  })

  /* ── 스테이킹 (연 2%, 수령 간격 7일) ── */
  const staking = await deploy('MSTStaking', [addr.owner, wmstAddress, 200, 7 * DAY])
  const stakingI = staking.interface
  const stakingAddress = await staking.getAddress()
  const near = (actual, expected, tolerance = parseEther('0.0001')) => {
    const diff = actual > expected ? actual - expected : expected - actual
    assert.ok(diff <= tolerance, `expected about ${expected}, got ${actual}`)
  }
  await test('스테이킹: 조건 조회, 승인 없이는 예치 불가, 0 예치 거절', async () => {
    assert.equal(await staking.minClaimInterval(), BigInt(7 * DAY))
    assert.equal(await staking.aprBps(), 200n)
    await wait(wmst.connect(bob).deposit({ value: parseEther('1000') })) // bob: 1001 wMST
    await reverts(staking.connect(bob).stake(0), 'ZeroAmount', stakingI)
    await reverts(staking.connect(bob).stake(parseEther('100')), 'InsufficientAllowance', wmstI)
    await wait(wmst.connect(bob).approve(stakingAddress, parseEther('1000')))
    await wait(staking.connect(bob).stake(parseEther('1000')))
    const position = await staking.stakes(addr.bob)
    assert.equal(position.amount, parseEther('1000'))
    assert.equal(position.lastClaimTime, 0n)
    assert.equal(await staking.totalStaked(), parseEther('1000'))
    assert.equal(await wmst.balanceOf(stakingAddress), parseEther('1000'))
  })
  await test('스테이킹: 연 2% 단리로 보상이 쌓임', async () => {
    await increase(365 * DAY)
    near(await staking.pendingReward(addr.bob), parseEther('20'))
    assert.equal(await staking.pendingReward(addr.alice), 0n)
  })
  await test('스테이킹: 보상 재원이 없으면 수령 불가, 그래도 원금은 인출 가능', async () => {
    await reverts(staking.connect(bob).claim(), 'RewardPoolInsufficient', stakingI)
    await wait(staking.connect(bob).withdraw(parseEther('400')))
    assert.equal(await wmst.balanceOf(addr.bob), parseEther('401'))
    assert.equal((await staking.stakes(addr.bob)).amount, parseEther('600'))
    await reverts(staking.connect(bob).withdraw(parseEther('601')), 'InsufficientStake', stakingI)
  })
  await test('스테이킹: 재원을 넣으면 수령, 7일 안에는 다시 못 받음', async () => {
    await wait(owner.sendTransaction({ to: stakingAddress, value: parseEther('100') }))
    const before = await provider.getBalance(addr.bob)
    const receipt = await wait(staking.connect(bob).claim())
    const gas = receipt.gasUsed * receipt.gasPrice
    near((await provider.getBalance(addr.bob)) - before + gas, parseEther('20'))
    const position = await staking.stakes(addr.bob)
    assert.equal(position.accrued, 0n)
    assert.ok(position.lastClaimTime > 0n)
    await increase(3 * DAY)
    const parsed = await reverts(staking.connect(bob).claim(), 'ClaimTooEarly', stakingI)
    assert.equal(parsed.args.availableAt, position.lastClaimTime + BigInt(7 * DAY))
    await increase(4 * DAY + 1)
    await wait(staking.connect(bob).claim()) // 600 wMST × 2% × 7일
    await reverts(staking.connect(alice).claim(), 'NothingToClaim', stakingI)
  })
  await test('스테이킹: exit은 원금 전부 + 받을 수 있는 보상, 간격 전이면 원금만', async () => {
    await increase(2 * DAY)
    const pending = await staking.pendingReward(addr.bob)
    assert.ok(pending > 0n)
    await wait(staking.connect(bob).exit()) // 마지막 수령 뒤 2일: 원금만
    assert.equal((await staking.stakes(addr.bob)).amount, 0n)
    assert.equal(await wmst.balanceOf(addr.bob), parseEther('1001'))
    near(await staking.pendingReward(addr.bob), pending, parseEther('0.001'))
    assert.equal(await staking.totalStaked(), 0n)
    await increase(5 * DAY + 1)
    const before = await provider.getBalance(addr.bob)
    const receipt = await wait(staking.connect(bob).claim())
    assert.ok((await provider.getBalance(addr.bob)) - before + receipt.gasUsed * receipt.gasPrice > 0n)
    assert.equal(await staking.pendingReward(addr.bob), 0n, '원금이 없으면 더 쌓이지 않는다')
    assert.equal(await staking.totalAccrued(), 0n)
  })
  await test('스테이킹: 관리자는 재원만 넣고 뺄 수 있고, 쌓인 보상만큼은 남겨야 함', async () => {
    await wait(wmst.connect(alice).approve(stakingAddress, parseEther('4')))
    await wait(staking.connect(alice).stake(parseEther('4')))
    await increase(365 * DAY)
    await wait(staking.connect(alice).withdraw(parseEther('1'))) // 정산: 약 0.08 MST가 alice 몫으로 확정
    const reserved = await staking.totalAccrued()
    near(reserved, parseEther('0.08'))
    const pool = await provider.getBalance(stakingAddress)
    await reverts(staking.connect(alice).withdrawRewardPool(addr.alice, 1), 'NotOwner', stakingI)
    await reverts(staking.withdrawRewardPool(addr.owner, pool), 'RewardPoolInsufficient', stakingI)
    await wait(staking.withdrawRewardPool(addr.owner, pool - reserved))
    assert.equal(await provider.getBalance(stakingAddress), reserved)
    // 인출 뒤에도 보상은 계속 쌓인다. 재원이 그만큼 모자라면 수령만 막히고(원금은 무관), 다시 채우면 받는다
    await reverts(staking.connect(alice).claim(), 'RewardPoolInsufficient', stakingI)
    await wait(owner.sendTransaction({ to: stakingAddress, value: parseEther('1') }))
    await wait(staking.connect(alice).claim())
    assert.equal(await wmst.balanceOf(stakingAddress), parseEther('3'), '원금(wMST)은 재원 인출과 무관하게 그대로')
  })

  const out = path.join(__dirname, '..', 'artifacts')
  fs.mkdirSync(out, { recursive: true })
  for (const name of CORE) {
    const a = artifact(name)
    fs.writeFileSync(
      path.join(out, `${name}.json`),
      `${JSON.stringify({ contractName: name, compiler: 'solc 0.8.24, optimizer 200 runs, evmVersion london', abi: a.abi, bytecode: a.bytecode }, null, 2)}\n`,
    )
    console.log(`      ${name}: ${(a.deployedBytecode.length - 2) / 2} bytes`)
  }

  const passed = results.filter(Boolean).length
  console.log(`\n${passed}/${results.length} passed`)
  process.exit(passed === results.length ? 0 : 1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
