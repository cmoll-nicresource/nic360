import { requireStaff } from '@/lib/requireStaff'
import { applyProviderMerge, inspectProviderMerge, providerMergeIds, ProviderMergeError } from '@/lib/mergeAccessProvider'

export async function POST(request: Request) {
  try {
    const { payload, user } = await requireStaff('admin')
    // Next's internal URL can differ behind a proxy; use the configured public origin.
    if (request.headers.get('origin') !== new URL(payload.config.serverURL || 'http://localhost:3000').origin)
      return Response.json({ error: 'A same-origin request is required.' }, { status: 403 })
    let input
    try { input = await request.json() } catch { throw new ProviderMergeError('Invalid request.') }
    if (!input || !['preview', 'merge'].includes(input.action)) throw new ProviderMergeError('Choose preview or merge.')
    const { sourceId, targetId } = providerMergeIds(input.sourceId, input.targetId)
    if (input.action === 'merge' && (input.confirm !== true || typeof input.fingerprint !== 'string'))
      throw new ProviderMergeError('Review and confirm the merge first.')
    const client = await payload.db.pool.connect()
    try {
      await client.query(input.action === 'preview' ? 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY' : 'BEGIN')
      await client.query("SET LOCAL lock_timeout = '5s'")
      await client.query("SET LOCAL statement_timeout = '15s'")
      const preview = input.action === 'preview'
        ? (await inspectProviderMerge(client, sourceId, targetId)).preview
        : await applyProviderMerge(client, sourceId, targetId, input.fingerprint)
      await client.query('COMMIT')
      if (input.action === 'merge') payload.logger.info({ event: 'access-provider-merged', staffId: user?.id, sourceId, targetId, usersMoved: preview.source.users, discountCodesMoved: preview.discountCodesToMove }, 'Access provider merged')
      return Response.json({ preview, merged: input.action === 'merge' }, { headers: { 'Cache-Control': 'private, no-store' } })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally { client.release() }
  } catch (error) {
    if (error instanceof Response) return error
    if (error instanceof ProviderMergeError) return Response.json({ error: error.message }, { status: error.status })
    console.error('Access provider merge failed', error)
    return Response.json({ error: 'Unable to merge. Nothing was changed. Please preview and try again.' }, { status: 500 })
  }
}
