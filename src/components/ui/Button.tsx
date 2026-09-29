import { CircleNotchIcon } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { cx } from '@/lib/cx'
import styles from './Button.module.css'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'accent' | 'onDark' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

interface CommonProps {
  variant?: ButtonVariant
  size?: ButtonSize
  block?: boolean
  className?: string
  children: ReactNode
}

type NativeButtonProps = CommonProps &
  Omit<ComponentPropsWithoutRef<'button'>, 'className' | 'children'> & {
    href?: undefined
    /** 진행 중 표시 — 스피너를 보이고 버튼을 잠근다 */
    loading?: boolean
  }

type LinkButtonProps = CommonProps &
  Omit<ComponentPropsWithoutRef<'a'>, 'className' | 'children' | 'href'> & {
    href: string
  }

function classes({ variant = 'primary', size = 'md', block, className }: CommonProps) {
  return cx(styles.button, styles[variant], size !== 'md' && styles[size], block && styles.block, className)
}

export function Button(props: NativeButtonProps | LinkButtonProps) {
  if (props.href !== undefined) {
    const { variant, size, block, className, children, href, ...rest } = props
    const cls = classes({ variant, size, block, className, children })
    const isExternal = /^(https?:)?\/\//.test(href) || href.startsWith('mailto:')
    if (isExternal) {
      return (
        <a className={cls} href={href} {...rest}>
          {children}
        </a>
      )
    }
    return (
      <Link className={cls} href={href} {...rest}>
        {children}
      </Link>
    )
  }

  const { variant, size, block, className, children, loading, disabled, type = 'button', ...rest } = props
  return (
    <button
      type={type}
      className={classes({ variant, size, block, className, children })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <CircleNotchIcon className={styles.spinner} size={16} weight="bold" aria-hidden />}
      {children}
    </button>
  )
}
