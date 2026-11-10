/**
 * AWS SDK 클라이언트 (요청마다 만들지 않고 함수 인스턴스당 하나).
 * 자격 증명은 SDK 기본 체인에서 얻는다: Amplify에서는 컴퓨트 역할의 임시 키, 로컬에서는 개발자 프로필.
 * 에뮬레이터 주소가 있으면(개발 전용) 가짜 키로 붙는다.
 */
import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import type { MembersConfig } from './config'

const LOCAL_CREDENTIALS = { accessKeyId: 'local', secretAccessKey: 'local' }

let cognito: CognitoIdentityProviderClient | null = null
let documents: DynamoDBDocumentClient | null = null

export function cognitoClient(config: MembersConfig): CognitoIdentityProviderClient {
  if (!cognito) {
    cognito = new CognitoIdentityProviderClient({
      region: config.region,
      maxAttempts: 2,
      ...(config.cognitoEndpoint ? { endpoint: config.cognitoEndpoint, credentials: LOCAL_CREDENTIALS } : {}),
    })
  }
  return cognito
}

export function dynamo(config: MembersConfig): DynamoDBDocumentClient {
  if (!documents) {
    const base = new DynamoDBClient({
      region: config.region,
      maxAttempts: 3,
      ...(config.dynamoEndpoint ? { endpoint: config.dynamoEndpoint, credentials: LOCAL_CREDENTIALS } : {}),
    })
    documents = DynamoDBDocumentClient.from(base, { marshallOptions: { removeUndefinedValues: true } })
  }
  return documents
}
