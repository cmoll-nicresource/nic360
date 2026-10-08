import React from 'react'
import './styles.css'

export const metadata = {
  description: 'Nicotine360: nicotine and tobacco industry news and intelligence.',
  title: 'Nicotine360',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main>{children}</main>
      </body>
    </html>
  )
}
