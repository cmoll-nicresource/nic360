import { describe, expect, it } from 'vitest'

import { classifyRecord } from './classify'

describe('classifyRecord', () => {
  it('classifies "Applications publishing for opposition" as published, regardless of status code', () => {
    // Real USPTO feed example: a record that is actually Registered this
    // week can still carry a stale status code like 681 instead of 700 —
    // the section is what matters, not the code.
    expect(classifyRecord('Applications publishing for opposition', '681')).toBe('published')
    expect(classifyRecord('Applications publishing for opposition', '686')).toBe('published')
  })

  it('classifies "Registrations publishing" as registered, regardless of status code', () => {
    expect(classifyRecord('Registrations publishing', '686')).toBe('registered')
    expect(classifyRecord('Registrations publishing', '700')).toBe('registered')
  })

  it('classifies "Registrations renewed" as renewed', () => {
    expect(classifyRecord('Registrations renewed', '800')).toBe('renewed')
  })

  it('classifies "Registrations no longer in effect" as cancelled only for status codes 709-713', () => {
    expect(classifyRecord('Registrations no longer in effect', '709')).toBe('cancelled')
    expect(classifyRecord('Registrations no longer in effect', '710')).toBe('cancelled')
    expect(classifyRecord('Registrations no longer in effect', '713')).toBe('cancelled')
  })

  it('drops "Registrations no longer in effect" records outside 709-713 (e.g. Section 16A/16B removals)', () => {
    expect(classifyRecord('Registrations no longer in effect', '677')).toBeNull()
    expect(classifyRecord('Registrations no longer in effect', '708')).toBeNull()
    expect(classifyRecord('Registrations no longer in effect', '714')).toBeNull()
    expect(classifyRecord('Registrations no longer in effect', '')).toBeNull()
  })

  it('drops sections we do not track', () => {
    expect(classifyRecord('New Certificate', '702')).toBeNull()
    expect(classifyRecord('Correction of errors on registrations', '700')).toBeNull()
    expect(classifyRecord('', '700')).toBeNull()
  })
})
