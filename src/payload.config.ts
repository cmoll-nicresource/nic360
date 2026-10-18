import { postgresAdapter } from '@payloadcms/db-postgres'
import { NewsletterDeliveries } from './collections/NewsletterDeliveries'
import { SesEvents } from './collections/SesEvents'
import { newsletterSendTask } from './jobs/newsletterSendTask'
import { operationsMonitorTask } from './jobs/operationsMonitorTask'
import { eventInvitationsTask } from './jobs/eventInvitationsTask'
import { OperationalAlerts } from './collections/OperationalAlerts'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import { s3Storage } from '@payloadcms/storage-s3'
import path from 'path'
import { buildConfig } from 'payload'
import { withWorkspaceVisibility } from './config/workspaceVisibility'
import type { Plugin } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { buildAccountEmailTransport } from './lib/accountEmailTransport'
import { assertTestIsolation } from './lib/testIsolation'

import { AccessProviders } from './collections/AccessProviders'
import { Articles } from './collections/Articles'
import { Bills } from './collections/Bills'
import { Countries } from './collections/Countries'
import { DatasetRows } from './collections/DatasetRows'
import { Datasets } from './collections/Datasets'
import { DiscountCodes } from './collections/DiscountCodes'
import { EmailFlags } from './collections/EmailFlags'
import { EventRegistrations } from './collections/EventRegistrations'
import { Events } from './collections/Events'
import { GuideFiles } from './collections/GuideFiles'
import { Guides } from './collections/Guides'
import { LivestreamPings } from './collections/LivestreamPings'
import { Locations } from './collections/Locations'
import { MailchimpOutbox } from './collections/MailchimpOutbox'
import { Media } from './collections/Media'
import { Orders } from './collections/Orders'
import { PageViews } from './collections/PageViews'
import { Products } from './collections/Products'
import { PublicationAds } from './collections/PublicationAds'
import { PublicationIssues } from './collections/PublicationIssues'
import { Publications } from './collections/Publications'
import { Sectors } from './collections/Sectors'
import { SesOutbox } from './collections/SesOutbox'
import { Sessions } from './collections/Sessions'
import { Sources } from './collections/Sources'
import { Speakers } from './collections/Speakers'
import { Sponsors } from './collections/Sponsors'
import { Staff } from './collections/Staff'
import { Subjects } from './collections/Subjects'
import { TrademarkImportRuns } from './collections/TrademarkImportRuns'
import { Trademarks } from './collections/Trademarks'
import { TradeImportRuns } from './collections/TradeImportRuns'
import { Users } from './collections/Users'
import { MailchimpSettings } from './globals/MailchimpSettings'
import { tmogImportTask } from './jobs/tmogImportTask'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
if (process.env.E2E_TEST_MODE === '1') assertTestIsolation()

// S3-compatible file storage (AWS S3 or Cloudflare R2) — leave S3_BUCKET
// unset in development to keep using local disk. Files stay served through
// Payload's own /api/{collection}/file route either way (no
// disablePayloadAccessControl), so plan-gated files like guide-files still
// go through real access control rather than a public bucket URL.
const plugins: Plugin[] = []
if (process.env.S3_BUCKET) {
  plugins.push(
    s3Storage({
      collections: {
        media: true,
        'guide-files': true,
      },
      bucket: process.env.S3_BUCKET,
      config: {
        region: process.env.S3_REGION || 'auto',
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
        },
        endpoint: process.env.S3_ENDPOINT,
        // R2 and most non-AWS S3-compatible endpoints need path-style
        // requests (bucket.s3.endpoint -> s3.endpoint/bucket).
        forcePathStyle: true,
      },
    }),
  )
}

