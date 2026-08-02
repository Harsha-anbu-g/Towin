// The check-in page's job is to tell an elder that checking in is what lets
// their family know they are alright. These tests defend that promise.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}))
vi.mock('../context/useToast', () => ({
  useToast: () => ({ toast: { success: vi.fn(), error: vi.fn() } }),
}))
vi.mock('../components/NavBar', () => ({ default: () => <nav /> }))

import api from '../api/axios'
import Streaks from './Streaks'

// Margaret's own family links. iAmElder: true means she sits in the elder seat —
// the other side of those links is her family, and they are who see her check-in.
const familyLinks = {
  activeLinks: [
    { id: 'l1', otherUserName: 'Sarah', relationship: 'Daughter', status: 'ACTIVE', iAmElder: true },
    { id: 'l2', otherUserName: 'David', relationship: 'Son', status: 'ACTIVE', iAmElder: true },
    // A link where Margaret is the FAMILY side (she also watches her own mother).
    // Those people do NOT see her check-in and must not be named here.
    { id: 'l3', otherUserName: 'Nora', relationship: 'Mother', status: 'ACTIVE', iAmElder: false },
  ],
  incomingRequests: [],
  outgoingRequests: [],
}

const mockApi = ({ streak = {}, links = familyLinks, linksFail = false } = {}) => {
  api.get.mockImplementation((url) => {
    if (url === '/streaks/me') {
      return Promise.resolve({ data: {
        currentStreak: 4, longestStreak: 9, lastCheckinDate: null, alreadyCheckedIn: false, ...streak,
      } })
    }
    if (url === '/profile/me') return Promise.resolve({ data: { dateOfBirth: null } })
    if (url === '/family/links') {
      return linksFail ? Promise.reject(new Error('down')) : Promise.resolve({ data: links })
    }
    return Promise.resolve({ data: {} })
  })
}

const show = () => render(<MemoryRouter><Streaks /></MemoryRouter>)

describe('the daily check-in page', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('leads with the family reason, not the streak count', async () => {
    mockApi()
    show()
    expect(await screen.findByText(/Let your family know you're alright/i)).toBeInTheDocument()
  })

  it('names the family who will see it', async () => {
    mockApi()
    show()
    expect(await screen.findByText(/Sarah and David will see this/i)).toBeInTheDocument()
  })

  it('never names people on the other side of the link — they do not see her check-in', async () => {
    mockApi()
    show()
    await screen.findByText(/Sarah and David will see this/i)
    expect(screen.queryByText(/Nora/)).not.toBeInTheDocument()
  })

  it('invites an elder with no family linked, without blocking the check-in', async () => {
    mockApi({ links: { activeLinks: [], incomingRequests: [], outgoingRequests: [] } })
    show()
    expect(await screen.findByRole('link', { name: /add your family/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /I'm here today/i })).toBeInTheDocument()
  })

  // Degrades to the invitation and a working check-in. The swallowing itself
  // (the .catch) is pinned by the runner rather than by an assertion here:
  // removing it leaves these assertions passing but turns the run red with an
  // unhandled rejection — verified by hand, exit 1 with the catch removed.
  it('still lets them check in when the family lookup fails', async () => {
    mockApi({ linksFail: true })
    api.post.mockResolvedValue({ data: {
      currentStreak: 5, longestStreak: 9, lastCheckinDate: '2026-07-31', alreadyCheckedIn: false,
    } })
    show()

    const button = await screen.findByRole('button', { name: /I'm here today/i })
    // No names to show, so the page falls back to the invitation — never a
    // half-written line and never a blocked button.
    expect(screen.getByRole('link', { name: /add your family/i })).toBeInTheDocument()
    expect(screen.queryByText(/will see this/i)).not.toBeInTheDocument()

    await userEvent.click(button)
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/streaks/checkin'))
    expect(await screen.findByText(/Your family knows you're alright today/i)).toBeInTheDocument()
  })

  it('says the family knows, once they have checked in', async () => {
    mockApi({ streak: { alreadyCheckedIn: true, currentStreak: 5, lastCheckinDate: '2026-07-31' } })
    show()
    expect(await screen.findByText(/Your family knows you're alright today/i)).toBeInTheDocument()
    expect(screen.getByText(/Sarah and David can see you checked in/i)).toBeInTheDocument()
  })

  it('switches to the family-knows message after tapping check in', async () => {
    mockApi()
    api.post.mockResolvedValue({ data: {
      currentStreak: 5, longestStreak: 9, lastCheckinDate: '2026-07-31', alreadyCheckedIn: false,
    } })
    show()
    const button = await screen.findByRole('button', { name: /I'm here today/i })
    await userEvent.click(button)
    await waitFor(() =>
      expect(screen.getByText(/Your family knows you're alright today/i)).toBeInTheDocument())
  })

  it('keeps the streak underneath — the reward, not the reason', async () => {
    mockApi()
    show()
    expect(await screen.findByText(/days in a row/i)).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
  })
})
