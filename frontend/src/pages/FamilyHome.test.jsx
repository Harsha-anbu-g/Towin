// US-012: Family home screen — add-parent / requests / elder cards / alert feed.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import FamilyHome from './FamilyHome'

vi.mock('../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))

vi.mock('../context/useAuth', () => ({
  useAuth: () => ({ user: { role: 'FAMILY', name: 'Sarah', username: 'sarah' } }),
}))

vi.mock('../context/useToast', () => ({
  useToast: () => ({ toast: { success: vi.fn(), error: vi.fn() } }),
}))

// NavBar pulls theme/toast/api/polling machinery — not under test here.
vi.mock('../components/NavBar', () => ({ default: () => <nav /> }))

import api from '../api/axios'

// Everything is from the CALLER's perspective; FamilyHome only shows the
// links where the caller sits on the FAMILY side (iAmElder: false).
const links = {
  activeLinks: [
    { id: 'l1', elderId: 'e1', otherUserName: 'Margaret', relationship: 'Daughter', isPrimary: true, status: 'ACTIVE', initiatedByMe: true, iAmElder: false },
    // Elder-side link (a BOTH user's own family) — must NOT appear here.
    { id: 'l9', otherUserName: 'ElderSideOnly', relationship: 'Son', isPrimary: false, status: 'ACTIVE', initiatedByMe: true, iAmElder: true },
  ],
  incomingRequests: [
    { id: 'r1', otherUserName: 'Harold', relationship: 'Daughter', isPrimary: false, status: 'PENDING', initiatedByMe: false, iAmElder: false },
  ],
  outgoingRequests: [
    { id: 'r2', otherUserName: 'Doris', relationship: 'Niece', isPrimary: false, status: 'PENDING', initiatedByMe: true, iAmElder: false },
  ],
}

const alerts = [
  { id: 'a1', elderId: 'e1', elderName: 'Margaret', type: 'SOS', body: 'Margaret pressed SOS.', createdAt: '2026-07-17T12:00:00' },
  { id: 'a2', elderId: 'e1', elderName: 'Margaret', type: 'FIRST_MEET', body: 'Margaret is ready to meet Arun in person.', createdAt: '2026-07-16T12:00:00' },
  { id: 'a3', elderId: 'e1', elderName: 'Margaret', type: 'INACTIVITY', body: 'Margaret has not checked in for 7 days.', createdAt: '2026-07-15T12:00:00' },
]

// US-002: journey data — parent status (check-in + open help requests) per elder.
const journey = {
  elders: [
    { elderId: 'e1', elderName: 'Margaret', elderPhotoUrl: null, checkedInToday: true, openNeedsCount: 2, sharedHelpers: [] },
  ],
}

const mockGet = (alertList = alerts, journeyData = journey) => {
  api.get.mockImplementation((url) => {
    if (url === '/family/links') return Promise.resolve({ data: links })
    if (url === '/family/alerts') return Promise.resolve({ data: { alerts: alertList } })
    if (url === '/family/journey') return Promise.resolve({ data: journeyData })
    if (url === '/connections') return Promise.resolve({ data: [] }) // Step 4: own connection states
    return Promise.resolve({ data: {} })
  })
}

const renderPage = () => render(<MemoryRouter><FamilyHome /></MemoryRouter>)

describe('FamilyHome', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGet()
    api.post.mockResolvedValue({ data: {} })
    api.delete.mockResolvedValue({ data: {} })
  })

  it('loads links and alerts, shows the linked elder and both request lists', async () => {
    renderPage()
    expect(api.get).toHaveBeenCalledWith('/family/links')
    expect(api.get).toHaveBeenCalledWith('/family/alerts')
    expect(await screen.findByText('Margaret')).toBeInTheDocument()
    // incoming: the elder invited me — I choose
    expect(screen.getByText('Harold')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /accept/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /not now/i })).toBeInTheDocument()
    // outgoing waiting state says what's waited on and who controls it
    expect(screen.getByText('Doris')).toBeInTheDocument()
    expect(screen.getByText(/waiting for doris to accept/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel request/i })).toBeInTheDocument()
  })

  it('never shows the caller-as-elder side of links', async () => {
    renderPage()
    await screen.findByText('Margaret')
    expect(screen.queryByText('ElderSideOnly')).not.toBeInTheDocument()
  })

  it('sends an add-parent request with side elder', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Margaret')
    await user.click(screen.getByRole('button', { name: /add your parent/i }))
    await user.type(screen.getByLabelText(/username, email or phone/i), 'margaret')
    await user.type(screen.getByLabelText(/relationship/i), 'Daughter')
    await user.click(screen.getByRole('button', { name: /send request/i }))
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/family/requests', {
        identifier: 'margaret', relationship: 'Daughter', side: 'elder',
      })
    })
  })

  it('accepts an incoming request from an elder', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Harold')
    await user.click(screen.getByRole('button', { name: /accept/i }))
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/family/requests/r1/respond', { accept: true })
    })
  })

  it('cancels an outgoing pending request', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Doris')
    await user.click(screen.getByRole('button', { name: /cancel request/i }))
    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/family/links/r2')
    })
  })

  it('shows the alert feed with a plain-words explanation per alert type', async () => {
    renderPage()
    await screen.findByText('Margaret pressed SOS.')
    // SOS
    expect(screen.getByText(/asked for urgent help/i)).toBeInTheDocument()
    // FIRST_MEET
    expect(screen.getByText('Margaret is ready to meet Arun in person.')).toBeInTheDocument()
    expect(screen.getByText(/meeting a friend in person for the first time/i)).toBeInTheDocument()
    // INACTIVITY
    expect(screen.getByText('Margaret has not checked in for 7 days.')).toBeInTheDocument()
    expect(screen.getByText(/not checked in for a while/i)).toBeInTheDocument()
  })

  it('explains the empty alert feed in plain words', async () => {
    mockGet([])
    renderPage()
    await screen.findByText('Margaret')
    expect(screen.getByText(/no alerts right now/i)).toBeInTheDocument()
  })

  // US-002: parent status line — check-in chip + open help request count.
  it('shows the checked-in chip and the open request count on the elder card', async () => {
    renderPage()
    expect(await screen.findByText('Checked in today')).toBeInTheDocument()
    expect(screen.getByText('2 help requests open')).toBeInTheDocument()
    expect(api.get).toHaveBeenCalledWith('/family/journey')
  })

  it('shows the neutral chip and hides the count when no check-in and zero open requests', async () => {
    mockGet(alerts, {
      elders: [
        { elderId: 'e1', elderName: 'Margaret', elderPhotoUrl: null, checkedInToday: false, openNeedsCount: 0, sharedHelpers: [] },
      ],
    })
    renderPage()
    expect(await screen.findByText('No check-in yet today')).toBeInTheDocument()
    expect(screen.queryByText(/help request/i)).not.toBeInTheDocument()
  })

  it('uses singular wording for one open help request', async () => {
    mockGet(alerts, {
      elders: [
        { elderId: 'e1', elderName: 'Margaret', elderPhotoUrl: null, checkedInToday: true, openNeedsCount: 1, sharedHelpers: [] },
      ],
    })
    renderPage()
    expect(await screen.findByText('1 help request open')).toBeInTheDocument()
  })

  // US-003: shared helper journey cards under each elder card.
  it('renders a shared helper row with name, trust badge and ladder stage', async () => {
    mockGet(alerts, {
      elders: [
        {
          elderId: 'e1', elderName: 'Margaret', elderPhotoUrl: null, checkedInToday: true, openNeedsCount: 0,
          sharedHelpers: [
            { connectionId: 'c1', helperName: 'Arun', helperPhotoUrl: null, trustScore: 9, tier: 'Reliable', stageIndex: 2, stageLabel: 'Phone Ready', readyToMeet: false },
          ],
        },
      ],
    })
    renderPage()
    expect(await screen.findByText('Friendships shared with you')).toBeInTheDocument()
    expect(screen.getByText('Arun')).toBeInTheDocument()
    // TrustBadge: tier + score
    expect(screen.getByText('Reliable')).toBeInTheDocument()
    expect(screen.getByText('· 9')).toBeInTheDocument()
    // Ladder stage in plain words (stageIndex is 0-based → Stage 3 of 7)
    expect(screen.getByText(/stage 3 of 7/i)).toBeInTheDocument()
    expect(screen.getByText(/phone ready/i)).toBeInTheDocument()
    // Not ready to meet — no highlight
    expect(screen.queryByText(/getting ready to meet in person/i)).not.toBeInTheDocument()
  })

  it('highlights a helper who is getting ready to meet in person', async () => {
    mockGet(alerts, {
      elders: [
        {
          elderId: 'e1', elderName: 'Margaret', elderPhotoUrl: null, checkedInToday: true, openNeedsCount: 0,
          sharedHelpers: [
            { connectionId: 'c2', helperName: 'Priya', helperPhotoUrl: null, trustScore: 12, tier: 'Highly Trusted', stageIndex: 5, stageLabel: 'Ready to Meet', readyToMeet: true },
          ],
        },
      ],
    })
    renderPage()
    expect(await screen.findByText('Priya')).toBeInTheDocument()
    expect(screen.getByText(/stage 6 of 7/i)).toBeInTheDocument()
    expect(screen.getByText(/they're getting ready to meet in person/i)).toBeInTheDocument()
  })

  // US-004: the shared updates thread opens from the helper journey card.
  it('offers Open updates on a helper card at FIRST_MEET or above', async () => {
    mockGet(alerts, {
      elders: [
        {
          elderId: 'e1', elderName: 'Margaret', elderPhotoUrl: null, checkedInToday: true, openNeedsCount: 0,
          sharedHelpers: [
            { connectionId: 'c2', helperName: 'Priya', helperPhotoUrl: null, trustScore: 12, tier: 'Highly Trusted', stageIndex: 5, stageLabel: 'Ready to Meet', readyToMeet: true },
          ],
        },
      ],
    })
    renderPage()
    await screen.findByText('Priya')
    expect(screen.getByRole('button', { name: /open updates/i })).toBeInTheDocument()
  })

  it('offers no updates thread below FIRST_MEET (none exists yet)', async () => {
    mockGet(alerts, {
      elders: [
        {
          elderId: 'e1', elderName: 'Margaret', elderPhotoUrl: null, checkedInToday: true, openNeedsCount: 0,
          sharedHelpers: [
            { connectionId: 'c1', helperName: 'Arun', helperPhotoUrl: null, trustScore: 9, tier: 'Reliable', stageIndex: 2, stageLabel: 'Phone Ready', readyToMeet: false },
          ],
        },
      ],
    })
    renderPage()
    await screen.findByText('Arun')
    expect(screen.queryByRole('button', { name: /open updates/i })).not.toBeInTheDocument()
  })

  it('shows the plain-words empty state when the parent has shared no friendships', async () => {
    renderPage()
    await screen.findByText('Margaret')
    expect(screen.getByText(/no friendships shared with you yet/i)).toBeInTheDocument()
    expect(screen.getByText(/your parent chooses what to share/i)).toBeInTheDocument()
  })
})
