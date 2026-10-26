/** Account email uses the configured origin, never an incoming Host header. */
export function accountSiteUrl(): string {
  const url = new URL(process.env.SITE_URL || 'http://localhost:3000')
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password)
    throw new Error('Account email requires an HTTP(S) SITE_URL without credentials.')
  return url.origin
}

function absolute(path: string): string {
  if (!path.startsWith('/') || path.startsWith('//')) throw new Error('Expected a site path.')
  return new URL(path, accountSiteUrl()).href
}

function escape(value: string): string {
  return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

type Message = {
  preview: string
  title: string
  name?: string | null
  content: string
  action?: { label: string; path: string }
  note?: string
  code?: string
}

function render({ preview, title, name, content, action, note, code }: Message): string {
  const url = action ? absolute(action.path) : undefined
  const link = (path: string, label: string) => `<a href="${escape(absolute(path))}" style="color:#285888;text-decoration:underline;">${label}</a>`
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} · Nicotine360</title>
<style>@media(max-width:480px){.account-pad{padding-left:22px!important;padding-right:22px!important}.account-title{font-size:28px!important}}</style></head>
<body style="margin:0;padding:0;background:#edf1f4;color:#253547;font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escape(preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#edf1f4;"><tr><td align="center" style="padding:28px 10px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #dce4eb;border-top:4px solid #1c4066;">
<tr><td class="account-pad" style="padding:28px 36px 24px;border-bottom:1px solid #dce4eb;"><a href="${escape(absolute('/'))}"><img src="${escape(absolute('/logo.png'))}" width="184" alt="Nicotine360" border="0" style="display:block;width:184px;max-width:100%;height:auto;"></a></td></tr>
<tr><td class="account-pad" style="padding:32px 36px 16px;">
<p style="margin:0 0 12px;color:#596a7b;font-size:12px;letter-spacing:1.2px;">YOUR NICOTINE360 ACCOUNT</p>
<h1 class="account-title" style="margin:0 0 24px;color:#1c4066;font:normal 32px/1.2 Georgia,'Times New Roman',serif;">${escape(title)}</h1>
<p style="margin:0 0 16px;font-size:16px;line-height:1.65;">${name?.trim() ? `Hello ${escape(name.trim())},` : 'Hello,'}</p>
${content}
${code ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:22px 12px;background:#f3f6f8;border:1px solid #dce4eb;font:bold 32px/1.4 Arial,Helvetica,sans-serif;letter-spacing:7px;color:#1c4066;">${escape(code)}</td></tr></table>` : ''}
${url ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;"><tr><td bgcolor="#1c4066" style="border-radius:4px;mso-padding-alt:14px 24px;"><a href="${escape(url)}" style="display:inline-block;padding:14px 24px;border:1px solid #1c4066;border-radius:4px;color:#ffffff;font:bold 16px/1.4 Arial,Helvetica,sans-serif;text-decoration:none;">${escape(action!.label)}</a></td></tr></table>` : ''}
${note ? `<p style="margin:20px 0;padding:16px;background:#f3f6f8;border-left:3px solid #c4662d;font-size:14px;line-height:1.65;">${escape(note)}</p>` : ''}
${url ? `<p style="margin:22px 0 8px;font-size:13px;line-height:1.6;color:#596a7b;">If the button doesn't open, copy this complete address into your browser:</p><p style="margin:0 0 20px;font-size:13px;line-height:1.65;word-break:break-all;overflow-wrap:anywhere;"><a href="${escape(url)}" style="color:#285888;text-decoration:underline;word-break:break-all;">${escape(url)}</a></p>` : ''}
</td></tr>
<tr><td class="account-pad" style="padding:20px 36px 28px;border-top:1px solid #dce4eb;font-size:13px;line-height:1.7;color:#596a7b;">Need help? <a href="mailto:membership@nicotine360.org" style="color:#285888;text-decoration:underline;">Contact our team</a>.<br>${link('/', 'Nicotine360')} · Nicotine Resource Consortium<br>${link('/privacy', 'Privacy policy')}</td></tr>
</table></td></tr></table></body></html>`
}

const paragraph = (text: string) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.65;">${escape(text)}</p>`

export function passwordResetEmail({ token, name, staff = false, invitation = false }: {
  token?: string; name?: string | null; staff?: boolean; invitation?: boolean
}): string {
  if (!token) throw new Error('A password reset token is required.')
  return render({
    title: invitation ? 'Your event registration is ready' : 'Reset your password',
    preview: invitation ? 'Set your password to access your Nicotine360 event registration.' : 'Choose a new password for your Nicotine360 account. This link expires in one hour.',
    name,
    content: invitation
      ? paragraph('An event registration has been created for you on Nicotine360. Set your password to sign in and view your event details.') + paragraph('Use the email address that received this invitation when you sign in. If you weren’t expecting a registration, please contact our team.')
      : paragraph(`We received a request to reset the password for your Nicotine360${staff ? ' staff' : ''} account. Use the button below to choose a new password.`) + paragraph('If you didn’t request this, you can ignore this email. Your password will stay the same until you choose a new one.'),
    action: { label: invitation ? 'Set your password' : 'Reset password', path: `${staff ? '/admin/reset/' : '/reset-password/'}${encodeURIComponent(token)}` },
    note: 'This link expires in one hour. If you request another link, use the newest email.' + (!staff ? ' Choosing a password does not change your subscription or publication email preferences.' : ''),
  })
}

export function signupCodeEmail(code: string): string {
  if (!/^\d{6}$/.test(code)) throw new Error('A six-digit verification code is required.')
  return render({
    title: 'Verify your email address', preview: `Your Nicotine360 verification code is ${code}. It expires in 15 minutes.`,
    content: paragraph('Thanks for joining Nicotine360. Enter this code on the signup screen to verify your email address and continue creating your account.'),
    code,
    note: 'Your code expires in 15 minutes. Keep your signup screen open and use the newest code if you request another. If you didn’t start this signup, you can ignore this email.',
  })
}

/** Payload's native verification screen handles staff-created, unverified site accounts. */
export function accountVerificationEmail(token: string, name?: string | null): string {
  if (!token) throw new Error('An email verification token is required.')
  return render({
    title: 'Confirm your email address', preview: 'Confirm your email address for your Nicotine360 account.', name,
    content: paragraph('An account has been created for you on Nicotine360. Confirm your email address to verify that it belongs to you.'),
    action: { label: 'Confirm email address', path: `/admin/users/verify/${encodeURIComponent(token)}` },
    note: 'If you weren’t expecting this account, you can ignore this email or contact our team.',
  })
}
