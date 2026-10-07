// Every sentence the website can show has a French and a Tamil line, and each
// line keeps the English placeholders and *highlight* marks. Add English copy,
// add its translations in src/i18n/fr.js and src/i18n/ta.js in the same change.
import { describe, it, expect } from 'vitest'
import { extractKeys } from '../../scripts/i18n-keys.mjs'
import fr from './fr'
import ta from './ta'

const keys = extractKeys()
const placeholders = (s) => (s.match(/\{\w+\}/g) || []).sort().join(',')
const stars = (s) => (s.match(/\*/g) || []).length

describe.each([
  ['French', fr],
  ['Tamil', ta],
])('%s', (_name, dict) => {
  it('has a line for every sentence the site shows', () => {
    const missing = keys.filter((k) => !Object.prototype.hasOwnProperty.call(dict, k))
    expect(missing).toEqual([])
  })

  it('keeps every placeholder and highlight mark', () => {
    const broken = Object.entries(dict)
      .filter(([en, line]) => placeholders(en) !== placeholders(line) || stars(en) !== stars(line))
      .map(([en]) => en)
    expect(broken).toEqual([])
  })

  it('carries no lines for sentences the site no longer shows', () => {
    const all = new Set(keys)
    expect(Object.keys(dict).filter((k) => !all.has(k))).toEqual([])
  })
})
