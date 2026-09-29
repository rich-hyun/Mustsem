import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { AuthProvider } from '@/components/auth/AuthProvider'
import { Footer } from '@/components/layout/Footer'
import { Header } from '@/components/layout/Header'
import { MotionRuntime } from '@/components/motion/MotionRuntime'
import { WalletProvider } from '@/components/wallet/WalletProvider'
import { SITE } from '@/config/site'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} | ${SITE.tagline}`,
    template: `%s | ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.brand,
  icons: { icon: { url: '/favicon.svg', type: 'image/svg+xml' } },
  openGraph: {
    type: 'website',
    siteName: SITE.brand,
    locale: 'ko_KR',
    images: [{ url: '/og.png', width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image' },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  themeColor: '#0a1628',
}

const PRETENDARD =
  'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css'

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" data-scroll-behavior="smooth">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link rel="stylesheet" href={PRETENDARD} />
      </head>
      <body>
        <a className="skip-link" href="#main">
          본문 바로가기
        </a>
        <AuthProvider>
          <WalletProvider>
            <Header />
            <main id="main" tabIndex={-1}>
              {children}
            </main>
            <Footer />
            <MotionRuntime />
          </WalletProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
