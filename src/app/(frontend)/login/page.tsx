import React, { Suspense } from 'react'
import Link from 'next/link'

import { LoginForm } from '@/components/LoginForm'
import { SiteNav } from '@/components/SiteNav'

export const metadata = { title: 'Sign in' }

export default function LoginPage() {
  return (
    <>
      <SiteNav />
      <div className="page auth-page">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Nicotine360" style={{ height: 32, margin: '0 auto 24px', display: 'block' }} />
        <h1 style={{ textAlign: 'center' }}>Sign in</h1>
        <p className="muted" style={{ textAlign: 'center' }}>
          Use your work email — if your company subscribes, you&apos;re in automatically.
        </p>
        <Suspense>
          <LoginForm />
        </Suspense>
        <p className="notice notice-info">
          Used our previous website? Your account has moved, but your old password has not.
          {' '}<Link href="/forgot-password">Set a new password</Link> using the same email address.
        </p>
        <p className="muted" style={{ textAlign: 'center', marginTop: 16 }}>
          New here? <a href="/signup">Create an account</a>.
        </p>
      </div>
    </>
  )
}
