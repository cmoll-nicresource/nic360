import React from 'react'

import { ForgotPasswordForm } from '@/components/ForgotPasswordForm'
import { SiteNav } from '@/components/SiteNav'

export default function ForgotPasswordPage() {
  return (
    <>
      <SiteNav />
      <div className="page">
        <h1>Reset your password</h1>
        <p className="muted">
          <a href="/login">Back to sign in</a>
        </p>
        <ForgotPasswordForm />
      </div>
    </>
  )
}