export default buildConfig({
  admin: {
    user: Staff.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    components: {
      Nav: './components/admin/workspace/WorkspaceNav#WorkspaceNavigation',
      beforeNavLinks: ['./components/admin/workspace/WorkspaceNav#WorkspaceNav'],
      graphics: {
        Logo: './components/admin/graphics/Logo#Logo',
        Icon: './components/admin/graphics/Icon#Icon',
      },
      views: {
        connectedBrowsers: {
          Component: './components/admin/workspace/ConnectedBrowsers#ConnectedBrowsersView',
          path: '/connected-browsers',
          exact: true,
          meta: { title: 'Connected browsers' },
        },
        dashboard: {
          Component: './components/admin/workspace/WorkspaceDashboard#WorkspaceDashboard',
        },
        tradeReports: {
          Component: './components/admin/workspace/StaffTools#TradeReportsView',
          path: '/trade-reports',
          exact: true,
          meta: { title: 'Trade Barometer' },
        },
        trademarkReports: {
          Component: './components/admin/workspace/StaffTools#TrademarkReportsView',
          path: '/trademark-reports',
          exact: true,
          meta: { title: 'Trademark reports' },
        },
        datasetImports: {
          Component: './components/admin/workspace/StaffTools#DatasetImportsView',
          path: '/datasets',
          exact: true,
          meta: { title: 'Dataset imports' },
        },
        datasetImport: {
          Component: './components/admin/workspace/StaffTools#DatasetImportView',
          path: '/datasets/:id/import',
          exact: true,
          meta: { title: 'Import dataset' },
        },
        eventsWorkspace: {
          Component: './components/admin/workspace/StaffTools#EventsWorkspaceView',
          path: '/events',
          exact: true,
          meta: { title: 'Event management' },
        },
        manageEvent: {
          Component: './components/admin/workspace/StaffTools#ManageEventView',
          path: '/events/:id/manage',
          exact: true,
          meta: { title: 'Manage event' },
        },
        accessCheck: {
          Component: './components/admin/workspace/StaffTools#AccessCheckView',
          path: '/access-check',
          exact: true,
          meta: { title: 'Reader access' },
        },
        analytics: {
          Component: './components/admin/workspace/StaffTools#WorkspaceAnalyticsView',
          path: '/analytics',
          meta: { title: 'Analytics' },
        },
        companyReports: {
          Component: './components/admin/workspace/StaffTools#CompanyReportsView',
          path: '/company-reports',
          exact: true,
          meta: { title: 'Company usage reports' },
        },
      },
    },
    meta: {
      titleSuffix: '- Nic360',
      icons: [{ url: '/icon.png', type: 'image/png' }],
    },
  },
  collections: [
    Staff,
    Users,
    AccessProviders,
    Media,
    Sectors,
    Products,
    Subjects,
    Locations,
    Sources,
    Articles,
    Bills,
    Trademarks,
    Countries,
    Datasets,
    DatasetRows,
    Guides,
    GuideFiles,
    Publications,
    PublicationIssues,
    PublicationAds,
    EmailFlags,
    TrademarkImportRuns,
    TradeImportRuns,
    MailchimpOutbox,
    SesOutbox,
    NewsletterDeliveries,
    SesEvents,
    OperationalAlerts,
    Speakers,
    Sponsors,
    Events,
    Sessions,
    LivestreamPings,
    DiscountCodes,
    Orders,
    EventRegistrations,
    PageViews,
  ].map(withWorkspaceVisibility),
  globals: [MailchimpSettings],
  plugins,
  jobs: {
    tasks: [tmogImportTask, newsletterSendTask, operationsMonitorTask, eventInvitationsTask],
    // Ticks the 'tmog-import' queue every Friday at 12:00 UTC: picks up
    // whatever's queued (including the job the task's own `schedule` just
    // auto-queued for this tick) and runs it. Not used on serverless hosts,
    // but this project deploys as a persistent Railway service, so the
    // in-process cron check is fine.
    autoRun:
      process.env.E2E_TEST_MODE === '1'
        ? []
        : [
            { cron: '0 12 * * 5', queue: 'tmog-import', limit: 1 },
            { cron: '* * * * *', queue: 'newsletters', limit: 1 },
            { cron: '*/5 * * * *', queue: 'operations', limit: 1 },
            { cron: '* * * * *', queue: 'event-invitations', limit: 1 },
          ],
  },
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || '',
    },
  }),
  email: nodemailerAdapter({
    // Deliberately separate from SES_FROM_ADDRESS (used for publication
    // bulk sends, src/lib/ses/) — different MAIL FROM domain so a
    // newsletter send's bounce/complaint rate can't drag down deliverability
    // for password resets and other must-arrive account email.
    defaultFromAddress: process.env.SES_ACCOUNT_FROM_ADDRESS || 'no-reply@accounts.nicotine360.org',
    defaultFromName: 'Nicotine360',
    // Safe-mode-wrapped transport built in accountEmailTransport.ts (and
    // unit-tested there) rather than inline, so the safe-mode wiring itself
    // is regression-tested — see accountEmailTransport.test.ts.
    transport: buildAccountEmailTransport(),
  }),
  sharp,
})
