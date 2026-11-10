# 회원 시스템 (Amazon Cognito + DynamoDB) 운영 안내

회원가입, 로그인, 내 정보, 관리자 회원 관리를 AWS에 실제로 저장하는 구성입니다.
코드는 이 저장소에 모두 있고, AWS 리소스는 `infra/aws/members-stack.yaml`(CloudFormation) 한 번 배포로 만듭니다.

> CloudFormation 스택 `mustsem-members`는 서울 리전에 만들어졌습니다(4-1 완료). 앱 코드는 아직 로컬
> 에뮬레이터(cognito-local, dynalite)로만 검증했으므로, 4-2부터 진행한 뒤 "6. 배포 후 확인"을 꼭 실행해 주세요.

## 1. 구조

```
브라우저 ──(같은 사이트 /api/*, httpOnly 쿠키)──▶ Next.js 서버 (Amplify Hosting SSR 컴퓨트)
                                                  │  공개 API: SignUp · ConfirmSignUp · InitiateAuth · ForgotPassword …
                                                  ├──────────────▶ Amazon Cognito 사용자 풀 (비밀번호·이메일 인증·토큰)
                                                  │  IAM 컴퓨트 역할 (최소 권한)
                                                  ├──────────────▶ Cognito Admin API (비활성화·삭제·세션 폐기)
                                                  └──────────────▶ DynamoDB  mustsem-members / mustsem-member-audit
```

- 별도 Lambda·API Gateway를 두지 않고, 이미 Amplify에서 돌고 있는 Next.js Route Handler(`/api/agent`와 같은 방식)를 백엔드로 씁니다.
- 브라우저는 토큰을 보지 못합니다. 액세스·리프레시 토큰은 `HttpOnly; SameSite=Lax; Secure; Path=/api` 쿠키에만 있습니다.
- AWS 액세스 키는 어디에도 저장하지 않습니다. 서버는 Amplify **컴퓨트 역할**의 임시 자격 증명을 씁니다.
- 비밀번호는 Cognito만 갖고 있습니다(DynamoDB에는 비밀번호·토큰이 없습니다).

### 권한 판단

요청마다 서버가 ① 액세스 토큰 서명·만료·클라이언트 ID 검증(`aws-jwt-verify`) → ② DynamoDB에서 프로필을 **다시 읽어**
`status`와 `role`을 판단합니다. 그래서

- 관리자가 비활성화하면 이미 로그인한 기기도 **다음 요청부터** 차단됩니다(쿠키 삭제, 403 `disabled`).
  동시에 Cognito 계정을 비활성화(새 로그인·토큰 갱신 거절)하고 리프레시 토큰을 모두 폐기합니다.
- 역할은 토큰에 들어 있지 않아 토큰을 조작해도 권한이 바뀌지 않습니다. 권한 변경도 다음 요청부터 바로 반영됩니다.
- 회원가입 API와 내 정보 수정 API는 `role`·`status`·`email` 입력을 읽지 않습니다. 관리자 지정은 관리자 API(관리자만)
  또는 운영자 PC의 스크립트로만 가능합니다.
- 관리자는 자기 자신을 비활성화·강등·삭제할 수 없습니다(마지막 관리자가 잠기는 일 방지).
- 상태를 바꾸는 요청은 같은 사이트 `Origin`과 `application/json` 본문만 받습니다(CSRF 방어).

## 2. 저장 위치와 데이터 구조

| 위치 | 내용 |
| --- | --- |
| Cognito 사용자 풀 `mustsem-members` (ap-northeast-2) | 이메일(로그인 ID, 대소문자 무시), 비밀번호 해시, 이메일 인증 여부, `name`, 계정 사용 여부 |
| DynamoDB `mustsem-members` (PK `userId`) | 회원 프로필. 역할·상태의 원본 |
| DynamoDB `mustsem-member-audit` (PK `targetUserId`, SK `at`) | 관리자 작업 기록 |

회원 프로필 항목:

| 속성 | 설명 |
| --- | --- |
| `userId` | Cognito `sub` (회원 고유 ID) |
| `name` | 이름 |
| `email` | 이메일·로그인 ID (소문자) |
| `role` | `USER` / `ADMIN` (가입 시 항상 `USER`) |
| `status` | `ACTIVE` / `DISABLED` |
| `emailVerified` | 이메일 인증 완료 여부 |
| `company`, `marketingAgreed` | 가입 화면의 회사명(선택)·마케팅 수신 동의 |
| `createdAt` / `updatedAt` / `lastLoginAt` | 가입일 / 정보 수정일 / 최근 로그인 (ISO 8601, UTC) |

