// Regression: ISSUE-004 — the Posted Help badge read "1 HELPER WANT TO HELP";
// the noun was pluralized but the verb never was.
// Regression: ISSUE-006 — the demo chips hardcoded ages ("Margaret, 72") that
// drift from the seeded birthdates (streaks page computed 73).
// Found by /qa on 2026-07-05
// Report: .gstack/qa-reports/qa-report-localhost-5174-2026-07-05.md
import { describe, it, expect } from 'vitest'
import { applicantsLabel, yearsOld, familyNamesLabel } from './copy'

describe('applicantsLabel', () => {
  it('uses the singular verb for one helper', () => {
    expect(applicantsLabel(1)).toBe('1 helper wants to help')
  })

  it('uses the plural verb for several helpers', () => {
    expect(applicantsLabel(3)).toBe('3 helpers want to help')
  })

  it('handles zero as plural', () => {
    expect(applicantsLabel(0)).toBe('0 helpers want to help')
  })
})

describe('yearsOld', () => {
  // new Date(y, m-1, d) builds local dates — no UTC parsing shift.
  it('computes full years from a birthdate', () => {
    expect(yearsOld('1953-05-14', new Date(2026, 6, 5))).toBe(73)
  })

  it('does not count the year before the birthday has passed', () => {
    expect(yearsOld('1953-05-14', new Date(2026, 4, 13))).toBe(72)
  })

  it('counts the birthday itself', () => {
    expect(yearsOld('1953-05-14', new Date(2026, 4, 14))).toBe(73)
  })

  it('works for the demo helper birthdate', () => {
    expect(yearsOld('2003-03-14', new Date(2026, 6, 5))).toBe(23)
  })
})

// The family who see an elder's daily check-in, named on the check-in page.
describe('familyNamesLabel', () => {
  it('names one person plainly', () => {
    expect(familyNamesLabel(['Sarah'])).toBe('Sarah')
  })

  it('joins two with "and"', () => {
    expect(familyNamesLabel(['Sarah', 'David'])).toBe('Sarah and David')
  })

  it('collapses three to two names plus one other', () => {
    expect(familyNamesLabel(['Sarah', 'David', 'Priya'])).toBe('Sarah, David and one other')
  })

  it('counts the rest in plain words past three', () => {
    expect(familyNamesLabel(['Sarah', 'David', 'Priya', 'Tom'])).toBe('Sarah, David and 2 others')
  })

  it('returns nothing for an empty or missing list', () => {
    expect(familyNamesLabel([])).toBe('')
    expect(familyNamesLabel(undefined)).toBe('')
  })
})
