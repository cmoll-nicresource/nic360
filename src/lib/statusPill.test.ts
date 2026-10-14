import { describe, expect, it } from 'vitest'

import { billStatusPill, trademarkStatusPill } from './statusPill'

describe('billStatusPill', () => {
  it('is Enacted when effectiveDate is set, regardless of statusText', () => {
    expect(billStatusPill({ statusText: 'Referred to committee', effectiveDate: '2026-01-01' })).toEqual({
      label: 'Enacted',
      variant: 'green',
    })
  })

  it('is Enacted when approvalDate is set', () => {
    expect(billStatusPill({ approvalDate: '2026-01-01' })).toEqual({ label: 'Enacted', variant: 'green' })
  })

  it('is Failed for dead-bill keywords', () => {
    expect(billStatusPill({ statusText: 'Bill failed in committee' })).toEqual({ label: 'Failed', variant: 'grey' })
    expect(billStatusPill({ statusText: 'Vetoed by Governor' })).toEqual({ label: 'Failed', variant: 'grey' })
  })

  it('is Passed one chamber when statusText says passed but nothing is enacted', () => {
    expect(billStatusPill({ statusText: 'Passed Senate 32-18' })).toEqual({
      label: 'Passed one chamber',
      variant: 'amber',
    })
  })

  it('defaults to Introduced', () => {
    expect(billStatusPill({ statusText: 'Introduced and referred to committee' })).toEqual({
      label: 'Introduced',
      variant: 'blue',
    })
    expect(billStatusPill({})).toEqual({ label: 'Introduced', variant: 'blue' })
  })
})

describe('trademarkStatusPill', () => {
  it('is Cancelled when cancelledDate is set, even if registered', () => {
    expect(trademarkStatusPill({ registeredDate: '2020-01-01', cancelledDate: '2026-01-01' })).toEqual({
      label: 'Cancelled',
      variant: 'grey',
    })
  })

  it('is Registered when registeredDate is set', () => {
    expect(trademarkStatusPill({ registeredDate: '2020-01-01' })).toEqual({ label: 'Registered', variant: 'green' })
  })

  it('is Published when only publishedDate is set', () => {
    expect(trademarkStatusPill({ publishedDate: '2026-01-01' })).toEqual({ label: 'Published', variant: 'blue' })
  })

  it('defaults to Filed', () => {
    expect(trademarkStatusPill({})).toEqual({ label: 'Filed', variant: 'blue' })
  })
})
