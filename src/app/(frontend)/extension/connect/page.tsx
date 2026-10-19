import { CLIPPER_CLIENTS, RESEARCH_CLIPPER_REDIRECT } from '@/config/extension'
import Link from 'next/link'
import type { Metadata } from 'next'
import { frontendContext } from '@/lib/frontendContext'
import { validConnectRequest } from '@/lib/clipperAuth'
import { ConnectApproval } from './ConnectApproval'

export const metadata: Metadata = { title: 'Connect browser clipper | Nicotine360', robots: { index: false, follow: false }, referrer: 'no-referrer' }
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const input = await searchParams
  const research = input.redirect_uri === RESEARCH_CLIPPER_REDIRECT
  const clipperName = CLIPPER_CLIENTS.find(client => client.kind === (research ? 'research' : 'news'))!.name
  const { user, isStaff } = await frontendContext()
  return <section aria-label={`Connect ${clipperName}`} className="card" style={{ maxWidth: 600, margin: '64px auto', padding: 32 }}>
    <p>Nicotine360 · Staff tools</p><h1>Connect {clipperName}</h1>
    {!validConnectRequest(input) ? <p>This connection request is invalid. Open the clipper options and try again.</p>
      : !isStaff ? <><p>Sign in with your Nicotine360 staff account to connect this browser.</p>
        <Link href={'/admin/login?redirect=' + encodeURIComponent('/extension/connect?' + new URLSearchParams(input).toString())}>Sign in to Nicotine360</Link></>
      : <><p>Connect as <strong>{user?.collection === 'staff' ? user.name : ''}</strong>.</p>
        <p>{research ? 'This browser can read the journal catalog and create draft research articles. Review and publish research in the staff workspace.' : 'This browser can create draft news excerpts, read the location list, and view recent clips. Review and publish excerpts in the staff workspace.'}</p>
        <p>The connection lasts 12 hours. You can disconnect it earlier in extension options. Your password stays on Nicotine360.</p>
        <ConnectApproval input={input} /></>}
  </section>
}
