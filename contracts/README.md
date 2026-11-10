# MUSTSEM 확장 스마트 컨트랙트

API 카탈로그 확장분(33종 → 50종)의 온체인 부분입니다. 사이트 빌드(`npm run build`)와는 별개인 하위 프로젝트이고,
사이트는 `artifacts/`의 ABI만 참고합니다.

| 컨트랙트 | 역할 | 관련 API |
| --- | --- | --- |
| `PriceOracle.sol` | 오라클 가격 피드. 허가된 리포터가 라운드 단위로 가격 기록, heartbeat 지나면 stale | `/v1/oracle/*` 4종 |
| `DIDRegistry.sol` | DID 등록·조회, 자격증명(해시) 발급·검증·폐기 | `/v1/did/*` 5종 |
| `BridgeGateway.sol` | 크로스체인 전송. 잠금 → 릴레이어 정족수 서명 → 수령, 환불도 서명으로만 | `/v1/bridge/*` 4종 |
| `RWAVault.sol` | RWA 지분(ERC-20)과 수익 분배. 지분을 넘겨도 이미 쌓인 수익은 원래 보유자 몫 | `/v1/rwa/distribute`, `/v1/rwa/holders` |
| `CompositeExecutor.sol` | 여러 컨트랙트 호출을 한 트랜잭션으로(전부 성공 또는 전부 취소), 실행 전 시뮬레이션 | `/v1/composite/*` 2종 |
| `ComplianceGuard.sol` | 이상거래 대응. 탐지 점수에 따라 지갑 자동 동결·블랙리스트, 토큰이 전송 전에 조회 | 이상거래 탐지 자동 대응 |

`src/mocks/`는 테스트 전용이며 배포하지 않습니다.

## 현재 상태

- 컴파일(solc 0.8.24, optimizer 200, evmVersion london)과 테스트 통과. **어느 네트워크에도 아직 배포하지 않았습니다.**
- 외부 보안 감사는 받지 않았습니다. 실제 자산을 다루는 `BridgeGateway`와 `RWAVault`는 운영 배포 전에 감사를 권합니다.
- 배포 주소가 `src/config/contracts.ts`에 들어가기 전까지 사이트의 해당 조회 API는 `contract_not_deployed`로 응답합니다.

## 테스트

```bash
cd contracts
npm install        # hardhat, ethers (이 하위 프로젝트 전용. 사이트의 package.json은 바꾸지 않는다)
npm test           # Hardhat 내장 체인에서 24개 항목, 끝나면 artifacts/*.json을 다시 쓴다
```

테스트가 확인하는 것: 권한(관리자·리포터·운영자·탐지기·컨트롤러), 중복·역순·만료 처리, 서명 정족수와 재사용 방지,
이중 수령·이중 환불 차단, 수익 분배 정산(남거나 모자라지 않음), 동결 지갑 전송 차단, 복합 실행의 원자성.

## 배포

```bash
cd contracts
RPC_URL=https://block.mustree.kr PRIVATE_KEY=0x... DRY_RUN=1 node scripts/deploy.cjs   # 계획만 확인
RPC_URL=https://block.mustree.kr PRIVATE_KEY=0x... node scripts/deploy.cjs
```

위는 bash(Git Bash, macOS, Linux) 문법입니다. Windows PowerShell에서는 환경변수를 먼저 정한 뒤 실행합니다.

```powershell
cd contracts
$env:RPC_URL = "https://block.mustree.kr"
# 개인키를 화면과 명령 기록에 남기지 않고 입력받는다
$secure = Read-Host "PRIVATE_KEY" -AsSecureString
$env:PRIVATE_KEY = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
$env:DRY_RUN = "1"; node scripts/deploy.cjs        # 계획만 확인
Remove-Item Env:DRY_RUN; node scripts/deploy.cjs   # 실제 배포
Remove-Item Env:PRIVATE_KEY                        # 끝나면 지운다
```

- 개인키는 환경변수로만 넘기고 저장소·문서에 남기지 않습니다. `OWNER`를 주면 관리자 권한은 그 주소(멀티시그 권장)로 갑니다.
- `RELAYERS`(쉼표 구분 주소)를 줄 때만 `BridgeGateway`를 배포합니다. 정족수 기본값은 과반입니다.
- 출력된 주소를 `src/config/contracts.ts`의 `PRICE_ORACLE_CONTRACTS` 등 해당 네트워크 칸에 넣고 사이트를 다시 배포합니다.

배포 뒤 설정(관리자 지갑으로 실행):

1. `PriceOracle.setReporter(리포터, true)`, `registerFeed("MST/KRW", 2, 3600)` 후 리포터가 `submit`
2. `ComplianceGuard.setDetector(탐지 서버 지갑, true)`, 필요하면 `setOperator`
3. `CompositeExecutor.setOperator`, `setTarget(호출을 허용할 컨트랙트, true)`
4. `BridgeGateway.setRoute(도착 체인 ID, 토큰, true, 수수료bps, 최소, 최대)`, 도착 체인 쪽 지급 재원 예치

`RWAVault`는 자산마다 배포합니다. 생성자:
`(이름, 기호, RWA NFT 컨트랙트, 토큰 ID, 지분 총량(18자리), 발행인, 수익 지급 토큰, ComplianceGuard 주소 또는 0)`
