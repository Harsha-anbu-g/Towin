// The real guards, imported — not a copy of their logic. If ElderOnly is ever
// swapped back to PrivateRoute on the check-in route, or the role list changes,
// these go red.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

const mockUser = { current: null }
vi.mock('../context/useAuth', () => ({
  useAuth: () => ({ user: mockUser.current }),
}))

import { PrivateRoute, PublicRoute, ElderOnly } from './guards'

// Renders the guard at /guarded and gives every destination it can redirect to
// a recognisable page, so the assertion names where the user actually ended up.
const renderGuard = (Guard) =>
  render(
    <MemoryRouter initialEntries={['/guarded']}>
      <Routes>
        <Route path="/guarded" element={<Guard><p>the guarded page</p></Guard>} />
        <Route path="/login" element={<p>login page</p>} />
        <Route path="/dashboard" element={<p>dashboard page</p>} />
        <Route path="/streaks" element={<p>check-in page</p>} />
        <Route path="/family-home" element={<p>family home page</p>} />
        <Route path="/admin" element={<p>admin page</p>} />
      </Routes>
    </MemoryRouter>
  )

beforeEach(() => { mockUser.current = null })

describe('ElderOnly — who may open the daily check-in', () => {
  it('lets an elder through', () => {
    mockUser.current = { role: 'ELDER' }
    renderGuard(ElderOnly)
    expect(screen.getByText('the guarded page')).toBeInTheDocument()
  })

  it('lets a BOTH user through — they are an elder as well', () => {
    mockUser.current = { role: 'BOTH' }
    renderGuard(ElderOnly)
    expect(screen.getByText('the guarded page')).toBeInTheDocument()
  })

  it('sends a helper to their dashboard instead', () => {
    mockUser.current = { role: 'HELPER' }
    renderGuard(ElderOnly)
    expect(screen.getByText('dashboard page')).toBeInTheDocument()
    expect(screen.queryByText('the guarded page')).not.toBeInTheDocument()
  })

  it('sends a family member to their dashboard instead', () => {
    mockUser.current = { role: 'FAMILY' }
    renderGuard(ElderOnly)
    expect(screen.getByText('dashboard page')).toBeInTheDocument()
  })

  it('sends a signed-out visitor to log in', () => {
    renderGuard(ElderOnly)
    expect(screen.getByText('login page')).toBeInTheDocument()
  })
})

describe('PublicRoute — where a signed-in user gets sent', () => {
  it('shows the public page to a signed-out visitor', () => {
    renderGuard(PublicRoute)
    expect(screen.getByText('the guarded page')).toBeInTheDocument()
  })

  it('sends an elder to the check-in', () => {
    mockUser.current = { role: 'ELDER' }
    renderGuard(PublicRoute)
    expect(screen.getByText('check-in page')).toBeInTheDocument()
  })

  it('sends a helper to their dashboard, never the check-in', () => {
    mockUser.current = { role: 'HELPER' }
    renderGuard(PublicRoute)
    expect(screen.getByText('dashboard page')).toBeInTheDocument()
    expect(screen.queryByText('check-in page')).not.toBeInTheDocument()
  })

  it('sends a family member to family home', () => {
    mockUser.current = { role: 'FAMILY' }
    renderGuard(PublicRoute)
    expect(screen.getByText('family home page')).toBeInTheDocument()
  })

  it('sends an admin to the admin page', () => {
    mockUser.current = { role: 'ADMIN' }
    renderGuard(PublicRoute)
    expect(screen.getByText('admin page')).toBeInTheDocument()
  })
})

describe('PrivateRoute', () => {
  it('lets any signed-in user through', () => {
    mockUser.current = { role: 'HELPER' }
    renderGuard(PrivateRoute)
    expect(screen.getByText('the guarded page')).toBeInTheDocument()
  })

  it('sends a signed-out visitor to log in', () => {
    renderGuard(PrivateRoute)
    expect(screen.getByText('login page')).toBeInTheDocument()
  })
})
