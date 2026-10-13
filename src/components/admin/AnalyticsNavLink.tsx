import { Link, NavGroup } from '@payloadcms/ui'
import React from 'react'

import { staffHasRole } from '@/access/staffRoles'
import type { PayloadRequest } from 'payload'

/** Rendered via admin.components.afterNavLinks — a sidebar entry for the Analytics custom view, gatekeeper+ only. */
export function AnalyticsNavLink({ user }: { user?: PayloadRequest['user'] }) {
  if (!staffHasRole(user ?? null, 'gatekeeper')) return null

  return (
    <NavGroup label="Reporting">
      <Link className="nav__link" href="/admin/analytics" id="nav-analytics" prefetch={false}>
        <span className="nav__link-label">Analytics</span>
      </Link>
    </NavGroup>
  )
}
