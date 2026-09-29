import { PlusIcon } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import styles from './Faq.module.css'

export interface FaqItem {
  question: string
  answer: string
  link?: { href: string; label: string }
}

/** 네이티브 details 아코디언 — 같은 name끼리는 하나만 열린다 (자바스크립트 불필요) */
export function Faq({ items, name }: { items: FaqItem[]; name: string }) {
  return (
    <div className={styles.faq}>
      {items.map((item, index) => (
        <details key={item.question} className={styles.item} name={name} open={index === 0}>
          <summary className={styles.question}>
            <span>{item.question}</span>
            <PlusIcon className={styles.icon} size={18} weight="bold" aria-hidden />
          </summary>
          <div className={styles.answer}>
            <p>
              {item.answer}
              {item.link && (
                <>
                  {' '}
                  <Link href={item.link.href}>{item.link.label}</Link>
                </>
              )}
            </p>
          </div>
        </details>
      ))}
    </div>
  )
}