작업 기록 항목: `at`(시각#난수), `action`(`member.disable` · `member.enable` · `member.role` · `member.delete` · `member.migrate`),
`actorId`, `actorEmail`, `targetEmail`, `detail`. 기록 저장이 실패해도 같은 내용이 서버 로그(CloudWatch)에 남습니다.

### 가입 단계별 일관성

1. Cognito `SignUp` (중복 이메일은 Cognito가 거절) → 2. DynamoDB 프로필 생성(`USER`, 인증 대기)
→ 3. 이메일 코드 확인(`ConfirmSignUp`) → 4. 로그인.

2가 실패해도 3과 4가 같은 프로필을 **없을 때만** 다시 만듭니다(조건부 쓰기). 그래서 로그인할 수 있는 계정에는 언제나 프로필이 있습니다.
1이 실패하면 아무것도 저장되지 않습니다. 삭제는 Cognito 계정 → 프로필 순서이고 다시 실행해도 안전합니다.

## 3. 사전 확인 (기존 리소스와 충돌 여부)

배포 전에 아래를 실행해 같은 이름이 없는지 확인하세요. 이 스택은 기존 리소스를 수정하거나 지우지 않습니다.
`AppName`·테이블 이름 매개변수로 다른 이름을 쓸 수 있습니다.

```bash
export AWS_REGION=ap-northeast-2
aws sts get-caller-identity                                   # 올바른 계정인지
aws amplify list-apps --query 'apps[].{name:name,id:appId,domain:defaultDomain,computeRole:computeRoleArn}'
aws cognito-idp list-user-pools --max-results 60 --query 'UserPools[].{name:Name,id:Id}'
aws dynamodb list-tables
aws iam get-role --role-name mustsem-amplify-compute 2>/dev/null && echo "역할 이름이 이미 있음"
aws iam list-policies --scope Local --query "Policies[?PolicyName=='mustsem-members-access']"
```

- Amplify 앱에 **이미 컴퓨트 역할**(`computeRoleArn`)이 있으면, 새 역할을 만들지 말고 `ExistingComputeRoleName`에 그 역할 이름을 넣으세요.
  정책만 그 역할에 붙습니다. 컴퓨트 역할은 앱당 하나라 바꾸면 기존 SSR 코드의 AWS 권한이 달라집니다.
- 기존 회원은 Supabase에 있습니다. 이 구성은 Supabase를 **읽기만** 하고 지우지 않습니다("7. 기존 회원 이전").

## 4. 배포 순서

### 4-1. 리소스 만들기

```bash
aws cloudformation deploy \
  --stack-name mustsem-members \
  --template-file infra/aws/members-stack.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --region ap-northeast-2
  # 기존 컴퓨트 역할이 있으면: --parameter-overrides ExistingComputeRoleName=<역할 이름>
  # 운영 메일(SES)을 쓰면:     --parameter-overrides SesIdentityArn=arn:aws:ses:... SesFromAddress='MUSTSEM <no-reply@mustsem.co.kr>'

aws cloudformation describe-stacks --stack-name mustsem-members --region ap-northeast-2 --query 'Stacks[0].Outputs'
```

배포에 필요한 권한: `cloudformation:*`(이 스택), `cognito-idp:CreateUserPool*`, `dynamodb:CreateTable`·`UpdateContinuousBackups`,
`iam:CreateRole`·`CreatePolicy`·`AttachRolePolicy`·`PassRole`, `amplify:UpdateApp`.

데이터 리소스(사용자 풀·두 테이블)에는 `DeletionPolicy: Retain`과 삭제 보호가 걸려 있어, 스택을 지워도 회원 데이터는 남습니다.
두 테이블은 시점 복구(PITR)가 켜져 있습니다.

### 4-2. 컴퓨트 역할 연결 (새 역할을 만든 경우)

운영 브랜치(main)에 영향을 주지 않으려면 먼저 **브랜치 단위**로 연결합니다.

```bash
# 이 브랜치에만 (권장: 검증이 끝날 때까지)
aws amplify update-branch --app-id <Amplify 앱 ID> --branch-name feature/aws-members \
  --compute-role-arn <출력 ComputeRoleArn> --region ap-northeast-2

# 앱 전체(모든 브랜치)에 연결할 때
aws amplify update-app --app-id <Amplify 앱 ID> --compute-role-arn <출력 ComputeRoleArn> --region ap-northeast-2
```

콘솔: Amplify → 앱 → App settings → **IAM roles** → Compute role (Default role = 앱 전체, 아래 표에서 브랜치별 지정).
역할은 재배포 없이 바로 적용됩니다.

### 4-3. 앱에 리소스 ID 알려 주기

둘 중 하나:

- **(권장) 저장소에 넣기**: `src/config/aws.ts`의 `userPoolId`, `clientId`에 출력값을 넣고 커밋. 비밀값이 아니라 식별자입니다.
  Amplify 빌드 설정을 건드릴 필요가 없습니다.
- **환경변수**: Amplify 콘솔 → Hosting → Environment variables에 `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`
  (테이블 이름을 바꿨다면 `MEMBERS_TABLE`, `MEMBERS_AUDIT_TABLE`, 리전이 다르면 `MEMBERS_REGION`).
  Amplify의 Next.js SSR은 콘솔 환경변수를 **빌드 때만** 넘기므로, 저장소의 `amplify.yml`이 build 단계에서
  아래 줄로 `.env.production`에 적어 서버가 읽게 합니다(값을 바꾸면 다시 빌드해야 반영). 콘솔에서 변수를
  브랜치별로 덮어쓸 수 있으니, 검증 중에는 `feature/aws-members` 브랜치에만 넣으면 됩니다.

  ```yaml
  - env | grep -E '^(BIZOPS_|COGNITO_|MEMBERS_|LEGACY_SUPABASE_MIGRATION=)' >> .env.production || true
  ```

  저장소의 `amplify.yml`은 콘솔에 적어 둔 빌드 설정보다 우선합니다. 콘솔 빌드 설정에 따로 넣어 둔 명령이
  있다면 `amplify.yml`에 옮겨 주세요.

이름이 `AWS_`로 시작하는 환경변수는 Amplify가 막아서 쓰지 않습니다. AWS 키 환경변수는 만들지 마세요.

| 환경변수 | 필수 | 설명 |
| --- | --- | --- |
| `COGNITO_USER_POOL_ID` | `src/config/aws.ts`에 없으면 | 사용자 풀 ID |
| `COGNITO_CLIENT_ID` | `src/config/aws.ts`에 없으면 | 앱 클라이언트 ID (비밀키 없음) |
| `COGNITO_CLIENT_SECRET` | 아니요 | 비밀키 있는 클라이언트를 쓸 때만 (권장 구성은 불필요) |
| `MEMBERS_REGION` / `MEMBERS_TABLE` / `MEMBERS_AUDIT_TABLE` | 아니요 | 기본 `ap-northeast-2` / `mustsem-members` / `mustsem-member-audit` |
| `LEGACY_SUPABASE_MIGRATION` | 아니요 | `on`이면 기존 Supabase 회원을 첫 로그인 때 옮김 |

값이 비어 있으면 회원 API는 503을 돌려주고(화면: "서비스에 연결하지 못했습니다") 나머지 사이트는 그대로 동작합니다.

### 4-4. 배포

이 브랜치를 기존처럼 GitHub에 푸시해 Amplify가 빌드하게 합니다. 빌드 방식(`next build`)은 바뀌지 않았습니다.

## 5. 첫 관리자 지정

웹에는 관리자를 만드는 경로가 없습니다(권한 상승 차단). 운영자가 직접 지정합니다.

1. 관리자로 쓸 계정으로 사이트에서 **회원가입 + 이메일 인증**을 마칩니다.
2. 운영자 PC(AWS CLI 자격 증명이 있는 곳)에서:

   ```bash
   npm install
   node scripts/grant-admin.mjs --email admin@example.com --user-pool-id <UserPoolId>
   # 해제: --revoke 추가
   ```

   필요한 권한: `cognito-idp:AdminGetUser`, 회원 테이블 `dynamodb:GetItem`·`PutItem`·`UpdateItem`, 작업 기록 테이블 `dynamodb:PutItem`.

   AWS CLI만으로 할 때:

   ```bash
   SUB=$(aws cognito-idp admin-get-user --user-pool-id <UserPoolId> --username admin@example.com \
         --query "UserAttributes[?Name=='sub'].Value" --output text)
   aws dynamodb update-item --table-name mustsem-members --key "{\"userId\":{\"S\":\"$SUB\"}}" \
     --update-expression 'SET #r = :a' --condition-expression 'attribute_exists(userId)' \
     --expression-attribute-names '{"#r":"role"}' --expression-attribute-values '{":a":{"S":"ADMIN"}}'
   ```

3. 그 계정으로 로그인하면(이미 로그인 중이면 새로 고침) 헤더 계정 메뉴에 **회원 관리**가 보입니다(`/admin/members`).
   두 번째 관리자부터는 회원 관리 화면의 "관리자로 지정"으로 줄 수 있습니다.

### 관리자 권한 부여·회수와 최고 관리자

권한은 `USER`/`ADMIN` 두 단계 그대로다. 회원 관리 화면의 행마다 있는 **관리** 메뉴(또는 상세 창)에서 관리자가 다른 회원에게
관리자 권한을 주거나 회수한다. 서버 규칙(`src/server/members/admin.ts`, 화면이 메뉴를 감추는 것과 별개로 요청마다 확인):

- 요청자는 세션 쿠키 검증 뒤 DynamoDB에서 다시 읽은 권한이 `ADMIN`, 상태가 `ACTIVE`여야 한다. 권한이 회수되면 다음 요청부터 403.
- 자기 자신의 권한 회수·비활성화·삭제는 할 수 없다(`self_action`).
- **최고 관리자(보호 계정)** 는 누구도 권한 회수·비활성화·삭제할 수 없다(`protected_account`). 화면에는 "최고 관리자"로 보인다.
  보호 계정은 이메일이 아니라 Cognito userId로 가리며, `src/server/members/config.ts`의 `PROTECTED_ADMIN_IDS`(서버 전용)에 적혀 있다.
  더 보호할 계정은 환경변수 `MEMBERS_PROTECTED_ADMIN_IDS`(쉼표 구분 userId)로 더한다. 환경변수는 더하기만 하고, 비워도 코드에 적힌 계정의 보호는 풀리지 않는다.
  보호 계정의 권한 값 자체는 `ADMIN`이다. 보호를 풀려면 코드의 목록을 고쳐 배포해야 한다.
- 권한 변경은 "지금 권한이 읽은 값과 같을 때만" 반영되는 조건부 업데이트이고, 작업 기록과 한 트랜잭션(`TransactWriteItems`)으로 저장한다.
  그 사이 다른 관리자가 반대로 바꿨으면 `conflict`(409). 트랜잭션은 별도 IAM 권한 없이 기존 `dynamodb:UpdateItem`(회원 테이블)·
  `dynamodb:PutItem`(작업 기록 테이블)을 쓴다. 역할 정책이 달라 트랜잭션이 거절되면 조건부 업데이트 뒤 기록을 따로 쓰고,
  서버 로그에 `[members:role] transaction unavailable`이 남는다(이 로그가 보이면 컴퓨트 역할 정책을 확인).

## 6. 배포 후 확인 (실제 AWS에서 아직 미검증인 항목)

- [ ] 회원 관리에서 테스트 계정에 관리자 권한 부여 → 그 계정으로 `/admin/members` 접근 → 권한 회수 → 접근 차단, 상세 창의 작업 기록 2건
- [ ] 위 작업 뒤 CloudWatch에 `[members:role] transaction unavailable`이 없는지 (있으면 트랜잭션이 IAM에서 거절된 것)
- [ ] 최고 관리자 행에 "최고 관리자" 표시, 관리 메뉴에 권한 회수·비활성화·삭제가 없는지

- [ ] 회원가입 → 인증 메일 수신 → 코드 입력 → 로그인 (메일 발송은 에뮬레이터로 확인할 수 없었음)
- [ ] 인증 화면의 "코드 다시 받기" (`ResendConfirmationCode`는 에뮬레이터 미지원)
- [ ] 비밀번호 찾기 메일 수신·재설정
- [ ] 관리자 비활성화 후 다른 기기 세션 차단, 리프레시 토큰 폐기 (`AdminUserGlobalSignOut`은 에뮬레이터 미지원)
- [ ] 내 정보에서 현재 비밀번호를 틀렸을 때 "현재 비밀번호가 올바르지 않습니다" (에뮬레이터는 다른 오류를 돌려줌)
- [ ] DynamoDB 콘솔에서 `mustsem-members` 항목 생성·`lastLoginAt` 갱신, `mustsem-member-audit` 기록 확인
- [ ] 재배포 후 회원 데이터·로그인 유지 (데이터는 DynamoDB·Cognito에 있어 배포와 무관)
- [ ] CloudWatch(Amplify 호스팅 컴퓨트 로그)에 `[members:` 오류가 없는지. `AccessDenied`가 보이면 컴퓨트 역할 연결을 확인

Cognito 기본 메일 발송은 하루 약 50통 제한이 있습니다. 운영에서는 SES를 연결하세요(`SesIdentityArn`).

## 7. 기존 회원(Supabase) 이전

Supabase는 비밀번호를 해시로만 갖고 있어 일괄 이전이 불가능합니다. `LEGACY_SUPABASE_MIGRATION=on`이면:

- Cognito에 없는 이메일로 로그인할 때 서버가 같은 이메일·비밀번호를 Supabase에 확인하고, 맞으면 Cognito 계정(이메일 인증됨)과
  DynamoDB 프로필을 만들고 바로 로그인시킵니다. 작업 기록에 `member.migrate`가 남습니다.
- 기존 비밀번호가 새 정책(영문·숫자·특수문자 8자 이상)에 맞지 않으면 계정만 옮기고 "비밀번호 찾기"로 새로 정하게 안내합니다.
- 옮기기 전에 같은 이메일로 새로 가입한 경우에는 새 Cognito 계정이 우선합니다(이메일 인증으로 소유가 확인된 계정).
- 아직 로그인하지 않은 기존 회원은 "비밀번호 찾기"를 먼저 쓰면 메일이 가지 않습니다(Cognito에 계정이 없음). 먼저 로그인을 안내하세요.

대부분 회원이 옮겨진 뒤 `off`로 바꾸고, Supabase 프로젝트 정리는 별도로 판단하세요(이 코드는 Supabase를 바꾸지 않습니다).

## 8. 로컬 실행 (AWS 계정 없이)

```bash
npx cognito-local                 # 터미널 1: Cognito 에뮬레이터 :9229 (인증 코드가 이 터미널에 찍힘)
npx dynalite --port 8000          # 터미널 2: DynamoDB 에뮬레이터 :8000
node scripts/members-local.mjs    # 사용자 풀·클라이언트·테이블 생성, 출력값을 .env.local에 저장
npm run dev                       # http://localhost:3000
node scripts/grant-admin.mjs --email <가입한 이메일> --user-pool-id <출력된 풀 ID>   # COGNITO_ENDPOINT·DYNAMODB_ENDPOINT를 함께 지정
```

에뮬레이터 주소(`COGNITO_ENDPOINT`, `DYNAMODB_ENDPOINT`)는 개발 서버에서만 쓰입니다. 운영 빌드는 이 값을 무시합니다
(`next start`로 에뮬레이터를 확인할 때만 `MEMBERS_ALLOW_LOCAL_ENDPOINTS=1 MEMBERS_INSECURE_COOKIES=1`).

실제 AWS 리소스에 붙여 로컬에서 띄우려면 `.env.local`에 `COGNITO_USER_POOL_ID`·`COGNITO_CLIENT_ID`만 두고,
`AWS_PROFILE`로 컴퓨트 역할과 같은 권한의 자격 증명을 쓰면 됩니다.

자동 점검: `scripts/members-e2e.mjs` (가입·인증·로그인·세션 갱신·권한 상승 차단·관리자 기능·비밀번호 재설정·삭제 등 70개 항목, 파일 머리 주석 참고).

## 9. 알려진 한계

- 관리자 목록은 회원 테이블을 한 번 훑어 서버에서 검색·정렬합니다. 회원 수만 명까지는 충분하고, 그 이상이면 GSI·검색 색인을 추가하세요.
- 액세스 토큰(1시간)은 자체 검증하므로, Cognito에서 세션을 폐기해도 서버가 판단하는 기준은 DynamoDB 상태입니다.
  비활성화·삭제는 즉시 막히지만, "비밀번호 재설정 후 다른 기기 로그아웃"은 그 기기의 액세스 토큰이 만료될 때(최대 1시간) 적용됩니다.
- 이메일 변경 화면은 없습니다(로그인 ID). 요청 시 Cognito 이메일 변경(인증 필요) 흐름을 추가해야 합니다.
- 요청 빈도 제한은 Cognito 기본 제한에 맡깁니다. 무차별 대입이 걱정되면 AWS WAF(Amplify 연결)를 붙이세요.
