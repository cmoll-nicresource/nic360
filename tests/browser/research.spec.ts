import { test, expect, chromium } from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fixtures as f, roleContext } from '../support/fixtures'
import { lexicalFromText } from '../../src/lib/lexical'
import {
  RESEARCH_CLIPPER_ID,
  RESEARCH_CLIPPER_ORIGIN,
} from '../../src/config/extension'

test('research mirrors news permissions and editorial workflow without exposing subscriber fields', async ({
  browser,
  page,
}) => {
  const admin = await roleContext(browser, 'admin'),
    editor = await roleContext(browser, 'editor')
  const marker = crypto.randomUUID()
  let journalId: number | undefined,
    publishedId: number | undefined,
    draftId: number | undefined
  try {
    const journal = await admin.request.post('/api/journals', {
      data: {
        name: 'Research access ' + marker,
        homepage: 'https://journal.example.invalid/',
      },
    })
    expect(journal.ok()).toBe(true)
    journalId = (await journal.json()).doc.id
    const data = {
      title: 'Independent research ' + marker,
      authors: 'First Author; Second Author',
      publishedDate: '2098-05-31T23:59:59Z',
      journal: journalId,
      doiLink: '10.1234/' + marker,
      body: lexicalFromText('SUBSCRIBER-BODY-' + marker),
      sourceUrl: 'https://journal.example.invalid/article/' + marker,
      _status: 'published',
    }
    const created = await editor.request.post('/api/research', { data })
    expect(created.ok()).toBe(true)
    publishedId = (await created.json()).doc.id
    const draft = await editor.request.post('/api/research?draft=true', {
      data: { title: 'Research draft ' + marker, _status: 'draft' },
    })
    expect(draft.ok()).toBe(true)
    draftId = (await draft.json()).doc.id
    expect(
      (
        await editor.request.post('/api/journals', {
          data: { name: 'Disallowed journal' },
        })
      ).ok(),
    ).toBe(false)
    for (const role of [
      'anonymous',
      'none',
      'base',
      'premium',
      'suspended',
      'expired',
      'unverified',
      'editor',
      'gatekeeper',
      'admin',
    ]) {
      const context = await roleContext(browser, role)
      try {
        const response = await context.request.get(
          `/api/research/${publishedId}`,
        )
        expect(response.ok()).toBe(true)
        const doc = await response.json(),
          eligible = [
            'base',
            'premium',
            'editor',
            'gatekeeper',
            'admin',
          ].includes(role),
          staff = ['editor', 'gatekeeper', 'admin'].includes(role)
        expect(doc.title).toBe(data.title)
        expect('body' in doc).toBe(eligible)
        expect('doiLink' in doc).toBe(eligible)
        expect('sourceUrl' in doc).toBe(eligible)
        expect('doiKey' in doc).toBe(staff)
        expect('ingestion' in doc).toBe(staff)
        if (!staff)
          expect(
            (await context.request.get(`/api/research/${draftId}`)).ok(),
          ).toBe(false)
      } finally {
        await context.close()
      }
    }
    await page.goto(
      `/research?keyword=${encodeURIComponent(marker)}&journal=${journalId}&dateFrom=2098-05-01&dateTo=2098-05-31`,
    )
    await expect(
      page.getByRole('link', { name: new RegExp('Independent research') }),
    ).toBeVisible()
    await page.goto(`/research/${publishedId}`)
    await expect(
      page.getByRole('heading', { name: data.title, exact: true }),
    ).toBeVisible()
    expect(await page.content()).not.toContain('SUBSCRIBER-BODY-' + marker)
    expect(await page.content()).not.toContain('doi.org/10.1234/' + marker)
    const subscriber = await roleContext(browser, 'base')
    try {
      const reading = await subscriber.newPage()
      await reading.goto(`/research/${publishedId}`)
      await expect(
        reading.getByText('SUBSCRIBER-BODY-' + marker, { exact: true }),
      ).toBeVisible()
      await expect(
        reading.getByRole('link', {
          name: 'Read the original journal article (DOI)',
        }),
      ).toHaveAttribute('href', 'https://doi.org/10.1234/' + marker)
    } finally {
      await subscriber.close()
    }
  } finally {
    for (const id of [publishedId, draftId])
      if (id) await admin.request.delete(`/api/research/${id}`)
    if (journalId) await admin.request.delete(`/api/journals/${journalId}`)
    await admin.close()
    await editor.close()
  }
})

