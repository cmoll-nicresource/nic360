import type { Payload, PayloadRequest } from 'payload'
import { beforeEach, expect, it, vi } from 'vitest'
import { snapshotEmailFlagRecipient } from '@/hooks/snapshotEmailFlagRecipient'
import { getSuppressedEmails } from './suppressionList'
import { flagUserByEmail } from './emailFlags'
import { POST } from '@/app/api/email-flags/[id]/re-add/route'
import { requireStaff } from './requireStaff'

vi.mock('./requireStaff', () => ({ requireStaff: vi.fn() }))
const find = vi.fn(),
  findByID = vi.fn(),
  update = vi.fn(),
  create = vi.fn()
const payload = { find, findByID, update, create } as unknown as Payload
const req = { payload } as PayloadRequest
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(requireStaff).mockResolvedValue({ payload } as Awaited<ReturnType<typeof requireStaff>>)
})

const snapshot = (
  data: Record<string, unknown>,
  originalDoc: Record<string, unknown> = {},
  operation: 'create' | 'update' = 'create',
) =>
  snapshotEmailFlagRecipient({ data, originalDoc, operation, req } as Parameters<
    typeof snapshotEmailFlagRecipient
  >[0])

it('snapshots the account address and ignores supplied suppression addresses', async () => {
  findByID.mockResolvedValue({ id: 3, email: ' Reader@Example.invalid ' })
  expect(await snapshot({ user: 3, recipientEmail: 'wrong@example.invalid' })).toMatchObject({
    recipientEmail: 'reader@example.invalid',
  })
  expect(findByID).toHaveBeenCalledWith(expect.objectContaining({ id: 3, req }))
})
it('requires a reader for new flags, but lets staff update a deleted reader’s history', async () => {
  await expect(snapshot({ user: null })).rejects.toThrow('Select a reader')
  expect(
    await snapshot(
      { notes: 'Followed up', recipientEmail: 'wrong@example.invalid' },
      { user: null, recipientEmail: 'retained@example.invalid' },
      'update',
    ),
  ).toMatchObject({ recipientEmail: 'retained@example.invalid' })
  expect(findByID).not.toHaveBeenCalled()
})
it('captures the address before an existing relationship is cleared', async () => {
  findByID.mockResolvedValue({ id: 3, email: 'reader@example.invalid' })
  expect(await snapshot({ user: null }, { user: 3 }, 'update')).toMatchObject({
    recipientEmail: 'reader@example.invalid',
  })
})
it('preserves the original delivery address when staff edit a flag after the reader changes email', async () => {
  expect(
    await snapshot(
      { notes: 'Contacted' },
      { user: 3, recipientEmail: 'original@example.invalid' },
      'update',
    ),
  ).toMatchObject({ recipientEmail: 'original@example.invalid' })
  expect(findByID).not.toHaveBeenCalled()
})
it('keeps deleted and following-up recipients suppressed, includes current addresses, and reads all pages', async () => {
  find
    .mockResolvedValueOnce({
      docs: [
        { user: null, recipientEmail: 'Deleted@Example.invalid' },
        { user: { email: 'current@example.invalid' }, recipientEmail: 'old@example.invalid' },
      ],
      hasNextPage: true,
    })
    .mockResolvedValueOnce({
      docs: [{ user: { email: 'last@example.invalid' } }],
      hasNextPage: false,
    })
  expect(await getSuppressedEmails(payload)).toEqual(
    new Set([
      'deleted@example.invalid',
      'current@example.invalid',
      'old@example.invalid',
      'last@example.invalid',
    ]),
  )
  expect(find.mock.calls[0][0].where).toEqual({ status: { in: ['open', 'following up'] } })
  expect(find.mock.calls[1][0].page).toBe(2)
})
it('does not create another flag or clear preferences again during follow-up', async () => {
  find.mockResolvedValueOnce({ docs: [{ id: 3 }] }).mockResolvedValueOnce({ totalDocs: 1 })
  expect(
    await flagUserByEmail(payload, 'reader@example.invalid', 'cleaned', '2026-10-15'),
  ).toBeNull()
  expect(find.mock.calls[1][0].where.and[1]).toEqual({ status: { in: ['open', 'following up'] } })
  expect(create).not.toHaveBeenCalled()
  expect(update).not.toHaveBeenCalled()
})
it.each([
  { user: null, status: 'open' },
  { user: 3, status: 'resolved' },
])('refuses re-add when the account is gone or the flag resolved: %j', async (flag) => {
  findByID.mockResolvedValue({ id: 1, ...flag })
  const response = await POST(new Request('https://example.invalid', { method: 'POST' }), {
    params: Promise.resolve({ id: '1' }),
  })
  expect(response.status).toBe(409)
  expect(update).not.toHaveBeenCalled()
})
