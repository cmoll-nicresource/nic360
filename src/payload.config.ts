import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import path from 'path'
import { buildConfig } from 'payload'
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
import { Locations } from './collections/Locations'
import { MailchimpOutbox } from './collections/MailchimpOutbox'
import { Media } from './collections/Media'
import { Orders } from './collections/Orders'
import { Products } from './collections/Products'
import { PublicationIssues } from './collections/PublicationIssues'
import { Publications } from './collections/Publications'
import { Sectors } from './collections/Sectors'
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

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const hasMandrillConfig = Boolean(process.env.MANDRILL_SMTP_HOST && process.env.MANDRILL_API_KEY)

export default buildConfig({
  admin: {
    user: Staff.slug,
    importMap: {
      baseDir: path.resolve(dirname),
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
    EmailFlags,
    TrademarkImportRuns,
    MailchimpOutbox,
    Speakers,
    Sponsors,
    Events,
    Sessions,
    DiscountCodes,
    Orders,
    EventRegistrations,
  ],
  globals: [MailchimpSettings],
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
