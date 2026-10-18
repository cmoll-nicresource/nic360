import { describe, expect, it } from 'vitest'
import type { PayloadRequest, CollectionConfig } from 'payload'
import {
  workspaceCollectionVisible,
  withWorkspaceVisibility,
  isAdminManagedCollection,
} from './workspaceVisibility'
import { Staff } from '@/collections/Staff'
import { Subjects } from '@/collections/Subjects'
import { Sectors } from '@/collections/Sectors'
import { Products } from '@/collections/Products'
import { Locations } from '@/collections/Locations'
import { Sources } from '@/collections/Sources'
import { Countries } from '@/collections/Countries'
import { staffCanWrite } from '@/access/excerptAccess'
const user = (role: string) => ({ id: 7, role, collection: 'staff' }) as PayloadRequest['user']
describe('role-specific admin presentation and management', () => {
  it('hides editorial collections for gatekeepers while keeping user operations visible and permissions intact', () => {
    for (const slug of [
      'articles',
      'bills',
      'publications',
      'publication-issues',
      'datasets',
      'subjects',
      'staff',
      'speakers',
    ])
      expect(workspaceCollectionVisible(slug, user('gatekeeper'))).toBe(false)
    for (const slug of ['users', 'access-providers', 'orders', 'event-registrations', 'events'])
      expect(workspaceCollectionVisible(slug, user('gatekeeper'))).toBe(true)
    expect(staffCanWrite({ req: { user: user('gatekeeper') } } as never)).toBe(true)
    expect(workspaceCollectionVisible('articles', user('editor'))).toBe(true)
    expect(workspaceCollectionVisible('orders', user('editor'))).toBe(false)
  })
  it('makes taxonomy mutation admin-only while keeping existing terms readable for tagging and public filters', async () => {
    for (const collection of [Subjects, Sectors, Products, Locations, Sources, Countries]) {
      expect(isAdminManagedCollection(collection.slug)).toBe(true)
      for (const role of ['editor', 'gatekeeper', 'admin']) {
        const args = { req: { user: user(role) } } as never
        expect(await collection.access!.read!(args)).toBe(true)
        for (const operation of ['create', 'update', 'delete'] as const)
          expect(await collection.access![operation]!(args)).toBe(role === 'admin')
        expect(workspaceCollectionVisible(collection.slug, user(role))).toBe(role === 'admin')
      }
    }
  })
  it('prevents browsing other staff and retains own-account access and role-change protection', async () => {
    for (const role of ['editor', 'gatekeeper']) {
      expect(await Staff.access!.read!({ req: { user: user(role) } } as never)).toEqual({
        id: { equals: 7 },
      })
      expect(await Staff.access!.create!({ req: { user: user(role) } } as never)).toBe(false)
      expect(await Staff.access!.update!({ req: { user: user(role) }, id: 8 } as never)).toBe(false)
      expect(await Staff.access!.update!({ req: { user: user(role) }, id: 7 } as never)).toBe(true)
    }
    expect(await Staff.access!.read!({ req: { user: user('admin') } } as never)).toBe(true)
    expect(isAdminManagedCollection('staff')).toBe(true)
  })
  it('preserves collections that were already hidden and gives admins the full workspace', () => {
    const config = withWorkspaceVisibility({
      slug: 'articles',
      fields: [],
      admin: { hidden: true },
    } as CollectionConfig)
    expect(
      typeof config.admin!.hidden === 'function' &&
        config.admin!.hidden({ user: user('admin') as never }),
    ).toBe(true)
    expect(workspaceCollectionVisible('subjects', user('admin'))).toBe(true)
    expect(workspaceCollectionVisible('articles', null)).toBe(false)
    expect(
      workspaceCollectionVisible('articles', {
        id: 7,
        collection: 'users',
        role: 'admin',
      } as never),
    ).toBe(false)
  })
})
