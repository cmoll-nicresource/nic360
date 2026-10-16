import { createLocalReq, type Payload, type PayloadRequest } from 'payload'
import type { PostgresAdapter } from '@payloadcms/db-postgres'

export function transactionDb(payload: Payload, transactionID: unknown) {
  const session = (payload.db as unknown as PostgresAdapter).sessions[String(transactionID)]
  if (!session) throw new Error('Postgres transaction session is missing')
  return session.db
}

export async function inPayloadTransaction<T>(
  payload: Payload,
  work: (req: PayloadRequest) => Promise<T>,
): Promise<T> {
  const transactionID = await payload.db.beginTransaction()
  if (!transactionID) throw new Error('Database transactions are required')
  try {
    const req = await createLocalReq(
      { context: { newsletterSystem: true }, req: { transactionID } },
      payload,
    )
    const result = await work(req)
    await payload.db.commitTransaction(transactionID)
    return result
  } catch (error) {
    await payload.db.rollbackTransaction(transactionID)
    throw error
  }
}