test('N360 Industry Research Clipper credentials create reviewable drafts, detect duplicates and cannot be substituted for N360 News Clipper credentials', async ({
  browser,
  request,
}) => {
  const admin = await roleContext(browser, 'admin')
  const headers = {
    origin: RESEARCH_CLIPPER_ORIGIN,
    authorization: 'Bearer ' + f.clipper.research.token,
  }
  let id: number | undefined
  try {
    expect((await request.get('/api/extension/research')).status()).toBe(401)
    expect(
      (
        await request.get('/api/extension/research', {
          headers: {
            ...headers,
            authorization: 'Bearer ' + f.clipper.news.token,
          },
        })
      ).status(),
    ).toBe(401)
    expect(
      (await request.get('/api/extension/articles', { headers })).status(),
    ).toBe(401)
    const catalog = await request.get('/api/extension/research', { headers })
    expect(catalog.ok()).toBe(true)
    const journals = (await catalog.json()).journals
    expect(journals.length).toBeGreaterThanOrEqual(91)
    const marker = crypto.randomUUID(),
      data = {
        title: 'Journal clip ' + marker,
        authors: 'First; Second',
        body: 'Background The abstract is imported for editorial review.\n\nFindings The study observed a change.\n\nConclusions The results need review.',
        publishedDate: '2026-05-09',
        doiLink: '10.1234/' + marker,
        sourceUrl: 'https://www.mdpi.com/1234/' + marker,
        journalId: journals[0].id,
      }
    const clip = await request.post('/api/extension/research', {
      headers,
      data,
    })
    expect(clip.ok()).toBe(true)
    const clipped = await clip.json()
    id = clipped.id
    expect(clipped.duplicate).toBe(false)
    const doc = await (
      await admin.request.get(`/api/research/${id}?draft=true`)
    ).json()
    expect(doc._status).toBe('draft')
    expect(doc.publishedDate).toContain('2026-05-09')
    expect(doc.doiLink).toBe('https://doi.org/' + data.doiLink)
    expect(
      doc.body.root.children.map(
        (paragraph: { children: { text: string }[] }) =>
          paragraph.children.map((node) => node.text).join(''),
      ),
    ).toEqual([
      'Background',
      'The abstract is imported for editorial review.',
      'Findings',
      'The study observed a change.',
      'Conclusions',
      'The results need review.',
    ])
    const duplicate = await request.post('/api/extension/research', {
      headers,
      data: {
        ...data,
        sourceUrl: data.sourceUrl + '/other',
        doiLink: 'https://doi.org/' + data.doiLink.toUpperCase(),
      },
    })
    expect(await duplicate.json()).toMatchObject({ duplicate: true, id })
  } finally {
    if (id) await admin.request.delete(`/api/research/${id}`)
    await admin.close()
  }
})

test('monthly research generation creates a protected themed PDF draft and never replaces a published digest', async ({
  browser,
  page,
}) => {
  const admin = await roleContext(browser, 'admin'),
    editor = await roleContext(browser, 'editor'),
    subscriber = await roleContext(browser, 'base')
  const marker = crypto.randomUUID()
  let journalId: number | undefined,
    articleId: number | undefined,
    issueId: number | undefined
  const fileIds: number[] = []
  const excludedArticleIds: number[] = []
  try {
    journalId = (
      await (
        await admin.request.post('/api/journals', {
          data: { name: 'Digest journal ' + marker },
        })
      ).json()
    ).doc.id
    articleId = (
      await (
        await editor.request.post('/api/research', {
          data: {
            title: 'Digest paper ' + marker,
            authors: 'Research Author',
            publishedDate: '2098-05-31T23:59:59Z',
            journal: journalId,
            doiLink: '10.1234/' + marker,
            body: lexicalFromText('Published abstract for the monthly digest.'),
            _status: 'published',
          },
        })
      ).json()
    ).doc.id
    for (const [publishedDate, status] of [
      ['2098-06-01T00:00:00Z', 'published'],
      ['2098-05-10T00:00:00Z', 'draft'],
    ] as const) {
      const excluded = await editor.request.post('/api/research?draft=true', {
        data: {
          title: 'Excluded paper ' + marker,
          authors: 'Research Author',
          publishedDate,
          journal: journalId,
          body: lexicalFromText('Outside the selected month or not published.'),
          _status: status,
        },
      })
      expect(excluded.ok()).toBe(true)
      excludedArticleIds.push((await excluded.json()).doc.id)
    }
    expect((await page.request.get('/api/admin/research-extension')).ok()).toBe(
      false,
    )
    const extension = await editor.request.get('/api/admin/research-extension')
    expect(extension.ok()).toBe(true)
    expect((await extension.body()).subarray(0, 2).toString()).toBe('PK')
    const generate = await editor.newPage()
    await generate.goto('/admin/research-reports')
    await generate.getByLabel('Research month', { exact: true }).fill('2098-05')
    await generate
      .getByRole('button', { name: 'Generate draft PDF', exact: true })
      .click()
    const review = generate.getByRole('link', {
      name: 'Review draft issue',
      exact: false,
    })
    await expect(review).toBeVisible({ timeout: 30000 })
    issueId = Number((await review.getAttribute('href'))!.split('/').at(-1))
    const issue = await (
      await admin.request.get(`/api/publication-issues/${issueId}?depth=1`)
    ).json()
    expect(issue.title).toBe('Monthly Research Digest - May 2098')
    expect(issue.format).toBe('pdf-report')
    expect(issue._status).toBe('draft')
    expect(JSON.stringify(issue.summary)).toContain(
      '1 research article from 1 journal.',
    )
    fileIds.push(issue.file.id)
    const filePath =
      '/api/publication-files/file/' + encodeURIComponent(issue.file.filename)
    expect((await page.request.get(filePath)).ok()).toBe(false)
    expect((await subscriber.request.get(filePath)).ok()).toBe(false)
    const regenerate = await editor.request.post(
      '/api/admin/research-reports',
      { data: { month: '2098-05' } },
    )
    expect(regenerate.ok()).toBe(true)
    expect((await regenerate.json()).issueId).toBe(issueId)
    const updated = await (
      await admin.request.get(`/api/publication-issues/${issueId}?depth=1`)
    ).json()
    fileIds.push(updated.file.id)
    expect(
      (
        await admin.request.patch(`/api/publication-issues/${issueId}`, {
          data: { _status: 'published' },
        })
      ).ok(),
    ).toBe(true)
    const pdf = await subscriber.request.get(
      '/api/publication-files/file/' +
        encodeURIComponent(updated.file.filename),
    )
    expect(pdf.ok()).toBe(true)
    expect((await pdf.body()).subarray(0, 4).toString()).toBe('%PDF')
    const protectedIssue = await editor.request.post(
      '/api/admin/research-reports',
      { data: { month: '2098-05' } },
    )
    expect(protectedIssue.status()).toBe(400)
    expect((await protectedIssue.json()).error).toContain(
      'cannot be overwritten',
    )
  } finally {
    if (issueId)
      await admin.request.delete(`/api/publication-issues/${issueId}`)
    if (articleId) await admin.request.delete(`/api/research/${articleId}`)
    for (const id of excludedArticleIds)
      await admin.request.delete(`/api/research/${id}`)
    if (journalId) await admin.request.delete(`/api/journals/${journalId}`)
    for (const id of fileIds)
      await admin.request.delete(`/api/guide-files/${id}`)
    await Promise.all([admin.close(), editor.close(), subscriber.close()])
  }
})

