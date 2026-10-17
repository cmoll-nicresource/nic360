import fs from 'node:fs/promises'
import path from 'node:path'
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'

const directory = '.test-artifacts/email-review'
const files = (await fs.readdir(directory)).filter(name => name.endsWith('.html')).sort()
if (files.length !== 5) throw new Error('Generate exactly five synthetic publication review layouts first.')
if (!process.argv.includes('--send-to-approved-staff')) {
  console.log(JSON.stringify({ dryRun: true, recipient: 'cmoll@nicotineresource.org', files }))
} else {
  const client = new SESClient({ region: 'us-east-1' })
  const deliveries = []
  for (const file of files) {
    const html = (await fs.readFile(path.join(directory, file), 'utf8'))
      .replaceAll('http://127.0.0.1:3100', 'https://beta.nicotine360.org')
      .replace(/<body([^>]*)>/i, '<body$1><p style="padding:12px;color:#243746;background:#eef3f8;font:14px Arial,sans-serif">Staff layout review: synthetic content and dates. Preview unsubscribe and contents links are disabled. No reader audience was sent this copy.</p>')
    const result = await client.send(new SendEmailCommand({
      Source: 'Nicotine360 Review <noreply@nicotineresource.org>',
      Destination: { ToAddresses: ['cmoll@nicotineresource.org'] },
      Message: {
        Subject: { Data: '[TEST layout review] ' + file.replace('.html', '').replaceAll('-', ' '), Charset: 'UTF-8' },
        Body: { Html: { Data: html, Charset: 'UTF-8' } },
      },
    }))
    deliveries.push({ file, messageId: result.MessageId, acceptedAt: new Date().toISOString() })
  }
  await fs.writeFile('.test-artifacts/email-delivery.json', JSON.stringify(deliveries, null, 2))
  console.log(JSON.stringify({ accepted: deliveries.length, recipient: 'cmoll@nicotineresource.org', evidence: '.test-artifacts/email-delivery.json' }))
}
