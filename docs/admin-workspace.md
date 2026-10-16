# Staff workspace

`/admin` is the central staff home. The branded dashboard groups publishing, imports/reports and operations, with live draft counts, upcoming events, email flags (gatekeeper+), recent trade runs and draft issues. Payload's native collection editors remain available in the sidebar, grouped by `src/config/adminGroups.ts`.

## Tools and access

| Route | Task | Minimum role |
| --- | --- | --- |
| `/admin` | Workspace dashboard | Editor |
| `/admin/trade-reports` | Census upload and Trade Barometer generation | Editor |
| `/admin/trademark-reports` | Live USPTO import and trademark reports | Gatekeeper |
| `/admin/datasets` | Choose a dataset to import | Editor |
| `/admin/datasets/:id/import` | Dataset import wizard | Editor |
| `/admin/events` | Choose an event to manage | Editor |
| `/admin/events/:id/manage` | Event operations | Editor; registrations/attendees require gatekeeper |
| `/admin/analytics` | Reader, publication and ad analytics | Gatekeeper |
| `/admin/access-check` | Effective reader plans and membership providers | Gatekeeper |

The old `/staff/trade-reports`, `/staff/trademark-reports`, `/staff/datasets/:id/import`, `/staff/events/:id/manage`, and `/access-check` pages redirect to their new admin locations. The public navigation now has one Admin entry; collection edit screens link to the new tools in the same tab. Existing import and event APIs keep their URLs and server-side permissions.

## Implementation

- Register root views and the dashboard in `src/payload.config.ts`; regenerate `src/app/(payload)/admin/importMap.js` when changing component paths.
- `components/admin/workspace/WorkspaceDashboard.tsx` replaces the default collection-card dashboard. It inherits Payload's existing dashboard template.
- Other custom root views use `WorkspaceShell` to supply Payload's `DefaultTemplate`. Custom root views do not automatically receive its navigation, so omit neither the shell nor its permissions/request props.
- `requireWorkspaceRole` checks the authenticated server principal (`initPageResult.req.user`) before queries. Anonymous/reader accounts redirect to staff login; staff below the required role receive not-found. The filtered `props.user` is used only for client-facing template context.
- Queries use the authenticated request and `overrideAccess: false`. Event attendee data and user pickers are loaded only after the gatekeeper check. Reader access diagnostics no longer query user data from an unprotected front-end page.
- `config/staffWorkspace.ts` defines role-aware task links and validates numeric IDs in dynamic view paths. Native collection permissions still govern edits, publication sends, and settings.
- `app/(payload)/custom.css` contains scoped brand, layout and form styles with light/dark variants and mobile layouts. It does not load the public site's stylesheet into admin.

## Verification

289 offline tests pass, including task destinations, reader/anonymous exclusion, role-specific navigation and dynamic path validation. TypeScript and targeted lint checks pass. Authenticated local browser checks covered editor/gatekeeper dashboard and tools, dataset import and event management routes, anonymous login redirects, direct rejection of restricted editor routes, and 390px mobile layouts. Temporary local test accounts were removed after checks. New UI checks did not confirm imports, create event records or send publications.

When reviewing styles, wait for `.template-default--nav-hydrated` and the sidebar transition to finish before screenshots. Check the sidebar both open and closed, forms on mobile, and both themes. Older links should redirect through the same role checks.

## Beta release

Deployed October 15, 2026: Railway deployment `663944d0-03eb-4972-8047-4e45072b0fe9` reached `SUCCESS`. Live browser checks confirmed staff-login navigation for the dashboard and all six tool roots. HTTP checks confirmed redirects for all five legacy route patterns. Next.js may stream the admin login redirect in a 200 response; check the final browser URL rather than requiring an HTTP 3xx for custom admin views. Authenticated tool and role checks were completed locally; no beta accounts or data were created for this release.
# Current additions

Issue creation/edit forms include **Preview issue**, using unsaved form contents, desktop/mobile widths and an attached PDF view. Refresh after edits; sending a test still uses saved data. **Operational alerts** is linked under Operations, with staff-only records and deduplicated staff email notifications; see [operations](./operations.md). Current work status is maintained in [project-status.md](./project-status.md).
