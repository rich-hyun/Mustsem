#!/usr/bin/env node
/**
 * 로컬 에뮬레이터에 회원 시스템 리소스를 만든다 (AWS 계정 없이 전체 흐름을 확인할 때).
 *
 *   npx cognito-local                 # Cognito 에뮬레이터 :9229 (인증 코드는 이 터미널에 찍힌다)
 *   npx dynalite --port 8000          # DynamoDB 에뮬레이터 :8000
 *   node scripts/members-local.mjs    # 사용자 풀·앱 클라이언트·테이블 생성 → .env.local에 넣을 값 출력
 *
 * 운영 AWS에는 쓰지 않는다 (가짜 자격 증명으로 로컬 주소에만 붙는다).
 */
import { CognitoIdentityProviderClient, CreateUserPoolClientCommand, CreateUserPoolCommand } from '@aws-sdk/client-cognito-identity-provider'
import { CreateTableCommand, DynamoDBClient, ResourceInUseException } from '@aws-sdk/client-dynamodb'

const cognitoEndpoint = process.env.COGNITO_ENDPOINT ?? 'http://localhost:9229'
const dynamoEndpoint = process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:8000'
const credentials = { accessKeyId: 'local', secretAccessKey: 'local' }
const region = 'ap-northeast-2'

const cognito = new CognitoIdentityProviderClient({ region, endpoint: cognitoEndpoint, credentials })
const dynamo = new DynamoDBClient({ region, endpoint: dynamoEndpoint, credentials })

const pool = await cognito.send(
  new CreateUserPoolCommand({
    PoolName: 'mustsem-members-local',
    UsernameAttributes: ['email'],
    AutoVerifiedAttributes: ['email'],
    Policies: { PasswordPolicy: { MinimumLength: 8, RequireNumbers: true, RequireSymbols: true, RequireLowercase: false, RequireUppercase: false } },
  }),
)
const userPoolId = pool.UserPool.Id
const client = await cognito.send(
  new CreateUserPoolClientCommand({
    UserPoolId: userPoolId,
    ClientName: 'mustsem-web-local',
    GenerateSecret: false,
    ExplicitAuthFlows: ['ALLOW_USER_PASSWORD_AUTH', 'ALLOW_REFRESH_TOKEN_AUTH'],
  }),
)

async function table(name, keys) {
  try {
    await dynamo.send(
      new CreateTableCommand({
        TableName: name,
        BillingMode: 'PAY_PER_REQUEST',
        AttributeDefinitions: keys.map(([attribute]) => ({ AttributeName: attribute, AttributeType: 'S' })),
        KeySchema: keys.map(([attribute, type]) => ({ AttributeName: attribute, KeyType: type })),
      }),
    )
  } catch (error) {
    if (!(error instanceof ResourceInUseException)) throw error
  }
}
await table('mustsem-members', [['userId', 'HASH']])
await table('mustsem-member-audit', [['targetUserId', 'HASH'], ['at', 'RANGE']])

console.log(`# .env.local (개발 서버 전용)
COGNITO_ENDPOINT=${cognitoEndpoint}
DYNAMODB_ENDPOINT=${dynamoEndpoint}
COGNITO_USER_POOL_ID=${userPoolId}
COGNITO_CLIENT_ID=${client.UserPoolClient.ClientId}
MEMBERS_TABLE=mustsem-members
MEMBERS_AUDIT_TABLE=mustsem-member-audit`)
