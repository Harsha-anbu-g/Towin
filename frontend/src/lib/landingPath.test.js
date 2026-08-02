// One place decides where each role lands after sign-in. Four call sites import
// it, so a wrong answer here shows up on every login path at once.
import { describe, it, expect } from 'vitest'
import { landingPathForRole } from './landingPath'

describe('landingPathForRole', () => {
  it('sends elders to the daily check-in', () => {
    expect(landingPathForRole('ELDER')).toBe('/streaks')
  })

  it('sends BOTH to the daily check-in too — they are elders as well', () => {
    expect(landingPathForRole('BOTH')).toBe('/streaks')
  })

  it('sends helpers to their dashboard, not the check-in', () => {
    expect(landingPathForRole('HELPER')).toBe('/dashboard')
  })

  it('sends family members to family home', () => {
    expect(landingPathForRole('FAMILY')).toBe('/family-home')
  })

  it('sends admins to the admin page', () => {
    expect(landingPathForRole('ADMIN')).toBe('/admin')
  })

  it('falls back to the dashboard for an unknown or missing role', () => {
    expect(landingPathForRole('SOMETHING_NEW')).toBe('/dashboard')
    expect(landingPathForRole(undefined)).toBe('/dashboard')
  })
})
