import { CheckIcon, MinusIcon } from '@phosphor-icons/react/ssr'
import { passwordChecks } from '@/lib/account'
import { cx } from '@/lib/cx'
import styles from './Auth.module.css'

/** 비밀번호 정책 충족 여부를 항목별로 보여 준다 (입력칸 hint 자리) */
export function PasswordPolicy({ password }: { password: string }) {
  const checks = passwordChecks(password)
  return (
    <span className={styles.policy}>
      <span className="sr-only">비밀번호 조건:</span>
      {checks.map((check) => (
        <span key={check.id} className={cx(styles.policyItem, check.ok && styles.policyOk)}>
          {check.ok ? <CheckIcon size={12} weight="bold" aria-hidden /> : <MinusIcon size={12} weight="bold" aria-hidden />}
          {check.label}
          <span className="sr-only">{check.ok ? ' 충족' : ' 미충족'}</span>
        </span>
      ))}
    </span>
  )
}
