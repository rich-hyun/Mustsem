/**
 * 회원 시스템 서버 설정. src/config/aws.ts 기본값 위에 서버 환경변수를 덮는다.
 * 이 모듈은 Route Handler에서만 가져온다 (클라이언트 번들에 넣지 않는다).
 *
 * Amplify 콘솔은 AWS_ 로 시작하는 환경변수 이름을 막으므로 MEMBERS_·COGNITO_ 접두사를 쓴다.
 */
import { AWS_MEMBERS } from '@/config/aws'
import { MemberError } from './errors'

export interface MembersConfig {
  region: string
  userPoolId: string
  clientId: string
  /** 앱 클라이언트에 비밀키를 둔 경우만 (권장 구성은 비밀키 없음) */
  clientSecret: string | null
  usersTable: string
  auditTable: string
  /** 로컬 에뮬레이터 주소 (개발 전용, 운영에서는 비워 둔다) */
  cognitoEndpoint: string | null
  dynamoEndpoint: string | null
  /** 기존 Supabase 회원을 첫 로그인 때 Cognito로 옮긴다 */
  legacyMigration: boolean
  /** 보호 계정(최고 관리자)의 Cognito userId. 권한 회수·비활성화·삭제 대상이 될 수 없다 */
  protectedAdminIds: ReadonlySet<string>
}

/**
 * 최초 최고 관리자. 이메일이 아니라 Cognito userId(sub)로 가린다 (이메일은 바뀔 수 있고, 같은 이메일로 다시 가입한 계정은 다른 사람이다).
 * 서버에서만 읽는 값이라 브라우저가 바꿀 수 없다. 계정을 더 보호하려면 환경변수 MEMBERS_PROTECTED_ADMIN_IDS(쉼표 구분)에 적는다.
 * 환경변수는 이 목록에 더해질 뿐, 비우거나 잘못 적어도 아래 계정의 보호는 풀리지 않는다.
 */
const PROTECTED_ADMIN_IDS = ['24c8bd7c-9071-70e1-dc50-ac64d1b06ad5']

function protectedAdminIds(extra: string | null): ReadonlySet<string> {
  const ids = (extra ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => /^[0-9a-zA-Z-]{1,64}$/.test(id))
  return new Set([...PROTECTED_ADMIN_IDS, ...ids])
}

const env = (name: string): string | null => {
  const value = process.env[name]?.trim()
  return value ? value : null
}

let cached: MembersConfig | null | undefined

/** 필수 값이 비어 있으면 null (API는 503으로 응답) */
export function membersConfig(): MembersConfig | null {
  if (cached !== undefined) return cached
  const isProduction = process.env.NODE_ENV === 'production'
  const config: MembersConfig = {
    region: env('MEMBERS_REGION') ?? AWS_MEMBERS.region,
    userPoolId: env('COGNITO_USER_POOL_ID') ?? AWS_MEMBERS.userPoolId,
    clientId: env('COGNITO_CLIENT_ID') ?? AWS_MEMBERS.clientId,
    clientSecret: env('COGNITO_CLIENT_SECRET'),
    usersTable: env('MEMBERS_TABLE') ?? AWS_MEMBERS.usersTable,
    auditTable: env('MEMBERS_AUDIT_TABLE') ?? AWS_MEMBERS.auditTable,
    // 운영 빌드에서는 에뮬레이터 주소를 무시해 실수로 가짜 저장소에 붙지 않게 한다
    cognitoEndpoint: isProduction && env('MEMBERS_ALLOW_LOCAL_ENDPOINTS') !== '1' ? null : env('COGNITO_ENDPOINT'),
    dynamoEndpoint: isProduction && env('MEMBERS_ALLOW_LOCAL_ENDPOINTS') !== '1' ? null : env('DYNAMODB_ENDPOINT'),
    legacyMigration: env('LEGACY_SUPABASE_MIGRATION') === 'on',
    protectedAdminIds: protectedAdminIds(env('MEMBERS_PROTECTED_ADMIN_IDS')),
  }
  cached = config.userPoolId && config.clientId && config.usersTable && config.auditTable ? config : null
  if (!cached) console.error('[members] Cognito/DynamoDB 설정이 비어 있습니다 (src/config/aws.ts 또는 환경변수)')
  return cached
}

/** 쿠키에 Secure를 붙일지: 로컬 http 개발 서버에서만 뺀다 */
export function secureCookies(): boolean {
  return process.env.NODE_ENV === 'production' && env('MEMBERS_INSECURE_COOKIES') !== '1'
}

/** 설정이 없으면 503 오류를 던진다 (Route Handler 안에서 handle()이 응답으로 바꾼다) */
export function requireConfig(): MembersConfig {
  const config = membersConfig()
  if (!config) throw new MemberError('unavailable')
  return config
}
