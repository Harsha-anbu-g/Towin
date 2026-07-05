import { describe, it, expect } from 'vitest'
import { cn, parseServerDate } from './utils'

describe('cn', () => {
  it('joins class names and drops falsy values', () => {
    expect(cn('a', null, undefined, false, '', 'c')).toBe('a c')
  })

  it('flattens arrays and conditional objects', () => {
    expect(cn(['a', 'b'], { c: true, d: false })).toBe('a b c')
  })
})

describe('parseServerDate', () => {
  it('treats a zone-less backend timestamp as UTC, not local time', () => {
    const d = parseServerDate('2026-06-30T14:23:45')
    expect(d.toISOString()).toBe('2026-06-30T14:23:45.000Z')
  })

  it('leaves a timestamp with a Z designator untouched', () => {
    const d = parseServerDate('2026-06-30T14:23:45Z')
    expect(d.toISOString()).toBe('2026-06-30T14:23:45.000Z')
  })

  it('respects an explicit offset instead of appending Z', () => {
    const d = parseServerDate('2026-06-30T14:23:45+02:00')
    expect(d.toISOString()).toBe('2026-06-30T12:23:45.000Z')
  })

  it('returns null for empty input', () => {
    expect(parseServerDate(null)).toBeNull()
    expect(parseServerDate('')).toBeNull()
  })

  it('returns null for garbage instead of an Invalid Date', () => {
    expect(parseServerDate('not-a-date')).toBeNull()
  })
})
