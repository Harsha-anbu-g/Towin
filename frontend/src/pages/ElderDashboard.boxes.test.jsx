// The way in to "What I pass on" from the elder's own dashboard.
//
// The owner asked for a card rather than a sixth tab: below 640px the dashboard's
// tab strip is a two-column grid and its TabIcon has no default branch, so a new
// tab there would render with no icon at all. So this is a card on the landing
// tab, and these tests hold that line — a tab named "My boxes" is a failure here.
//
// The card says what is actually in her boxes, because "My boxes" on its own tells
// somebody in her seventies nothing about what she would find behind it. When there
// is nothing in them yet it says so in words; it never shows her a row of zeros.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const authUser = { current: { userId: 'e1', role: 'ELDER', name: 'Margaret', username: 'margaret' } }

vi.mock('../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))
vi.mock('../context/useAuth', () => ({ useAuth: () => ({ user: authUser.current }) }))
vi.mock('../context/useToast', () => ({
  useToast: () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }),
}))
// NavBar pulls theme/toast/polling machinery, and it carries its own link to the
// same page — mocking it out keeps this test about the dashboard card alone.
vi.mock('../components/NavBar', () => ({ default: () => <nav /> }))

import api from '../api/axios'
import ElderDashboard from './ElderDashboard'

const item = (id) => ({ id, title: `Item ${id}` })

const inHerBoxes = ({ stories = 0, letters = 0, armed = false } = {}) => {
  api.get.mockImplementation((url) => {
    if (url === '/passon/mine') {
      return Promise.resolve({
        data: {
          stories: Array.from({ length: stories }, (_, i) => item(`s${i}`)),
          letters: Array.from({ length: letters }, (_, i) => item(`l${i}`)),
        },
      })
    }
    if (url === '/passon/setup') return Promise.resolve({ data: { armed } })
    if (url === '/needs/mine') return Promise.resolve({ data: { content: [] } })
    return Promise.resolve({ data: [] })
  })
}

const renderDash = () => render(<MemoryRouter><ElderDashboard /></MemoryRouter>)

const boxesLink = () => screen.queryByRole('link', { name: /my boxes/i })

describe('Elder dashboard — the My boxes card', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authUser.current = { userId: 'e1', role: 'ELDER', name: 'Margaret', username: 'margaret' }
    api.post.mockResolvedValue({ data: {} })
    api.put.mockResolvedValue({ data: {} })
    api.delete.mockResolvedValue({ data: {} })
    inHerBoxes()
  })

  it('names the page and what is inside it, and opens it', async () => {
    inHerBoxes({ stories: 3, letters: 2, armed: true })
    renderDash()

    expect(await screen.findByRole('heading', { name: 'My boxes' })).toBeInTheDocument()
    expect(
      screen.getByText('Your stories, your letters, and the things only you know.')
    ).toBeInTheDocument()
    expect(boxesLink()).toHaveAttribute('href', '/what-i-pass-on')
  })

  it('counts what she has really written, and says her box is shut', async () => {
    inHerBoxes({ stories: 3, letters: 2, armed: true })
    renderDash()

    expect(await screen.findByText('3 stories · 2 letters · your box is shut')).toBeInTheDocument()
  })

  it('says one story and one letter, not "1 stories"', async () => {
    inHerBoxes({ stories: 1, letters: 1 })
    renderDash()

    expect(await screen.findByText('1 story · 1 letter')).toBeInTheDocument()
  })

  it('leaves out the sealed box until she has actually set one up', async () => {
    inHerBoxes({ stories: 2 })
    renderDash()

    expect(await screen.findByText('2 stories')).toBeInTheDocument()
    expect(screen.queryByText(/box is shut/i)).not.toBeInTheDocument()
  })

  it('says so warmly when her boxes are empty, and never shows her a zero', async () => {
    inHerBoxes()
    renderDash()

    expect(await screen.findByText(/nothing in your boxes yet/i)).toBeInTheDocument()
    expect(screen.queryByText(/\b0 (stories|letters)\b/)).not.toBeInTheDocument()
  })

  it('is a card on the page, never a sixth tab', async () => {
    inHerBoxes({ stories: 1 })
    renderDash()

    await screen.findByRole('heading', { name: 'My boxes' })
    expect(screen.queryByRole('tab', { name: /boxes/i })).not.toBeInTheDocument()
    expect(screen.getAllByRole('tab')).toHaveLength(5)
  })

  it('is not offered to a helper, whose page it is not', async () => {
    authUser.current = { userId: 'h1', role: 'HELPER', name: 'Priya', username: 'priya' }
    inHerBoxes({ stories: 3, letters: 2, armed: true })
    renderDash()

    // The helper's own dashboard content still loads, so wait on something real
    // before asserting the card's absence.
    await screen.findByRole('heading', { name: 'My Helpers' })
    expect(boxesLink()).not.toBeInTheDocument()
    expect(api.get).not.toHaveBeenCalledWith('/passon/mine')
  })
})
