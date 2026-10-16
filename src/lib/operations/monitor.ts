import type { Payload } from 'payload'
import { expectedGazette, newsletterCondition, type AlertCondition } from './conditions'
import { SITE_URL } from '@/lib/env'

export async function collectOperationalConditions(
  payload: Payload,
  since: Date,
  now: Date,
): Promise<AlertCondition[]> {
  const conditions: AlertCondition[] = []
  let page = 1
  for (;;) {
    const result = await payload.find({
      collection: 'publication-issues',
      depth: 0,
      draft: true,
      limit: 100,
      page,
      overrideAccess: true,
      where: {
        and: [
          { updatedAt: { greater_than_equal: since.toISOString() } },
          { 'email.status': { in: ['failed', 'sending'] } },
        ],
      },
    })
    for (const issue of result.docs) {
      const condition = newsletterCondition(issue, now)
      if (!condition) continue
      if (issue.email?.status === 'sending') {
        // Large audiences legitimately take longer than ten minutes. Use the
        // sender's own lock to distinguish an active worker from a lost one.
        const client = await payload.db.pool.connect()
        try {
          const { rows } = await client.query(
            'SELECT pg_try_advisory_lock(36031,$1) AS available',
            [issue.id],
          )
          if (!rows[0].available) continue
          await client.query('SELECT pg_advisory_unlock(36031,$1)', [issue.id])
        } finally {
          client.release()
        }
      }
      conditions.push(condition)
    }
    if (!result.hasNextPage) break
    page++
  }
  for (const collection of ['trademark-import-runs', 'trade-import-runs'] as const) {
    page = 1
    const seen = new Set<string>()
    for (;;) {
      const result = await payload.find({
        collection,
        depth: 0,
        limit: 100,
        page,
        sort: '-startedAt',
        overrideAccess: true,
        where: { startedAt: { greater_than_equal: since.toISOString() } },
      })
      for (const run of result.docs) {
        // A newer attempt for the same Gazette/upload supersedes old failures.
        const group =
          'issueDate' in run && run.issueDate
            ? run.issueDate
            : 'files' in run && run.files
              ? JSON.stringify(run.files)
              : `run:${run.id}`
        if (seen.has(group)) continue
        seen.add(group)
        const stalled =
          run.status === 'running' && now.getTime() - Date.parse(run.startedAt) > 2 * 3600_000
        if (run.status === 'failed' || stalled || (run.status === 'succeeded' && run.error))
          conditions.push({
            key: `${collection}:${run.id}`,
            title: `${collection === 'trademark-import-runs' ? 'Trademark' : 'Trade'} ${stalled ? 'import stalled' : run.status === 'succeeded' ? 'report blocked' : 'import failed'}`,
            message: stalled
              ? 'Import has been running for more than two hours. Inspect its history and job before starting another.'
              : run.error || 'Review this import run for details.',
            path: `/admin/collections/${collection}/${run.id}`,
          })
      }
      if (!result.hasNextPage) break
      page++
    }
  }
  const expected = expectedGazette(now)
  // No retrospective alarms for weeks before this monitor was enabled.
  if (expected.due >= since) {
    const ymd = expected.issueDate.replaceAll('-', '')
    const result = await payload.find({
      collection: 'trademark-import-runs',
      depth: 1,
      limit: 100,
      overrideAccess: true,
      where: {
        and: [
          { issueDate: { equals: `${expected.issueDate}T00:00:00.000Z` } },
          { status: { equals: 'succeeded' } },
          {
            feedSource: {
              equals: `https://cdn.uspto.gov/doc/TMOGIssue_${ymd}_entire?extension=xml`,
            },
          },
        ],
      },
    })
    if (!result.docs.length)
      conditions.push({
        key: `gazette-missing:${ymd}`,
        title: 'Scheduled trademark import is missing',
        message: `No successful official Gazette import for ${expected.issueDate} by Friday 16:00 UTC. Run that issue date in Trademark reports.`,
        path: '/admin/trademark-reports',
      })
    else {
      const withActivity = result.docs.some(
        (run) =>
          (run.counts?.published || 0) +
            (run.counts?.renewals || 0) +
            (run.counts?.cancellations || 0) >
          0,
      )
      const publications = await payload.find({
        collection: 'publications',
        where: { generator: { equals: 'weekly-trademark-report' } },
        depth: 0,
        limit: 100,
        overrideAccess: true,
      })
      const reports = publications.docs.length
        ? await payload.find({
            collection: 'publication-issues',
            draft: true,
            depth: 0,
            limit: 1,
            overrideAccess: true,
            where: {
              and: [
                { publication: { in: publications.docs.map((pub) => pub.id) } },
                {
                  issueDate: {
                    greater_than_equal: `${expected.issueDate}T00:00:00.000Z`,
                    less_than: new Date(Date.parse(expected.issueDate) + 86400_000).toISOString(),
                  },
                },
                { file: { exists: true } },
              ],
            },
          })
        : null
      const reportExists = !!reports?.docs.length
      if (withActivity && !reportExists)
        conditions.push({
          key: `report-missing:${ymd}`,
          title: 'Scheduled trademark report is missing',
          message: `The ${expected.issueDate} Gazette imported reportable activity but has no surviving PDF issue attached to its run. Generate the report and inspect the run.`,
          path: '/admin/trademark-reports',
        })
    }
  }
  return conditions
}

