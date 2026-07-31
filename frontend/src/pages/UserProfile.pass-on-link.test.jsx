// The way in to "From Margaret".
//
// /passed-on/:ownerId is worth nothing if nobody can reach it, and a profile is the one
// place in the app where you are already looking at the person whose page it is. The link
// is offered on an elder's profile only: helpers and family have no page of their own to
// read, so on their profiles it would open something permanently empty.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

vi.mock('../api/axios', () => ({ default: { get: vi.fn() } }))
vi.mock('../components/NavBar', () => ({ default: () => <nav /> }))

import api from '../api/axios'
import UserProfile from './UserProfile'

const MARGARET = 'aaaaaaaa-0000-0000-0000-00000000e001'

const profile = (over = {}) => ({
  id: MARGARET,
  name: 'Margaret',
  username: 'margaret',
  role: 'ELDER',
  ...over,
})

const mockProfile = (over = {}) => {
  api.get.mockImplementation((url) => {
    if (url === `/profile/${MARGARET}`) return Promise.resolve({ data: profile(over) })
    return Promise.resolve({ data: [] })
  })
}

const renderProfile = () =>
  render(
    <MemoryRouter initialEntries={[`/user/${MARGARET}`]}>
      <Routes>
        <Route path="/user/:id" element={<UserProfile />} />
      </Routes>
    </MemoryRouter>,
  )

describe('A profile — the way in to what that person passes on', () => {
  beforeEach(() => vi.clearAllMocks())

  // Matched on the opening words rather than the whole string: the blurb underneath is
  // part of the link, so a screen reader reads "What Margaret passes on. Her stories, and
  // any letter she wrote to you." as one name. That is the right thing to announce, so the
  // test bends to it rather than hiding the second line behind an aria-label.
  it('offers an elder’s page, named after her', async () => {
    mockProfile()
    renderProfile()
    const link = await screen.findByRole('link', { name: /^What Margaret passes on/ })
    expect(link).toHaveAttribute('href', `/passed-on/${MARGARET}`)
    expect(link).toHaveTextContent('Her stories, and any letter she wrote to you.')
  })

  it('offers it on a profile that is both, because she is still an elder', async () => {
    mockProfile({ role: 'BOTH' })
    renderProfile()
    expect(await screen.findByRole('link', { name: /^What Margaret passes on/ })).toBeInTheDocument()
  })

  it('does not offer it on a helper’s profile, who has no such page', async () => {
    mockProfile({ name: 'Priya', role: 'HELPER' })
    renderProfile()
    expect(await screen.findByRole('heading', { name: 'Priya', level: 1 })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /passes on/i })).not.toBeInTheDocument()
  })
})
