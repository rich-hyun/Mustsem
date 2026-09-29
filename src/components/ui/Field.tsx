'use client'

import { WarningCircleIcon } from '@phosphor-icons/react/ssr'
import { useId, type ComponentPropsWithoutRef, type CSSProperties, type ReactNode } from 'react'
import { cx } from '@/lib/cx'
import styles from './Field.module.css'

interface ShellProps {
  label: ReactNode
  hint?: ReactNode
  error?: string | null
  optional?: boolean
  /** 라벨 오른쪽 보조 정보 (예: 잔액) */
  labelAside?: ReactNode
  className?: string
}

interface ShellRenderProps extends ShellProps {
  id: string
  children: (describedBy: string | undefined) => ReactNode
  trailing?: ReactNode
  trailingWidth?: number
}

function FieldShell({ id, label, hint, error, optional, labelAside, className, children, trailing, trailingWidth }: ShellRenderProps) {
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined
  const style = trailing ? ({ '--trailing-w': `${trailingWidth ?? 64}px` } as CSSProperties) : undefined

  return (
    <div className={cx(styles.field, error && styles.invalid, trailing ? styles.hasTrailing : undefined, className)} style={style}>
      <div className={styles.labelRow}>
        <label className={styles.label} htmlFor={id}>
          {label}
          {optional && <span className={styles.optional}>(선택)</span>}
        </label>
        {labelAside && <span className={styles.labelAside}>{labelAside}</span>}
      </div>
      <div className={styles.control}>
        {children(describedBy)}
        {trailing && <div className={styles.trailing}>{trailing}</div>}
      </div>
      {hint && !error && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={styles.error} role="alert">
          <WarningCircleIcon size={15} weight="fill" aria-hidden />
          {error}
        </p>
      )}
    </div>
  )
}

type TextFieldProps = ShellProps &
  Omit<ComponentPropsWithoutRef<'input'>, 'className'> & {
    mono?: boolean
    trailing?: ReactNode
    trailingWidth?: number
  }

export function TextField({ label, hint, error, optional, labelAside, className, mono, trailing, trailingWidth, id, ...input }: TextFieldProps) {
  const autoId = useId()
  const fieldId = id ?? autoId
  return (
    <FieldShell
      id={fieldId}
      label={label}
      hint={hint}
      error={error}
      optional={optional}
      labelAside={labelAside}
      className={className}
      trailing={trailing}
      trailingWidth={trailingWidth}
    >
      {(describedBy) => (
        <input
          id={fieldId}
          className={cx(styles.input, mono && styles.mono)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...input}
        />
      )}
    </FieldShell>
  )
}

type TextAreaFieldProps = ShellProps & Omit<ComponentPropsWithoutRef<'textarea'>, 'className'> & { mono?: boolean }

export function TextAreaField({ label, hint, error, optional, labelAside, className, mono, id, ...textarea }: TextAreaFieldProps) {
  const autoId = useId()
  const fieldId = id ?? autoId
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} optional={optional} labelAside={labelAside} className={className}>
      {(describedBy) => (
        <textarea
          id={fieldId}
          className={cx(styles.textarea, mono && styles.mono)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...textarea}
        />
      )}
    </FieldShell>
  )
}

type SelectFieldProps = ShellProps & Omit<ComponentPropsWithoutRef<'select'>, 'className'>

export function SelectField({ label, hint, error, optional, labelAside, className, id, children, ...select }: SelectFieldProps) {
  const autoId = useId()
  const fieldId = id ?? autoId
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} optional={optional} labelAside={labelAside} className={className}>
      {(describedBy) => (
        <select id={fieldId} className={styles.select} aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...select}>
          {children}
        </select>
      )}
    </FieldShell>
  )
}
