import config from '@payload-config'
import Link from 'next/link'
import React from 'react'
import { getPayload } from 'payload'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Confirm your email address', robots: { index: false } }

export default async function VerifyEmailPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const payload = await getPayload({ config })
  let verified = false
  try {
    verified = await payload.verifyEmail({ collection: 'users', token })
  } catch {
    verified = false
  }

  return (
    <div className="page">
      <h1>{verified ? 'Email address confirmed' : 'We couldn’t confirm that link'}</h1>
      {verified ? (
        <>
          <p>Thank you. Your email address is confirmed.</p>
          <p>
            <Link href="/login">Sign in to Nicotine360</Link>. If you don’t have a password yet, use “Set a new password”
            on the sign-in page.
          </p>
        </>
      ) : (
        <p>
          The link may have been used already or is no longer valid. If you have confirmed before, you can{' '}
          <Link href="/login">sign in</Link>; otherwise contact our team at membership@nicotine360.org.
        </p>
      )}
    </div>
  )
}
