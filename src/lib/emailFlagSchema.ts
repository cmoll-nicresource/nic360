import type { PoolClient } from 'pg'

/** Run inside a transaction, before deploying code that uses recipientEmail. */
export async function migrateEmailFlagSchema(client: PoolClient): Promise<void> {
  // Lock both tables while copying addresses so an account cannot disappear mid-backfill.
  await client.query('LOCK TABLE users, email_flags IN SHARE ROW EXCLUSIVE MODE')
  await client.query('ALTER TABLE email_flags ADD COLUMN IF NOT EXISTS recipient_email varchar')
  await client.query(`UPDATE email_flags f SET recipient_email = lower(trim(u.email))
    FROM users u WHERE f.user_id = u.id AND f.recipient_email IS NULL`)
  const { rows } = await client.query(`SELECT count(*)::int AS missing FROM email_flags
    WHERE recipient_email IS NULL OR trim(recipient_email) = ''`)
  if (rows[0].missing > 0)
    throw new Error('Email flags without a recoverable address require review before migration.')
  await client.query('ALTER TABLE email_flags ALTER COLUMN user_id DROP NOT NULL')
}
