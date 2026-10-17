import type { AdminViewServerProps } from 'payload'
import { requireWorkspaceRole, WorkspacePage, WorkspaceShell } from './WorkspaceShell'
import { ConnectedBrowserList } from './ConnectedBrowserList'
export function ConnectedBrowsersView(props: AdminViewServerProps) {
  requireWorkspaceRole(props)
  return <WorkspaceShell props={props}><WorkspacePage title="Connected browsers" description="Manage your News Clipper connections. Each expires after 12 hours; disconnect a browser at any time.">
    <ConnectedBrowserList />
  </WorkspacePage></WorkspaceShell>
}
