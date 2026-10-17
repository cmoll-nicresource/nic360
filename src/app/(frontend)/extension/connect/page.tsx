import Link from 'next/link'
import type { Metadata } from 'next'
import { frontendContext } from '@/lib/frontendContext'
import { validConnectRequest } from '@/lib/clipperAuth'
import { ConnectApproval } from './ConnectApproval'

export const metadata: Metadata = { title: 'Connect News Clipper | Nicotine360', robots: { index: false, follow: false }, referrer: 'no-referrer' }
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const input = await searchParams
  const { user, isStaff } = await frontendContext()
  return <section aria-label="Connect News Clipper" className="card" style={{ maxWidth: 600, margin: '64px auto', padding: 32 }}>
    <p>Nicotine360 · Staff tools</p><h1>Connect News Clipper</h1>
    {!validConnectRequest(input) ? <p>This connection request is invalid. Open the News Clipper options and try again.</p>
      : !isStaff ? <><p>Sign in with your Nicotine360 staff account to connect this browser.</p>
        <Link href={'/admin/login?redirect=' + encodeURIComponent('/extension/connect?' + new URLSearchParams(input).toString())}>Sign in to Nicotine360</Link></>
      : <><p>Connect as <strong>{user?.collection === 'staff' ? user.name : ''}</strong>.</p>
        <p>This browser can create draft news excerpts, read the location list, and view recent clips. Review and publish excerpts in the staff workspace.</p>
        <p>The connection lasts 12 hours. You can disconnect it earlier from Connected browsers in your workspace. Your password stays on Nicotine360.</p>
        <ConnectApproval input={input} /></>}
  </section>
}
