// US-010: Elder "My Family" screen — request / accept / revoke / primary flows.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import MyFamily from './MyFamily'

vi.mock('../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))

vi.mock('../context/useAuth', () => ({
  useAuth: () => ({ user: { role: 'ELDER', name: 'Margaret', username: 'margaret' } }),
}))

vi.mock('../context/useToast', () => ({
  useToast: () => ({ toast: { success: vi.fn(), error: vi.fn() } }),
}))

// NavBar pulls theme/toast/api/polling machinery — not under test here.
vi.mock('../components/NavBar', () => ({ default: () => <nav /> }))

import api from '../api/axios'

const links = {
  activeLinks: [
    { id: 'l1', otherUserName: 'Sarah', relationship: 'Daughter', isPrimary: true, status: 'ACTIVE', initiatedByMe: true, iAmElder: true },
    { id: 'l2', otherUserName: 'Arun', relationship: 'Son', isPrimary: false, status: 'ACTIVE', initiatedByMe: false, iAmElder: true },
  ],
  incomingRequests: [
    { id: 'r1', otherUserName: 'Meena', relationship: 'Niece', isPrimary: false, status: 'PENDING', initiatedByMe: false, iAmElder: true },
  ],
  outgoingRequests: [
    { id: 'r2', otherUserName: 'Ravi', relationship: 'Son', isPrimary: false, status: 'PENDING', initiatedByMe: true, iAmElder: true },
  ],
}

const renderPage = () => render(<MemoryRouter><MyFamily /></MemoryRouter>)

// The page opens on the family list; Controls and How it works are top-level tabs
// now (user call 2026-07-21). Click into a tab before asserting on its contents.
const openControls = async (user) =>
  user.click(await screen.findByRole('tab', { name: /^controls$/i }))

describe('MyFamily', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.get.mockResolvedValue({ data: links })
    api.post.mockResolvedValue({ data: {} })
    api.delete.mockResolvedValue({ data: {} })
  })

  it('loads and shows family, incoming and outgoing requests', async () => {
    renderPage()
    expect(api.get).toHaveBeenCalledWith('/family/links')
    expect(await screen.findByText('Sarah')).toBeInTheDocument()
    expect(screen.getByText('Arun')).toBeInTheDocument()
    // incoming request names the person and offers both outcomes
    expect(screen.getByText('Meena')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /accept/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /not now/i })).toBeInTheDocument()
    // outgoing waiting state says what's waited on and who controls it
    expect(screen.getByText('Ravi')).toBeInTheDocument()
    expect(screen.getByText(/waiting for ravi to accept/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel request/i })).toBeInTheDocument()
  })

  it('states the plain-words promises and the trust line', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Sarah')
    // The promises moved to the How it works tab (user call 2026-07-21).
    await user.click(screen.getByRole('tab', { name: /how it works/i }))
    expect(screen.getByText(/can see you're safe/i)).toBeInTheDocument()
    expect(screen.getByText(/only see the friendships you choose to share/i)).toBeInTheDocument()
    // Guardian mode replaced the old "they can never act for you" promise: they
    // can, but only if the elder asks them to, and never anonymously.
    expect(screen.getByText(/only do something for you if you ask them to/i)).toBeInTheDocument()
    expect(screen.getByText(/remove anyone at any time/i)).toBeInTheDocument()
    expect(screen.getByText(/one point total, however many/i)).toBeInTheDocument()
  })

  it('sends a family request with the exact identifier', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Sarah')
    await user.click(screen.getByRole('button', { name: /add a family member/i }))
    await user.type(screen.getByLabelText(/username, email or phone/i), 'arun_kumar')
    await user.type(screen.getByLabelText(/relationship/i), 'Son')
    await user.click(screen.getByRole('button', { name: /send request/i }))
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/family/requests', {
        identifier: 'arun_kumar', relationship: 'Son', side: 'family',
      })
    })
  })

  it('accepts an incoming request', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Meena')
    await user.click(screen.getByRole('button', { name: /accept/i }))
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/family/requests/r1/respond', { accept: true })
    })
  })

  it('declines an incoming request with Not now', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Meena')
    await user.click(screen.getByRole('button', { name: /not now/i }))
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/family/requests/r1/respond', { accept: false })
    })
  })

  it('removes a family member after confirming', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Arun')
    // second Remove belongs to Arun (non-primary card)
    await user.click(screen.getAllByRole('button', { name: /^remove$/i })[1])
    await user.click(screen.getByRole('button', { name: /remove from family/i }))
    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/family/links/l2')
    })
  })

  it('cancels an outgoing pending request', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Ravi')
    await user.click(screen.getByRole('button', { name: /cancel request/i }))
    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/family/links/r2')
    })
  })

  it('marks the primary and can move it', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Sarah')
    expect(screen.getByText('Main contact')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /make main contact/i }))
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/family/links/l2/primary')
    })
  })
})

