/**
 * 회원 시스템 AWS 리소스 이름. 비밀값이 아니라 식별자라서 저장소에 두어도 된다
 * (사용자 풀 ID·앱 클라이언트 ID는 Cognito 공개 식별자, 테이블 이름은 IAM이 접근을 통제).
 *
 * infra/aws/members-stack.yaml 스택을 만든 뒤 출력값(Outputs)을 여기에 넣는다.
 * 서버 환경변수가 있으면 그 값이 우선한다 (docs/aws-members.md 참고).
 * 비어 있으면 회원 API는 503(unavailable)을 돌려주고 나머지 사이트는 그대로 동작한다.
 *
 * AWS 액세스 키는 여기에도, 환경변수에도 두지 않는다. 서버는 Amplify 컴퓨트 역할(IAM Role)의
 * 임시 자격 증명으로 Cognito 관리 API와 DynamoDB를 호출한다.
 */
export const AWS_MEMBERS = {
  region: 'ap-northeast-2',
  /** 예: ap-northeast-2_AbCdEf123 */
  userPoolId: '',
  /** 비밀키 없는(public) 앱 클라이언트 ID */
  clientId: '',
  usersTable: 'mustsem-members',
  auditTable: 'mustsem-member-audit',
} as const
