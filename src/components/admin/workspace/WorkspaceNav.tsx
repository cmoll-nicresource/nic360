import { Link } from '@payloadcms/ui'
import type { Payload, PayloadRequest, ServerProps } from 'payload'
import { DefaultNav } from '@payloadcms/next/rsc'
import { getWorkspaceMenu } from '@/lib/workspaceMenu'

/** Keep Payload's mobile toggle, account controls and logout, replacing its flat collection links. */
export function WorkspaceNavigation(props: ServerProps & { req?: PayloadRequest }) {
  return <DefaultNav {...props} visibleEntities={{ collections: [], globals: [] }} />
}

export async function WorkspaceNav({ user, payload }: { user?: PayloadRequest['user']; payload: Payload }) {
  const groups = await getWorkspaceMenu(payload, user ?? null)
  if (!groups.length) return null
  return (
    <div className="nic-workspace-nav">
      <Link
        href="/admin"
        className="nic-workspace-nav__brand"
        aria-label="Nicotine360 staff workspace"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Nicotine360" width="190" height="37" />
        <span>STAFF WORKSPACE</span>
      </Link>
      <Link className="nic-workspace-nav__home" href="/admin">
        Workspace overview <span aria-hidden="true">↗</span>
      </Link>
      {groups.map(group => (
        <section key={group.label} aria-label={group.label} className="nic-workspace-nav__group">
          <h2 className="nic-workspace-nav__label">{group.label}</h2>
          {group.links.map(link => <Link key={link.href} href={link.href} prefetch={false} className="nic-workspace-nav__link">{link.label}</Link>)}
        </section>
      ))}
      <Link href="/" className="nic-workspace-nav__site">
        View public site <span aria-hidden="true">↗</span>
      </Link>
    </div>
  )
}