test('journal metadata extraction handles citation tags, structured abstracts, JSON-LD and missing dates', async ({
  page,
}) => {
  const extract = async (html: string) => {
    await page.setContent(html)
    await page.addScriptTag({ path: 'research-ext/contentScript.js' })
    return page.evaluate<{
      body: string
      publishedDate: string
      warnings: string[]
    }>('window.__nicResearchExtract()')
  }
  const citation = await extract(
    '<meta name="citation_title" content="Journal paper"><meta name="citation_author" content="Smith, Jane"><meta name="citation_author" content="Second Author"><meta name="citation_publication_date" content="2026/5/9"><meta name="citation_doi" content="10.1234/example"><meta name="citation_journal_title" content="Plants"><div class="html-abstract"><h2>Abstract</h2><p>Background: The abstract.</p><p>Results: Complete findings.</p></div>',
  )
  expect(citation).toMatchObject({
    title: 'Journal paper',
    authors: 'Smith, Jane; Second Author',
    publishedDate: '2026-05-09',
    doiLink: 'https://doi.org/10.1234/example',
    journal: 'Plants',
  })
  expect(citation.body).toContain('Complete findings.')
  expect(citation.body).toContain('The abstract.\n\nResults:')
  expect(citation.body).not.toContain('Abstract')
  const structured = await extract(
    '<script type="application/ld+json">{"@graph":[{"@type":"ScholarlyArticle","headline":"Structured paper","author":[{"name":"First Author"},{"name":"Second Author"}],"datePublished":"2026-02-28","abstract":"Complete structured abstract.","identifier":{"propertyID":"doi","value":"10.1234/structured"},"isPartOf":{"name":"Research Journal"}}]}</script>',
  )
  expect(structured).toMatchObject({
    title: 'Structured paper',
    authors: 'First Author; Second Author',
    publishedDate: '2026-02-28',
    doiLink: 'https://doi.org/10.1234/structured',
    body: 'Complete structured abstract.',
  })
  const missing = await extract(
    '<meta name="citation_title" content="Incomplete paper"><meta name="citation_publication_date" content="2026/02"><meta property="article:modified_time" content="2026-05-01">',
  )
  expect(missing.publishedDate).toBe('')
  expect(missing.body).toBe('')
  expect(missing.warnings.length).toBeGreaterThan(0)
})

test('packaged N360 Industry Research Clipper loads as its registered Chrome identity without staff passwords', async ({}, info) => {
  test.skip(
    info.project.name !== 'chromium',
    'Chrome extension runtime is specific to Chromium.',
  )
  const extensionPath = path.resolve('research-ext'),
    profile = await fs.mkdtemp(
      path.resolve('.test-artifacts/research-extension-profile-'),
    )
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  })
  try {
    const page = await context.newPage()
    await page.goto(`chrome-extension://${RESEARCH_CLIPPER_ID}/options.html`)
    await expect(
      page.getByRole('heading', {
        name: 'N360 Industry Research Clipper',
        exact: true,
      }),
    ).toBeVisible()
    expect(await page.evaluate('chrome.runtime.id')).toBe(RESEARCH_CLIPPER_ID)
    expect(
      await page.evaluate('typeof chrome.identity.launchWebAuthFlow'),
    ).toBe('function')
    await expect(page.locator('input[type=password]')).toHaveCount(0)
  } finally {
    await context.close()
  }
})
