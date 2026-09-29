/** 발행 도구 입력 검증 — 결과 문구는 화면에 그대로 보여도 되는 고정 안내다 */
import { getAddress, isAddress } from 'ethers'

export type Checked<T> = { ok: true; value: T } | { ok: false; message: string }

const HEX_ADDRESS = /^0x[0-9a-fA-F]{40}$/

/** 주소를 검증하고 EIP-55 체크섬 형식으로 돌려준다 */
export function checkAddress(input: string, label = '지갑 주소'): Checked<string> {
  const value = input.trim()
  if (!value) return { ok: false, message: `${label}를 입력하세요.` }
  if (!isAddress(value)) {
    return HEX_ADDRESS.test(value)
      ? { ok: false, message: '주소의 대소문자(체크섬)가 맞지 않습니다. 주소를 다시 복사해 붙여 넣으세요.' }
      : { ok: false, message: '주소 형식이 올바르지 않습니다. 0x로 시작하는 40자리 16진수인지 확인하세요.' }
  }
  return { ok: true, value: getAddress(value) }
}

/** 메타데이터 JSON을 검증해 한 줄로 정규화한다. 비어 있으면 "{}" */
export function checkJson(input: string): Checked<string> {
  const value = input.trim()
  if (!value) return { ok: true, value: '{}' }
  try {
    return { ok: true, value: JSON.stringify(JSON.parse(value)) }
  } catch {
    return { ok: false, message: '메타데이터가 JSON 형식이 아닙니다. 따옴표와 괄호를 확인하세요.' }
  }
}

export function checkRequired(input: string, message: string): Checked<string> {
  const value = input.trim()
  return value ? { ok: true, value } : { ok: false, message }
}
