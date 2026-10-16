import { getPayload } from 'payload'
import { readUnsubscribeToken } from '@/lib/ses/unsubscribe'
import { inPayloadTransaction } from '@/lib/payloadTransaction'
import { flagUserByEmail } from '@/lib/emailFlags'
import config from '@/payload.config'

const headers = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store',
  'referrer-policy': 'no-referrer',
  'x-robots-tag': 'noindex',
  'content-security-policy':
    "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'",
}
function page(text: string, form = '') {
  return `<!doctype html><html><head><title>Nicotine360 email preferences</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="font:17px Arial;max-width:600px;margin:80px auto;padding:24px;color:#1c4066"><h1>Email preferences</h1><p>${text}</p>${form}</body></html>`
}
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token') || ''
  if (!readUnsubscribeToken(token))
    return new Response(
      page('This unsubscribe link is invalid. Please manage your preferences from your account.'),
      { status: 400, headers },
    )
  return new Response(
    page(
      'Unsubscribe from all Nicotine360 publication emails? Your site access and account emails will continue.',
      `<form method="post"><input type="hidden" name="confirm" value="yes"><button type="submit" style="padding:12px 20px">Unsubscribe</button></form>`,
    ),
    { headers },
  )
}
export async function POST(request: Request) {
  const token = readUnsubscribeToken(new URL(request.url).searchParams.get('token') || '')
  if (!token)
    return new Response(page('This unsubscribe link is invalid.'), { status: 400, headers })
  const body = new URLSearchParams(await request.text())
  if (body.get('List-Unsubscribe') !== 'One-Click' && body.get('confirm') !== 'yes')
    return new Response(page('Please confirm your choice.'), { status: 400, headers })
  if (token.test)
    return new Response(page('This is a test link. No reader preferences were changed.'), {
      headers,
    })
  const payload = await getPayload({ config })
  await inPayloadTransaction(payload, async (req) => {
    const user = await payload
      .findByID({ collection: 'users', id: token.userId, depth: 0, overrideAccess: true, req })
      .catch(() => null)
    if (user?.email.toLowerCase() === token.email)
      await flagUserByEmail(payload, token.email, 'unsubscribed', new Date().toISOString(), req)
  })
  // No account or address is exposed by a signed link's result.
  return new Response(
    page(
      'You have been unsubscribed from publication emails. You can contact our team if you would like to resume them.',
    ),
    { headers },
  )
}
