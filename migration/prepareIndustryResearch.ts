import 'dotenv/config'
import fs from 'node:fs/promises'
import pg from 'pg'
import catalog from '../src/config/researchJournals.json'

async function main() {
  if (!process.env.DATABASE_URI) throw new Error('DATABASE_URI is required')
  const sql = await fs.readFile(
    new URL('./industryResearch.sql', import.meta.url),
    'utf8',
  )
  const apply = process.argv.includes('--apply')
  const client = new pg.Client({ connectionString: process.env.DATABASE_URI })
  await client.connect()
  try {
    await client.query(apply ? sql : sql.replace(/COMMIT;\s*$/, 'ROLLBACK;'))
    if (!apply) {
      console.log(
        'Industry Research schema preview succeeded and rolled back. Catalog/configuration unchanged.',
      )
      return
    }
    await client.query('BEGIN')
    for (const journal of catalog)
      await client.query(
        'INSERT INTO public.journals(name,homepage) VALUES($1,$2) ON CONFLICT(name) DO NOTHING',
        [journal.name, journal.homepage],
      )
    const pub = await client.query(
      "SELECT id FROM public.publications WHERE slug='monthly-research-digest'",
    )
    if (pub.rows.length !== 1)
      throw new Error(
        'Expected exactly one Monthly Research Digest publication. Configure it in the CMS, then rerun.',
      )
    const id = pub.rows[0].id
    await client.query(
      "UPDATE public.publications SET format='pdf-report',frequency='monthly',generator='monthly-research-digest',description=$1 WHERE id=$2",
      [
        'Research articles and abstracts grouped by journal, with authors, dates and DOI links.',
        id,
      ],
    )
    await client.query(
      'DELETE FROM public.publications_category WHERE parent_id=$1',
      [id],
    )
    await client.query(
      'INSERT INTO public.publications_category("order",parent_id,value) VALUES(1,$1,\'research\')',
      [id],
    )
    await client.query('COMMIT')
    console.log(
      'Research schema, journal catalog and existing Monthly Research Digest configuration are ready. Existing issue contents and subscription preferences were preserved.',
    )
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    await client.end()
  }
}
main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
