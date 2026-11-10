#!/usr/bin/env node
/**
 * 관리자 권한 지정·해제 (운영자 PC에서 실행). 웹에는 첫 관리자를 만드는 경로가 없다.
 *
 *   node scripts/grant-admin.mjs --email admin@example.com            # ADMIN으로
 *   node scripts/grant-admin.mjs --email admin@example.com --revoke   # USER로
 *
 * 필요 값 (환경변수 또는 인자):
 *   --region / MEMBERS_REGION            기본 ap-northeast-2
 *   --user-pool-id / COGNITO_USER_POOL_ID
 *   --table / MEMBERS_TABLE              기본 mustsem-members
 *   --audit-table / MEMBERS_AUDIT_TABLE  기본 mustsem-member-audit
 * 자격 증명: AWS CLI와 같은 기본 체인(AWS_PROFILE 등). 필요한 권한: cognito-idp:AdminGetUser,
 *   dynamodb:GetItem·PutItem·UpdateItem(회원 테이블), dynamodb:PutItem(작업 기록 테이블).
 *
 * 대상 회원은 먼저 사이트에서 가입하고 이메일 인증까지 마쳐야 한다.
 * 로컬 에뮬레이터 확인용: COGNITO_ENDPOINT, DYNAMODB_ENDPOINT 를 주면 그쪽으로 붙는다.
 */
import { randomBytes } from 'node:crypto'
import { parseArgs } from 'node:util'
import { AdminGetUserCommand, CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'

const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    revoke: { type: 'boolean', default: false },
    region: { type: 'string' },
    'user-pool-id': { type: 'string' },
    table: { type: 'string' },
    'audit-table': { type: 'string' },
  },
})

const email = values.email?.trim().toLowerCase()
const region = values.region ?? process.env.MEMBERS_REGION ?? 'ap-northeast-2'
const userPoolId = values['user-pool-id'] ?? process.env.COGNITO_USER_POOL_ID
const table = values.table ?? process.env.MEMBERS_TABLE ?? 'mustsem-members'
const auditTable = values['audit-table'] ?? process.env.MEMBERS_AUDIT_TABLE ?? 'mustsem-member-audit'
const role = values.revoke ? 'USER' : 'ADMIN'

if (!email || !userPoolId) {
  console.error('사용법: node scripts/grant-admin.mjs --email <회원 이메일> --user-pool-id <풀 ID> [--revoke]')
  process.exit(1)
}

const local = { accessKeyId: 'local', secretAccessKey: 'local' }
const cognito = new CognitoIdentityProviderClient({
  region,
  ...(process.env.COGNITO_ENDPOINT ? { endpoint: process.env.COGNITO_ENDPOINT, credentials: local } : {}),
})
const db = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region, ...(process.env.DYNAMODB_ENDPOINT ? { endpoint: process.env.DYNAMODB_ENDPOINT, credentials: local } : {}) }),
)

const user = await cognito.send(new AdminGetUserCommand({ UserPoolId: userPoolId, Username: email })).catch((error) => {
  if (error.name === 'UserNotFoundException') {
    console.error(`Cognito에 ${email} 회원이 없습니다. 먼저 사이트에서 가입하세요.`)
    process.exit(1)
  }
  throw error
})
const attr = (name) => user.UserAttributes?.find((item) => item.Name === name)?.Value
const sub = attr('sub')
if (user.UserStatus !== 'CONFIRMED') {
  console.error(`${email} 회원의 이메일 인증이 끝나지 않았습니다 (상태: ${user.UserStatus}).`)
  process.exit(1)
}

const now = new Date().toISOString()
const { Item } = await db.send(new GetCommand({ TableName: table, Key: { userId: sub }, ConsistentRead: true }))
const before = Item?.role ?? '(프로필 없음)'
if (Item) {
  await db.send(
    new UpdateCommand({
      TableName: table,
      Key: { userId: sub },
      UpdateExpression: 'SET #role = :role, updatedAt = :now',
      ExpressionAttributeNames: { '#role': 'role' },
      ExpressionAttributeValues: { ':role': role, ':now': now },
    }),
  )
} else {
  await db.send(
    new PutCommand({
      TableName: table,
      Item: { userId: sub, email, name: attr('name') ?? email.split('@')[0], role, status: 'ACTIVE', emailVerified: true, marketingAgreed: false, createdAt: now, updatedAt: now },
      ConditionExpression: 'attribute_not_exists(userId)',
    }),
  )
}
await db.send(
  new PutCommand({
    TableName: auditTable,
    Item: {
      targetUserId: sub,
      at: `${now}#${randomBytes(4).toString('hex')}`,
      targetEmail: email,
      action: 'member.role',
      actorId: 'cli',
      actorEmail: `cli:${process.env.USER ?? process.env.USERNAME ?? 'operator'}`,
      detail: `${before} → ${role} (grant-admin 스크립트)`,
    },
  }),
)
console.log(`${email} (${sub}) 권한: ${before} → ${role}`)
console.log('이미 로그인 중이면 다음 요청부터 반영됩니다 (화면은 새로 고침).')
