import React from 'react'

import { ResetPasswordForm } from '@/components/ResetPasswordForm'

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  return (
    <div className="page">
      <h1>Set a new password</h1>
      <ResetPasswordForm token={token} />
    </div>
  )
}
