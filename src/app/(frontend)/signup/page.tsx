import React from 'react'

import { SiteNav } from '@/components/SiteNav'
import { SignupWizard } from '@/components/SignupWizard'

export const metadata = { title: 'Create your account' }

export default function SignupPage() {
  return (
    <>
      <SiteNav />
      <div className="page">
        <h1>Create your account</h1>
        <p className="muted">
          Already have an account? <a href="/login">Sign in</a>.
        </p>
        <SignupWizard />
      </div>
    </>
  )
}
