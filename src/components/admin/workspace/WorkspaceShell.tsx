import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import type { AdminViewServerProps } from 'payload'
import type { ReactNode } from 'react'
import { isStaffUser, staffHasRole, type StaffRole } from '@/access/staffRoles'

export function requireWorkspaceRole(props: AdminViewServerProps, role: StaffRole = 'editor') {
  const req = props.initPageResult.req
  if (!isStaffUser(req.user)) redirect('/admin/login')
  if (!staffHasRole(req.user, role)) notFound()
  return req
}

/** Custom root views do not inherit Payload's default template automatically. */
export function WorkspaceShell({
  props,
  children,
}: {
  props: AdminViewServerProps
  children: ReactNode
}) {
  const { req, locale, permissions, visibleEntities } = props.initPageResult
  return (
    <DefaultTemplate
      i18n={req.i18n}
      locale={locale}
      params={props.params}
      payload={req.payload}
      permissions={permissions}
      req={req}
      searchParams={props.searchParams}
      user={props.user}
      visibleEntities={visibleEntities}
      viewType="staff-workspace"
    >
      {children}
    </DefaultTemplate>
  )
}

export function WorkspacePage({
  title,
  eyebrow = 'Staff workspace',
  description,
  children,
  actions,
}: {
  title: string
  eyebrow?: string
  description: string
  children: ReactNode
  actions?: ReactNode
}) {
  return (
    <Gutter className="nic-workspace">
      <div className="nic-workspace__breadcrumbs">
        <Link href="/admin">Workspace</Link>
        <span aria-hidden="true">/</span>
        <span>{title}</span>
      </div>
      <header className="nic-workspace__heading">
        <div>
          <p className="nic-workspace__eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="nic-workspace__intro">{description}</p>
        </div>
        {actions && <div className="nic-workspace__actions">{actions}</div>}
      </header>
      {children}
    </Gutter>
  )
}

export function TaskIcon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    trade: (
      <>
        <path d="M4 16l5-5 4 3 7-9" />
        <path d="M15 5h5v5M4 20h16" />
      </>
    ),
    data: (
      <>
        <ellipse cx="12" cy="5" rx="8" ry="3" />
        <path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0" />
      </>
    ),
    people: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 21v-3a6 6 0 0112 0v3M16 5a3 3 0 010 6M18 15a5 5 0 013 6" />
      </>
    ),
    event: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 3v5M17 3v5M3 11h18M7 15h3M14 15h3" />
      </>
    ),
    analytics: (
      <>
        <path d="M4 3v18h17M9 17v-5M14 17V8M19 17V4" />
      </>
    ),
    access: (
      <>
        <path d="M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM8 12l3 3 5-6" />
      </>
    ),
  }
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? (
        <>
          <rect x="5" y="3" width="14" height="18" rx="2" />
          <path d="M9 8h6M9 12h6M9 16h4" />
        </>
      )}
    </svg>
  )
}
