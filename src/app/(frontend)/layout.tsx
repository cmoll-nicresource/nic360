import { Inter, Source_Serif_4 } from 'next/font/google'
import React from 'react'

import { SiteFooter } from '@/components/SiteFooter'
import './styles.css'

const sans = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' })
const serif = Source_Serif_4({ subsets: ['latin'], variable: '--font-serif', display: 'swap' })

export const metadata = {
  description: 'Nicotine360: nicotine and tobacco industry news and intelligence.',
  title: 'Nicotine360',
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
