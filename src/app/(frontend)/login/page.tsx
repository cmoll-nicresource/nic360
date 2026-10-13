import React, { Suspense } from 'react'

import { LoginForm } from '@/components/LoginForm'
import { SiteNav } from '@/components/SiteNav'

export default function LoginPage() {
  return (
    <>
      <SiteNav />
      <div className="page">
        <h1>Sign in</h1>
        <p className="muted">
          New here? <a href="/signup">Create an account</a>.
        </p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </>
  )
}