// Controls: the two powers a family member can hold, finally in one place
// under one heading (user call 2026-07-20). Watching = what they may SEE,
// Act for me = what they may DO. They used to live on separate screens, which
// read as though only one of them existed.
describe('MyFamily — Controls', () => {
  const connections = [
    { id: 'c1', otherUserName: 'Harsha', status: 'ACTIVE', currentTrustLevel: 'TRUSTED', sharedWithFamily: false },
    { id: 'c2', otherUserName: 'Priya', status: 'ACTIVE', currentTrustLevel: 'PHONE_CALL', sharedWithFamily: true },
    // Ended friendships are not offered — you cannot share what is over.
    { id: 'c3', otherUserName: 'Gone', status: 'ENDED', currentTrustLevel: 'MESSAGING', sharedWithFamily: false },
  ]

  const mockGet = (powers = []) => {
    api.get.mockImplementation((url) => {
      if (url === '/family/links') {
        return Promise.resolve({
          data: {
            activeLinks: [{ ...links.activeLinks[0], delegatedPowers: powers }],
            incomingRequests: [], outgoingRequests: [],
          },
        })
      }
      if (url === '/connections') return Promise.resolve({ data: connections })
      return Promise.resolve({ data: {} })
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    api.post.mockResolvedValue({ data: {} })
    api.delete.mockResolvedValue({ data: {} })
    mockGet()
  })

  it('offers both Watching and Act for me tabs inside Controls', async () => {
    const user = userEvent.setup()
    renderPage()
    await openControls(user)
    expect(screen.getByRole('tab', { name: /watching/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /act for me/i })).toBeInTheDocument()
  })

  it('opens on Watching, listing each live friendship with its own switch', async () => {
    const user = userEvent.setup()
    renderPage()
    await openControls(user)
    expect(screen.getByText('Harsha')).toBeInTheDocument()
    expect(screen.getByText('Priya')).toBeInTheDocument()
    // An ended friendship is not something you can share.
    expect(screen.queryByText('Gone')).not.toBeInTheDocument()
    expect(screen.getAllByRole('switch', { name: /let my family see this friendship/i })).toHaveLength(2)
  })

  it('flips a friendship to watched through the visibility endpoint', async () => {
    const user = userEvent.setup()
    renderPage()
    await openControls(user)
    const switches = screen.getAllByRole('switch', { name: /let my family see this friendship/i })
    await user.click(switches[0])
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/connections/c1/family-visibility', { shared: true })
    })
  })

  it('shows the Act for me switches per family member, all off by default', async () => {
    const user = userEvent.setup()
    renderPage()
    await openControls(user)
    await user.click(screen.getByRole('tab', { name: /act for me/i }))
    const powerSwitches = await screen.findAllByRole('switch', { name: /sarah/i })
    expect(powerSwitches).toHaveLength(3)
    powerSwitches.forEach(s => expect(s).toHaveAttribute('aria-checked', 'false'))
  })

  it('grants one power without disturbing the others', async () => {
    const user = userEvent.setup()
    mockGet(['MANAGE_HELP_REQUESTS'])
    api.put = vi.fn().mockResolvedValue({ data: { delegatedPowers: ['MANAGE_HELP_REQUESTS', 'LEAVE_REVIEWS'] } })
    renderPage()
    await openControls(user)
    await user.click(screen.getByRole('tab', { name: /act for me/i }))
    await user.click(await screen.findByRole('switch', { name: /leave a review for you — sarah/i }))
    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith('/family/links/l1/powers', {
        powers: expect.arrayContaining(['MANAGE_HELP_REQUESTS', 'LEAVE_REVIEWS']),
      })
    })
  })
})
