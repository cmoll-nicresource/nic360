import type { AdminViewServerProps } from 'payload'
import {
  requireWorkspaceRole,
  WorkspacePage,
  WorkspaceShell,
} from './workspace/WorkspaceShell'
import { GenerateResearchDigest } from './GenerateResearchDigest'
export function ResearchReportsView(props: AdminViewServerProps) {
  requireWorkspaceRole(props)
  return (
    <WorkspaceShell props={props}>
      <WorkspacePage
        title="Monthly Research Digest"
        eyebrow="INDUSTRY RESEARCH"
        description="Generate a journal-grouped PDF from published research, then review the draft issue before sending."
        actions={
          <a
            href="/api/admin/research-extension"
            download="nic360-research-clipper.zip"
          >
            Download Research Clipper ↗
          </a>
        }
      >
        <GenerateResearchDigest />
      </WorkspacePage>
    </WorkspaceShell>
  )
}