const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  )

/** Durable deduplication under one cross-instance lock. Alert email never uses the reader audience. */
export async function runOperationalMonitor(payload: Payload, now = new Date()) {
  if (process.env.OPERATIONS_MONITOR_ENABLED !== 'true') return { skipped: true }
  const since = new Date(process.env.OPERATIONS_MONITOR_SINCE || '')
  if (!Number.isFinite(since.getTime()))
    throw new Error('OPERATIONS_MONITOR_SINCE must be a valid activation timestamp.')
  const recipient = process.env.OPERATIONS_ALERT_EMAIL || ''
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(recipient))
    throw new Error('Configure one OPERATIONS_ALERT_EMAIL staff address.')
  const lock = await payload.db.pool.connect()
  try {
    const { rows } = await lock.query('SELECT pg_try_advisory_lock(36032,1) AS available')
    if (!rows[0].available) return { skipped: true }
    const conditions = await collectOperationalConditions(payload, since, now)
    for (const alert of conditions) {
      await lock.query(
        `INSERT INTO operational_alerts (alert_key,title,message,source_path,resolved,last_seen_at)
        VALUES ($1,$2,$3,$4,false,$5) ON CONFLICT (alert_key) DO UPDATE SET title=$2,message=$3,source_path=$4,
        notified_at=CASE WHEN operational_alerts.resolved THEN NULL ELSE operational_alerts.notified_at END,
        notification_attempted_at=CASE WHEN operational_alerts.resolved THEN NULL ELSE operational_alerts.notification_attempted_at END,
        resolved=false,last_seen_at=$5,updated_at=$5`,
        [alert.key, alert.title, alert.message, alert.path, now],
      )
    }
    await lock.query(
      'UPDATE operational_alerts SET resolved=true,updated_at=$1 WHERE resolved=false AND NOT (alert_key=ANY($2::varchar[]))',
      [now, conditions.map((a) => a.key)],
    )
    const pending = await lock.query(
      `SELECT * FROM operational_alerts WHERE resolved=false AND notified_at IS NULL
      AND (notification_attempted_at IS NULL OR notification_attempted_at < $1) ORDER BY created_at LIMIT 20`,
      [new Date(now.getTime() - 3600_000)],
    )
    if (pending.rows.length) {
      const ids = pending.rows.map((r) => r.id)
      // Persist the attempt first: a crash/timeout cannot produce a five-minute email storm.
      await lock.query(
        'UPDATE operational_alerts SET notification_attempted_at=$1 WHERE id=ANY($2::int[])',
        [now, ids],
      )
      try {
        await payload.sendEmail({
          to: recipient,
          subject: `[Nicotine360 operations] ${ids.length} item${ids.length === 1 ? '' : 's'} need attention`,
          html: `<h1>Nicotine360 operations</h1>${pending.rows.map((r) => `<h2>${escape(r.title)}</h2><p>${escape(r.message)}</p><p><a href="${escape(new URL(r.source_path, SITE_URL).href)}">Review in admin</a></p>`).join('')}<p>Alerts remain in the admin until the underlying condition is fixed. Each alert is emailed once; failed notification attempts retry after one hour.</p>`,
        })
        await lock.query(
          'UPDATE operational_alerts SET notified_at=$1,notification_error=NULL WHERE id=ANY($2::int[])',
          [now, ids],
        )
      } catch {
        await lock.query(
          'UPDATE operational_alerts SET notification_error=$1 WHERE id=ANY($2::int[])',
          [
            'Alert email failed; inspect app logs and email configuration. Retry after one hour.',
            ids,
          ],
        )
        payload.logger.error('Operational alert email failed; alerts remain visible in admin.')
      }
    }
    return { active: conditions.length, notified: pending.rows.length }
  } finally {
    await lock.query('SELECT pg_advisory_unlock(36032,1)').catch(() => undefined)
    lock.release()
  }
}
