import React from 'react'

import { ForgotPasswordForm } from '@/components/ForgotPasswordForm'
import { SiteNav } from '@/components/SiteNav'

export default function ForgotPasswordPage() {
  return (
    <>
      <SiteNav />
      <div className="page auth-page">
        <h1 style={{ textAlign: 'center' }}>Reset your password</h1>
        <p className="muted">Enter the email address on your Nicotine360 account. If you used our previous website, use that same address to set your new password. Your company subscription stays attached to your account.</p>
        <ForgotPasswordForm />
        <p className="muted" style={{ textAlign: 'center', marginTop: 16 }}>
          <a href="/login">Back to sign in</a>
        </p>
      </div>
    </>
  )
}
