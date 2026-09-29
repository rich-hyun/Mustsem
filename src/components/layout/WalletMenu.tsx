'use client'

import { CaretDownIcon, WalletIcon } from '@phosphor-icons/react/ssr'
import { useEffect } from 'react'
import { NETWORKS } from '@/config/networks'
import { useWallet } from '@/components/wallet/WalletProvider'
import { Button } from '@/components/ui/Button'
import { CopyButton } from '@/components/ui/CopyButton'
import { Badge, Spinner } from '@/components/ui/DataDisplay'
import { cx } from '@/lib/cx'
import { shortenAddress, shortenHash } from '@/lib/format'
import styles from './Header.module.css'

interface WalletMenuProps {
  open: boolean
  onToggle: () => void
  onClose: () => void
}

const ACTIVITY_TONE = { pending: 'info', confirmed: 'success', failed: 'danger' } as const
const ACTIVITY_LABEL = { pending: '대기', confirmed: '완료', failed: '실패' } as const

export function WalletMenu({ open, onToggle, onClose }: WalletMenuProps) {
  const wallet = useWallet()
  const { notice, clearNotice } = wallet

  // 지갑 안내 문구는 잠시 보여 준 뒤 사라진다
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(clearNotice, 5000)
    return () => window.clearTimeout(timer)
  }, [notice, clearNotice])

  const toast = notice && !open && (
    <p className={styles.toast} role="status">
      {notice}
    </p>
  )

  if (wallet.status !== 'connected' || !wallet.account) {
    const connecting = wallet.status === 'connecting'
    const unavailable = wallet.status === 'unavailable'
    return (
      <div className={styles.navItem}>
        <button
          type="button"
          className={styles.chip}
          data-menu-trigger="wallet"
          // 좁은 화면에서는 글자를 숨기고 아이콘만 남기므로 이름을 따로 단다
          aria-label={connecting ? '지갑 연결 중' : '지갑 연결'}
          aria-expanded={unavailable ? open : undefined}
          aria-controls={unavailable ? 'menu-wallet' : undefined}
          disabled={connecting}
          onClick={() => {
            if (unavailable) onToggle()
            else void wallet.connect()
          }}
        >
          {connecting ? <Spinner size={16} /> : <WalletIcon size={18} aria-hidden />}
          <span className={styles.chipLabel}>{connecting ? '연결 중…' : '지갑 연결'}</span>
        </button>
        {open && unavailable && (
          <div id="menu-wallet" className={cx(styles.panel, styles.panelEnd, styles.popover)}>
            <p className={styles.popLabel}>지갑이 필요합니다</p>
            <p className={styles.popText}>
              발행·브릿지·스테이킹 도구는 MetaMask 같은 브라우저 지갑으로 서명합니다. 지갑을 설치한 뒤 이 페이지를 새로고침하세요.
            </p>
            <div className={cx(styles.popSection, styles.popFooter)}>
              <Button href="https://metamask.io/download/" variant="secondary" size="sm" target="_blank" rel="noopener noreferrer" onClick={onClose}>
                MetaMask 설치 안내
              </Button>
            </div>
          </div>
        )}
        {toast}
      </div>
    )
  }

  const network = wallet.network
  return (
    <div className={styles.navItem}>
      <button
        type="button"
        className={styles.chip}
        data-menu-trigger="wallet"
        aria-expanded={open}
        aria-controls="menu-wallet"
        aria-label={`지갑 ${shortenAddress(wallet.account)} · ${network ? network.name : '지원하지 않는 네트워크'}`}
        onClick={onToggle}
      >
        <span className={cx(styles.dot, !network && styles.dotWarn)} aria-hidden />
        <span className={cx(styles.chipMono, styles.chipLabel)}>{shortenAddress(wallet.account, 6, 4)}</span>
        <span className={styles.chipNetwork}>{network ? network.name : '미지원 네트워크'}</span>
        <CaretDownIcon className={styles.caret} size={12} weight="bold" aria-hidden />
      </button>

      {open && (
        <div id="menu-wallet" className={cx(styles.panel, styles.panelEnd, styles.popover)}>
          <div className={styles.popSection}>
            <p className={styles.popLabel}>연결된 지갑</p>
            <div className={styles.popAccount}>
              <span className={styles.popAddress}>{wallet.account}</span>
              <CopyButton value={wallet.account} label="주소 복사" iconOnly />
            </div>
          </div>

          <div className={styles.popSection}>
            <p className={styles.popLabel}>네트워크</p>
            {!network && <p className={styles.popText}>지갑이 지원하지 않는 네트워크(체인 ID {wallet.chainId ?? '-'})에 있습니다. 아래에서 전환하세요.</p>}
            <ul role="list" className={styles.netList}>
              {NETWORKS.map((item) => (
                <li key={item.key}>
                  <button
                    type="button"
                    className={styles.netOption}
                    aria-pressed={item.chainId === wallet.chainId}
                    onClick={() => void wallet.switchNetwork(item)}
                  >
                    <span>{item.name}</span>
                    <span className={styles.netMeta}>
                      {item.symbol} · {item.chainId}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {notice && (
              <p className={styles.popText} role="status" style={{ marginTop: 8 }}>
                {notice}
              </p>
            )}
          </div>

          {wallet.activity.length > 0 && (
            <div className={styles.popSection}>
              <p className={styles.popLabel}>이 세션의 트랜잭션</p>
              <ul role="list" className={styles.activity}>
                {wallet.activity.map((item) => (
                  <li key={item.id} className={styles.activityItem}>
                    <Badge tone={ACTIVITY_TONE[item.status]}>{ACTIVITY_LABEL[item.status]}</Badge>
                    <span className={styles.activityLabel}>{item.label}</span>
                    <span className={styles.activityHash}>{shortenHash(item.hash)}</span>
                    <CopyButton value={item.hash} label="해시 복사" iconOnly />
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className={cx(styles.popSection, styles.popFooter)}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                onClose()
                void wallet.disconnect()
              }}
            >
              연결 해제
            </Button>
          </div>
        </div>
      )}
      {toast}
    </div>
  )
}
