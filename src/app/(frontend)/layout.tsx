import { Inter, Source_Serif_4 } from 'next/font/google'
import React from 'react'

import { SiteFooter } from '@/components/SiteFooter'
import './styles.css'
import './edition.css'

const sans = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' })
const serif = Source_Serif_4({ subsets: ['latin'], variable: '--font-serif', display: 'swap' })

const SITE_URL = process.env.SITE_URL || 'http://localhost:3000'
const DESCRIPTION = 'Nicotine360: nicotine and tobacco industry news and intelligence.'

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'Nicotine360', template: '%s · Nicotine360' },
  description: DESCRIPTION,
  icons: { icon: '/icon.png' },
  openGraph: {
    siteName: 'Nicotine360',
    title: 'Nicotine360',
    description: DESCRIPTION,
    images: [{ url: '/share-card.png', width: 1200, height: 630 }],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body>
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  )
}
