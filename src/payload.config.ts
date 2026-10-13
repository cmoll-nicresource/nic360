import { SendRawEmailCommand, SESClient } from '@aws-sdk/client-ses'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import { s3Storage } from '@payloadcms/storage-s3'
import path from 'path'
import { buildConfig } from 'payload'
import type { Plugin } from 'payload'
import { fileURLToPath } from 'url'
import nodemailer from 'nodemailer'
import sharp from 'sharp'

import { applyEmailSafeMode } from './lib/emailSafeMode'

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
import { Users } from './collections/Users'
import { MailchimpSettings } from './globals/MailchimpSettings'
import { consoleEmailTransport } from './lib/consoleEmailTransport'
import { tmogImportTask } from './jobs/tmogImportTask'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const hasSesConfig = Boolean(process.env.SES_ACCESS_KEY_ID && process.env.SES_SECRET_ACCESS_KEY)

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
      afterNavLinks: ['./components/admin/AnalyticsNavLink#AnalyticsNavLink'],
      graphics: {
        Logo: './components/admin/graphics/Logo#Logo',
        Icon: './components/admin/graphics/Icon#Icon',
      },
      views: {
        analytics: {
          Component: './components/admin/analytics/AnalyticsView#AnalyticsView',
          path: '/analytics',
          meta: { title: 'Analytics' },
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
    MailchimpOutbox,
    SesOutbox,
    Speakers,
    Sponsors,
    Events,
    Sessions,
    LivestreamPings,
    DiscountCodes,
    Orders,
    EventRegistrations,
    PageViews,
  ],
  globals: [MailchimpSettings],
  plugins,
  jobs: {
    tasks: [tmogImportTask],
    // Ticks the 'tmog-import' queue every Friday at 12:00 UTC: picks up
    // whatever's queued (including the job the task's own `schedule` just
    // auto-queued for this tick) and runs it. Not used on serverless hosts,
    // but this project deploys as a persistent Railway service, so the
    // in-process cron check is fine.
    autoRun: [{ cron: '0 12 * * 5', queue: 'tmog-import', limit: 1 }],
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
  email: (() => {
    // Everything moved to SES (no more Mandrill) — same AWS credentials the
    // publication-issue bulk sender uses (src/lib/ses/), so there's one
    // email-sending system end to end rather than two.
    const transport = hasSesConfig
      ? nodemailer.createTransport(
          // @types/nodemailer's createTransport overloads don't cover the
          // {SES: {...}} shorthand (it has no dependency on @aws-sdk/client-ses
          // types) — this is still real, documented nodemailer behavior:
          // https://nodemailer.com/transports/ses/
          {
            SES: {
              ses: new SESClient({
                region: process.env.SES_REGION || 'us-east-1',
                credentials: {
                  accessKeyId: process.env.SES_ACCESS_KEY_ID!,
                  secretAccessKey: process.env.SES_SECRET_ACCESS_KEY!,
                },
              }),
              aws: { SendRawEmailCommand },
            },
          } as Parameters<typeof nodemailer.createTransport>[0],
        )
      : // No SES_* env set: print emails to the console instead of sending them.
        nodemailer.createTransport(consoleEmailTransport)

    // Real migrated user data lives in this environment — this is the hard
    // safety net against ever emailing one of them by accident. See
    // src/lib/emailSafeMode.ts; requires an explicit EMAIL_SAFE_MODE=off to
    // actually deliver to a real recipient.
    applyEmailSafeMode(transport)

    return nodemailerAdapter({
      defaultFromAddress: process.env.SES_FROM_ADDRESS || 'no-reply@nicotine360.org',
      defaultFromName: 'Nicotine360',
      transport,
    })
  })(),
  sharp,
})
