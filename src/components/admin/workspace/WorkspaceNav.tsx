import Link from 'next/link'
import type { PayloadRequest } from 'payload'
import { staffTasksFor } from '@/config/staffWorkspace'

export function WorkspaceNav({ user }: { user?: PayloadRequest['user'] }) {
  const tasks = staffTasksFor(user ?? null)
  if (!tasks.length) return null
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
      <p className="nic-workspace-nav__label">Daily tools</p>
      {tasks
        .filter((task) =>
          ['trade', 'trademark', 'data', 'event', 'analytics', 'access'].includes(task.icon),
        )
        .map((task) => (
          <Link key={task.href} href={task.href} className="nic-workspace-nav__link">
            {task.label}
          </Link>
        ))}
      <Link href="/" className="nic-workspace-nav__site">
        View public site <span aria-hidden="true">↗</span>
      </Link>
      <p className="nic-workspace-nav__label">Content & administration</p>
    </div>
  )
}
