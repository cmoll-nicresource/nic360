import dotenv from 'dotenv'
import type { Payload } from 'payload'
import type { Publication } from '@/payload-types'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildSectionsFromRules } from './publicationRules'
import { lexicalFromText } from './lexical'

describe.skipIf(process.env.PUBLICATION_RULES_INTEGRATION !== '1')(
  'publication rules through Payload/Postgres',
  () => {
    let payload: Payload, us: number, china: number, subject: number, vapor: number
    const records: {
      collection: 'locations' | 'products' | 'subjects' | 'articles'
      id: number
    }[] = []
    const ids: Record<string, number> = {}
    beforeAll(async () => {
      dotenv.config()
      if (
        !['localhost', '127.0.0.1', '[::1]'].includes(new URL(process.env.DATABASE_URI!).hostname)
      )
        throw Error('Local database required')
      const { getPayload } = await import('payload'),
        { default: config } = await import('@/payload.config')
      const resolved = await config
      resolved.jobs!.autoRun = []
      payload = await getPayload({ config: resolved })
      const marker = 'Publication rule verifier ' + crypto.randomUUID()
      const add = async (
        collection: (typeof records)[number]['collection'],
        data: Record<string, unknown>,
      ) => {
        const doc = await payload.create({ collection, data: data as never, overrideAccess: true })
        records.push({ collection, id: doc.id })
        return doc.id
      }
      // Isolated terms make the assertions independent of real content.
      const existingUS = await payload.find({
        collection: 'locations',
        where: { and: [{ name: { equals: 'United States' } }, { level: { equals: 'country' } }] },
        limit: 2,
        depth: 0,
      })
      us =
        existingUS.docs[0]?.id ??
        (await add('locations', { name: 'United States', level: 'country' }))
      china = await add('locations', { name: marker + ' China', level: 'country' })
      const state = await add('locations', { name: marker + ' state', level: 'state', parent: us })
      subject = await add('subjects', { name: marker })
      vapor = await add('products', { name: marker })
      for (const [name, locations, products, status, date] of [
        ['domestic', [us], [], 'published', '2090-10-15T12:00:00Z'],
        ['foreign', [china], [], 'published', '2090-10-15T12:00:00Z'],
        ['mixed', [us, china], [], 'published', '2090-10-15T12:00:00Z'],
        ['state', [state], [], 'published', '2090-10-15T12:00:00Z'],
        ['untagged', [], [], 'published', '2090-10-15T12:00:00Z'],
        ['draft', [us], [], 'draft', '2090-10-15T12:00:00Z'],
        ['future', [us], [], 'published', '2090-10-17T12:00:00Z'],
        ['old', [us], [], 'published', '2090-10-08T12:00:00Z'],
        ['domesticVapor', [us], [vapor], 'published', '2090-10-15T12:00:00Z'],
        ['foreignVapor', [china], [vapor], 'published', '2090-10-15T12:00:00Z'],
      ] as const)
        ids[name] = await add('articles', {
          title: marker + ' ' + name,
          locations: [...locations],
          products: [...products],
          subjects: [subject],
          sourceDate: date,
          _status: status,
          excerpt: lexicalFromText('Controlled publication-rule verification.'),
        })
    }, 60000)
    afterAll(async () => {
      if (payload) {
        for (const rec of records.reverse()) await payload.delete({ ...rec, overrideAccess: true })
        await payload.destroy()
      }
    }, 60000)
    async function selected(slug: string) {
      const publication = {
        id: 0,
        title: slug,
        slug,
        frequency: 'weekly',
        selectionRules: {
          excerptTypes: ['articles', 'bills'],
          subjects: { include: [subject] },
          ...(slug === 'vapor-news-clippings' ? { products: { include: [vapor] } } : {}),
        },
        groupingRules: { groupBy: 'country' },
      } as Publication
      const sections = await buildSectionsFromRules(payload, publication, '2090-10-16')
      return sections.flatMap((s) => s.items.map((i) => i.value)).sort((a, b) => a - b)
    }
    it('keeps US plus mixed and descendant locations, including vapor, while excluding drafts and date overflows', async () => {
      expect(await selected('us-news-clippings')).toEqual(
        [ids.domestic, ids.mixed, ids.state, ids.domesticVapor].sort((a, b) => a - b),
      )
    })
    it('keeps foreign and mixed locations in Global while excluding US-only and untagged', async () => {
      expect(await selected('global-news-clippings')).toEqual(
        [ids.foreign, ids.mixed, ids.foreignVapor].sort((a, b) => a - b),
      )
    })
    it('keeps both US and foreign vapor stories', async () => {
      expect(await selected('vapor-news-clippings')).toEqual(
        [ids.domesticVapor, ids.foreignVapor].sort((a, b) => a - b),
      )
    })
  },
)
