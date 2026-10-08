import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import nodemailer from 'nodemailer'
import sharp from 'sharp'

import { AccessProviders } from './collections/AccessProviders'
import { Media } from './collections/Media'
import { Staff } from './collections/Staff'
import { Users } from './collections/Users'

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
  collections: [Staff, Users, AccessProviders, Media],
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
        // No MANDRILL_* env set: log emails to the console instead of sending them.
        transport: nodemailer.createTransport({ jsonTransport: true }),
      }),
  sharp,
})
