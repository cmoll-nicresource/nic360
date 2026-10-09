import { headers as getHeaders } from 'next/headers.js'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { RichText } from '@payloadcms/richtext-lexical/react'
import { getPayload } from 'payload'
import React from 'react'
import { SiteNav } from '@/components/SiteNav'

import config from '@/payload.config'
import { getReaderPlan, planSatisfies } from '@/access/readerPlan'
import { staffHasRole } from '@/access/staffRoles'

export const dynamic = 'force-dynamic'

const EXCERPT_PATH: Record<string, string> = { articles: 'articles', bills: 'bills', trademarks: 'trademarks' }

export default async function IssueDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>
}) {
  const { slug, id } = await params
  const headers = await getHeaders()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers })

  const isStaff = staffHasRole(user, 'editor')
  const plan = user && 'collection' in user && user.collection === 'users' ? await getReaderPlan(user, payload) : 'none'
  const canRead = isStaff || planSatisfies(plan, 'base')

  return (
    <>
      <SiteNav />
      <div className="page">
        <p>
          <Link href={`/publications/${slug}`}>&larr; Back</Link>
        </p>
        {!canRead ? (
          <div className="locked-content">
            Sign in with a Base or Premium subscription to view this issue.{' '}
            <Link href="/account">Sign in</Link>
          </div>
        ) : (
          <IssueDetail payload={payload} id={id} isStaff={isStaff} />
        )}
      </div>
    </>
  )
}

async function IssueDetail({
  payload,
  id,
  isStaff,
}: {
  payload: Awaited<ReturnType<typeof getPayload>>
  id: string
  isStaff: boolean
}) {
  const issue = await payload
    .findByID({ collection: 'publication-issues', id, depth: 1, overrideAccess: true })
    .catch(() => null)
  if (!issue) notFound()
  if (issue._status !== 'published' && !isStaff) notFound()

  const file = issue.file && typeof issue.file === 'object' ? issue.file : null

  return (
    <>
      <h1>{issue.title}</h1>
      <p className="excerpt-meta">
        {new Date(issue.issueDate).toLocaleDateString()} · {issue.email?.status ?? 'not sent'}
      </p>

      {issue.format === 'excerpt-list' && (
        <div className="card">
          {issue.intro && <RichText data={issue.intro} />}
          {(issue.sections ?? []).map((section, i) => (
            <div key={i}>
              <h3>{section.heading}</h3>
              <ul>
                {(section.items ?? []).map((item, j) => {
                  if (typeof item.value !== 'object' || !item.value) return null
                  return (
                    <li key={j}>
                      <Link href={`/${EXCERPT_PATH[item.relationTo]}/${item.value.id}`}>{item.value.title}</Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      {issue.format === 'pdf-report' && (
        <div className="card">
          {issue.summary && <RichText data={issue.summary} />}
          {file?.url && <p><a href={file.url}>Download PDF</a></p>}
        </div>
      )}

      {issue.format === 'custom-html' && issue.body && (
        <div className="card" dangerouslySetInnerHTML={{ __html: issue.body }} />
      )}
    </>
  )
}
