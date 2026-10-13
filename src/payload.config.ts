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

const hasMandrillConfig = Boolean(process.env.MANDRILL_SMTP_HOST && process.env.MANDRILL_API_KEY)

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
  email: hasMandrillConfig
    ? nodemailerAdapter({
        defaultFromAddress: process.env.MANDRILL_FROM_ADDRESS || 'no-reply@nicotine360.org',
        defaultFromName: 'Nicotine360',
        transport: nodemailer.createTransport({
          host: process.env.MANDRILL_SMTP_HOST,
          port: Number(process.env.MANDRILL_SMTP_PORT) || 587,
          auth: {
            user: process.env.MANDRILL_SMTP_USER || 'apikey',
            pass: process.env.MANDRILL_API_KEY,
          },
        }),
      })
    : nodemailerAdapter({
        defaultFromAddress: 'no-reply@nicotine360.org',
        defaultFromName: 'Nicotine360 (dev)',
        // No MANDRILL_* env set: print emails to the console instead of sending them.
        transport: nodemailer.createTransport(consoleEmailTransport),
      }),
  sharp,
})
