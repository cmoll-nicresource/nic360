import { SMTPServer } from 'smtp-server'
import { simpleParser } from 'mailparser'
import { createServer } from 'node:http'
import { applyTestEnvironment } from './environment'
applyTestEnvironment()
const messages: { subject: string; html: string; text: string; to: string; receivedAt: string }[] =
  []
const smtp = new SMTPServer({
  authOptional: true,
  disabledCommands: ['AUTH', 'STARTTLS'],
  onData(stream, _session, callback) {
    simpleParser(stream)
      .then((mail) => {
        messages.push({
          subject: mail.subject ?? '',
          html: typeof mail.html === 'string' ? mail.html : '',
          text: mail.text ?? '',
          to: typeof mail.to === 'object' && !Array.isArray(mail.to) ? mail.to.text : '',
          receivedAt: new Date().toISOString(),
        })
        callback()
      })
      .catch(callback)
  },
})
smtp.listen(2525, '127.0.0.1')
createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  if (req.url === '/messages' && req.method === 'GET') return res.end(JSON.stringify(messages))
  if (req.url === '/messages' && req.method === 'DELETE') {
    messages.length = 0
    return res.end('{}')
  }
  res.end('{"ok":true}')
}).listen(2526, '127.0.0.1', () => console.log('Isolated SMTP capture ready'))
