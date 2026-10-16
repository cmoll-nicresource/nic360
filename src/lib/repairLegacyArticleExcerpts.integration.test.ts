import 'dotenv/config'
import pg from 'pg'
import { gunzipSync } from 'node:zlib'
import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest'
import { repairLegacyArticleExcerpts } from './repairLegacyArticleExcerpts'
import { lexicalFromText, lexicalToPlainText } from './lexical'

describe.skipIf(process.env.LEGACY_ARTICLE_REPAIR_INTEGRATION !== '1')(
  'legacy article repair on disposable PostgreSQL',
  () => {
    let client: pg.Client
    const sources = [
      {
        legacyId: 'old-1',
        title: 'Headline',
        shortAbstract: JSON.stringify({
          blocks: [{ type: 'paragraph', data: { text: 'Recovered excerpt with actual context.' } }],
        }),
      },
    ]
    beforeAll(async () => {
      const uri = new URL(process.env.DATABASE_URI!)
      if (
        !['localhost', '127.0.0.1', '[::1]'].includes(uri.hostname) ||
        !uri.pathname.includes('_test')
      )
        throw Error('Disposable local _test database required')
      client = new pg.Client({ connectionString: uri.href })
      await client.connect()
      await client.query(`CREATE TEMP TABLE articles(id int PRIMARY KEY,title text,excerpt jsonb,search_text text,ingestion_source text,ingestion_external_id text,other_metadata text);
  CREATE TEMP TABLE _articles_v(id int PRIMARY KEY,parent_id int,version_title text,version_excerpt jsonb,version_search_text text,latest boolean);`)
    })
    afterAll(async () => {
      await client?.end()
    })
    beforeEach(async () => {
      await client.query('ROLLBACK')
      await client.query('TRUNCATE articles,_articles_v')
      await client.query(
        "INSERT INTO articles VALUES(1,'Headline',$1,'Headline','migration','old-1','keep me')",
        [lexicalFromText('Headline')],
      )
      await client.query(
        "INSERT INTO _articles_v VALUES(10,1,'Headline',$1,'Headline',true),(9,1,'Headline',$1,'Headline',false)",
        [lexicalFromText('Headline')],
      )
      await client.query('BEGIN')
    })
    it('previews without writing, backs up before values and repairs the CMS latest version with the base article', async () => {
      const preview = await repairLegacyArticleExcerpts(client, sources)
      expect(preview.stats.repairedArticles).toBe(1)
      expect(preview.stats.repairedLatestVersions).toBe(1)
      const before = JSON.parse(gunzipSync(Buffer.from(preview.snapshotGzip, 'base64')).toString())
      expect(lexicalToPlainText(before.articles[0].excerpt)).toBe('Headline')
      expect(
        lexicalToPlainText((await client.query('SELECT excerpt FROM articles')).rows[0].excerpt),
      ).toBe('Headline')
      await repairLegacyArticleExcerpts(client, sources, true, preview.beforeHash)
      const article = (await client.query('SELECT * FROM articles')).rows[0]
      expect(lexicalToPlainText(article.excerpt)).toBe('Recovered excerpt with actual context.')
      expect(article.search_text).toBe('Recovered excerpt with actual context.')
      expect(article.other_metadata).toBe('keep me')
      const versions = (await client.query('SELECT * FROM _articles_v ORDER BY id')).rows
      expect(lexicalToPlainText(versions[0].version_excerpt)).toBe('Headline')
      expect(versions[1].version_search_text).toBe(article.search_text)
      const repeat = await repairLegacyArticleExcerpts(client, sources)
      expect(repeat.stats.repairedArticles).toBe(0)
      expect(repeat.stats.repairedLatestVersions).toBe(0)
      expect(repeat.stats.alreadyCorrect).toBe(1)
    })
    it('preserves a genuine staff draft while repairing the unedited published placeholder', async () => {
      await client.query('UPDATE _articles_v SET version_excerpt=$1 WHERE latest=true', [
        lexicalFromText('Staff edited draft.'),
      ])
      const plan = await repairLegacyArticleExcerpts(client, sources)
      expect(plan.stats.preservedVersionEdits).toBe(1)
      await repairLegacyArticleExcerpts(client, sources, true, plan.beforeHash)
      expect(
        lexicalToPlainText(
          (await client.query('SELECT version_excerpt FROM _articles_v WHERE latest=true')).rows[0]
            .version_excerpt,
        ),
      ).toBe('Staff edited draft.')
    })
    it('refuses changed state or missing backups and leaves existing editorial content intact', async () => {
      const plan = await repairLegacyArticleExcerpts(client, sources)
      await client.query('UPDATE articles SET excerpt=$1', [lexicalFromText('A new staff edit.')])
      await expect(
        repairLegacyArticleExcerpts(client, sources, true, plan.beforeHash),
      ).rejects.toThrow('changed since')
      await expect(repairLegacyArticleExcerpts(client, sources, true)).rejects.toThrow(
        'before-state hash',
      )
      const next = await repairLegacyArticleExcerpts(client, sources)
      expect(next.stats.preservedArticleEdits).toBe(1)
      expect(next.stats.repairedArticles).toBe(0)
    })
    it('rolls back an applied repair and reports missing source text without inventing an excerpt', async () => {
      const absent = await repairLegacyArticleExcerpts(client, [
        { legacyId: 'old-1', title: 'Headline', rawContent: 'Headline' },
      ])
      expect(absent.stats.noRecoverableText).toBe(1)
      expect(absent.stats.repairedArticles).toBe(0)
      const plan = await repairLegacyArticleExcerpts(client, sources)
      await repairLegacyArticleExcerpts(client, sources, true, plan.beforeHash)
      await client.query('ROLLBACK')
      expect(
        lexicalToPlainText((await client.query('SELECT excerpt FROM articles')).rows[0].excerpt),
      ).toBe('Headline')
    })
  },
)
