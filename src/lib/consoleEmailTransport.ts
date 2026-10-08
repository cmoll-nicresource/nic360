import type MailMessage from 'nodemailer/lib/mailer/mail-message'

/**
 * A minimal nodemailer transport plugin that prints each email to the
 * console instead of sending it. Used in development when no MANDRILL_*
 * env vars are set, so account emails (verification, password reset,
 * event-invite) are actually visible while testing instead of silently
 * vanishing (nodemailer's built-in `jsonTransport` returns the message as
 * JSON but doesn't print anything anywhere).
 */
export const consoleEmailTransport = {
  name: 'console',
  version: '1.0.0',
  send(mail: MailMessage, callback: (err: Error | null, info?: { envelope: unknown; messageId: string }) => void) {
    mail.resolveContent(mail.data, 'html', (err: Error | null, html?: string) => {
      if (err) {
        callback(err)
        return
      }
      console.log('\n--- DEV EMAIL (not actually sent; set MANDRILL_* to send for real) ---')
      console.log('To:', mail.data.to)
      console.log('Subject:', mail.data.subject)
      console.log(html)
      console.log('--- END EMAIL ---\n')
      callback(null, { envelope: mail.message.getEnvelope(), messageId: mail.message.messageId() })
    })
  },
}
