/**
 * 스마트 컨트랙트 조회 API (이 사이트 서버에서 바로 호출되는 /api/v1/...).
 *
 *   GET /api/v1/chain/status?chainId=7601
 *   GET /api/v1/anomaly/scan?chainId=7601&blocks=2000
 *   GET /api/v1/tokens/status?contract=0x...
 *   GET /api/v1/nfts?tokenId=1            GET /api/v1/sbts/verify?holder=0x...
 *   GET /api/v1/rwa/certificate?tokenId=1 GET /api/v1/rwa/holders?vault=0x...&holder=0x...
 *   GET /api/v1/oracle/prices?pair=BTC/USD  GET /api/v1/oracle/prices/history?pair=..&roundId=1
 *   GET /api/v1/bridge/routes             GET /api/v1/bridge/transfers/status?transferId=0x...
 *   GET /api/v1/did/resolve?did=did:mst:..  GET /api/v1/did/credentials/verify?credentialHash=0x...
 *
 * 응답: 성공 { ok: true, data } · 실패 { ok: false, error: 코드 }
 *   bad_request(400) · unknown_network(400) · not_found(404) · contract_not_deployed(404) · unsupported(404)
 *   rpc_unavailable(502) · upstream_unavailable(502)
 *
 * - 모두 체인을 읽기만 한다. 서명 키가 필요한 쓰기 API(발행·전송 등)는 여기서 실행하지 않는다.
 * - RPC 주소·오류 원문은 응답에 싣지 않는다(CWE-209). 같은 사이트 화면이 쓰는 창구라 CORS를 열지 않는다.
 * - 같은 조회는 서버 메모리에 몇 초 보관해 RPC를 반복 호출하지 않는다.
 */
import type { NextRequest } from 'next/server'
import { GET_HANDLERS } from '@/server/gateway/handlers'
import { GatewayError } from '@/server/gateway/rpc'

export const maxDuration = 30

const NO_STORE = { 'Cache-Control': 'no-store' }

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params
  const handler = GET_HANDLERS[path.join('/')]
  if (!handler) return Response.json({ ok: false, error: 'unsupported' }, { status: 404, headers: NO_STORE })
  try {
    const data = await handler(request.nextUrl.searchParams)
    return Response.json({ ok: true, data }, { headers: NO_STORE })
  } catch (error) {
    if (error instanceof GatewayError) return Response.json({ ok: false, error: error.code }, { status: error.status, headers: NO_STORE })
    console.error(`[gateway] ${path.join('/')} failed:`, error instanceof Error ? `${error.name}: ${error.message}` : error)
    return Response.json({ ok: false, error: 'rpc_unavailable' }, { status: 502, headers: NO_STORE })
  }
}
