'use client'

import { EyeIcon, EyeSlashIcon } from '@phosphor-icons/react/ssr'
import { useState, type ComponentProps } from 'react'
import { TextField } from '@/components/ui/Field'
import styles from './Auth.module.css'

type PasswordFieldProps = Omit<ComponentProps<typeof TextField>, 'type' | 'trailing' | 'trailingWidth'>

/** 비밀번호 입력 + 표시/숨김 토글 */
export function PasswordField(props: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)
  return (
    <TextField
      {...props}
      type={visible ? 'text' : 'password'}
      autoCapitalize="none"
      spellCheck={false}
      trailingWidth={34}
      trailing={
        <button
          type="button"
          className={styles.toggle}
          onClick={() => setVisible((current) => !current)}
          aria-pressed={visible}
          aria-label={visible ? '비밀번호 숨기기' : '비밀번호 보기'}
        >
          {visible ? <EyeSlashIcon size={18} aria-hidden /> : <EyeIcon size={18} aria-hidden />}
        </button>
      }
    />
  )
}
