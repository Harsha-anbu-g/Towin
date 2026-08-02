// "What I pass on" is an elder-only page reached from the navigation, not a
// sixth dashboard tab: below 640px the dashboard tab strip becomes a two-column
// grid and its TabIcon has no default branch, so a new tab there renders with no
// icon at all. It has to be reachable from both the desktop account menu and the
// mobile drawer, or half the people who own the page cannot find it.
//
// In the navigation it is called "My boxes" — what she has, in her words — while
// the page itself keeps its title. These tests assert the nav label, not the page
// heading, so the two can be worded for their own places.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const authUser = { current: { role: 'ELDER', name: 'Margaret', username: 'margaret' } }

vi.mock('../api/axios', () => ({
  default: { get: vi.fn().mockResolvedValue({ data: {} }), post: vi.fn().mockResolvedValue({ data: {} }) },
}))
vi.mock('../context/useAuth', () => ({
  useAuth: () => ({ user: authUser.current, logout: vi.fn() }),
}))
vi.mock('../context/useToast', () => ({
  useToast: () => ({ toast: { success: vi.fn(), error: vi.fn() } }),
}))
vi.mock('../context/useTheme', () => ({
  useTheme: () => ({ theme: 'day', toggleTheme: vi.fn() }),
}))

import NavBar from './NavBar'

const setWidth = (px) => {
  window.innerWidth = px
  window.dispatchEvent(new Event('resize'))
}

const renderNav = () => render(<MemoryRouter><NavBar /></MemoryRouter>)

describe('NavBar — the way in to What I pass on', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authUser.current = { role: 'ELDER', name: 'Margaret', username: 'margaret' }
  })

  afterEach(() => setWidth(1024))

  it('offers it in the desktop account menu', async () => {
    const user = userEvent.setup()
    setWidth(1280)
    renderNav()
    await user.click(screen.getByRole('button', { name: /account/i }))
    const link = await screen.findByRole('menuitem', { name: /my boxes/i })
    expect(link).toHaveAttribute('href', '/what-i-pass-on')
  })

  it('offers it in the mobile drawer', async () => {
    const user = userEvent.setup()
    setWidth(390)
    renderNav()
    await user.click(screen.getByRole('button', { name: /^menu$/i }))
    expect(await screen.findByRole('link', { name: /my boxes/i })).toHaveAttribute('href', '/what-i-pass-on')
  })

  it('does not offer it to a helper, whose page it is not', async () => {
    const user = userEvent.setup()
    authUser.current = { role: 'HELPER', name: 'Priya', username: 'priya' }
    setWidth(390)
    renderNav()
    await user.click(screen.getByRole('button', { name: /^menu$/i }))
    expect(screen.queryByRole('link', { name: /my boxes/i })).not.toBeInTheDocument()
  })
})
