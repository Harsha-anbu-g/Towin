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
    await user.click(screen.getByRole('tab', { name: /add parent/i }))
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
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Margaret')
    // The feed lives behind the News tab now (section tabs, user call 2026-07-19).
    await user.click(screen.getByRole('tab', { name: /news/i }))
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
    const user = userEvent.setup()
    mockGet([])
    renderPage()
    await screen.findByText('Margaret')
    await user.click(screen.getByRole('tab', { name: /news/i }))
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

  // The depth moved to FamilyParent (user call 2026-07-20) — this list now only
  // has to stay skimmable and offer one clear way in per parent. The shared-helper
  // and guardian-mode suites live in FamilyParent.test.jsx.
  it('offers a way into each parent\'s own page, with the friendship count on it', async () => {
    mockGet(alerts, {
      elders: [{
        elderId: 'e1', elderName: 'Margaret', elderPhotoUrl: null, checkedInToday: true, openNeedsCount: 0,
        sharedHelpers: [
          { connectionId: 'c1', helperName: 'Arun', currentTrustLevel: 'PHONE_CALL' },
          { connectionId: 'c2', helperName: 'Priya', currentTrustLevel: 'FIRST_MEET' },
        ],
      }],
    })
    renderPage()
    expect(await screen.findByRole('button', { name: /open margaret's page · 2 friendships/i })).toBeInTheDocument()
  })

  it('uses singular wording for a single shared friendship', async () => {
    mockGet(alerts, {
      elders: [{
        elderId: 'e1', elderName: 'Margaret', elderPhotoUrl: null, checkedInToday: true, openNeedsCount: 0,
        sharedHelpers: [{ connectionId: 'c1', helperName: 'Arun', currentTrustLevel: 'PHONE_CALL' }],
      }],
    })
    renderPage()
    expect(await screen.findByRole('button', { name: /open margaret's page · 1 friendship$/i })).toBeInTheDocument()
  })

  it('keeps the trust ladders and guardian actions off this list', async () => {
    renderPage()
    await screen.findByText('Margaret')
    expect(screen.queryByText(/friendships shared with you/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /ask for help for margaret/i })).not.toBeInTheDocument()
  })

  // "What I pass on": being asked to hold a key to an elder's Sealed box. The card has its
  // own tests; these two are only about it being on this screen, and staying off it when
  // nobody has asked.
  it('shows a keyholder request among the other things being asked of me', async () => {
    const withAsk = (url) => (url === '/passon/keyholders/asked-of-me'
      ? Promise.resolve({ data: [{
        id: 'k1', ownerId: 'e1', ownerName: 'Margaret', approvalsNeeded: 2, keyholderCount: 3,
      }] })
      : null)
    const base = api.get.getMockImplementation()
    api.get.mockImplementation(url => withAsk(url) || base(url))

    renderPage()
    expect(await screen.findByText('Margaret has asked you to hold a key.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'No thanks' })).toBeInTheDocument()
  })

  it('says nothing about keyholders when nobody has asked', async () => {
    renderPage()
    await screen.findByText('Margaret')
    expect(screen.queryByText(/hold a key/i)).not.toBeInTheDocument()
  })
})

// The reassurance band (2026-07-26): the one-line "is Mum okay" answer the
// My Parents cards lead with. Urgent beats quiet; quiet comes from the
// check-in date, never the lingering INACTIVITY alert.
describe('FamilyHome — reassurance band', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.post.mockResolvedValue({ data: {} })
  })

  it('leads with all-looks-well when the parent checked in today', async () => {
    mockGet([], journey)
    render(<MemoryRouter><FamilyHome /></MemoryRouter>)
    expect(await screen.findByText(/all looks well — margaret checked in today/i)).toBeInTheDocument()
  })

  it('turns quiet when the last check-in is days old', async () => {
    const old = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10)
    mockGet([], {
      elders: [{
        elderId: 'e1', elderName: 'Margaret', elderPhotoUrl: null,
        checkedInToday: false, lastCheckinDate: old, openNeedsCount: 0, sharedHelpers: [],
      }],
    })
    render(<MemoryRouter><FamilyHome /></MemoryRouter>)
    expect(await screen.findByText(/it's been quiet — margaret hasn't checked in/i)).toBeInTheDocument()
  })

  it('a fresh urgent alert beats everything else', async () => {
    const fresh = [{
      id: 'a9', elderId: 'e1', elderName: 'Margaret', type: 'SOS',
      body: 'Margaret pressed SOS.', createdAt: new Date(Date.now() - 3600000).toISOString(),
    }]
    mockGet(fresh, journey)
    render(<MemoryRouter><FamilyHome /></MemoryRouter>)
    expect(await screen.findByText(/asked for urgent help — see news/i)).toBeInTheDocument()
  })
})
