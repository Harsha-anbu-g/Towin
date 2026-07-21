// One parent's own page — the shared friendships and every guardian-mode action.
// These moved off FamilyHome when the list got too crowded (user call 2026-07-20);
// the behaviour they lock down is unchanged.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import FamilyParent from './FamilyParent'

vi.mock('../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))

vi.mock('../context/useAuth', () => ({
  useAuth: () => ({ user: { role: 'FAMILY', name: 'Sarah', username: 'sarah' } }),
}))

vi.mock('../context/useToast', () => ({
  useToast: () => ({ toast: { success: vi.fn(), error: vi.fn() } }),
}))

vi.mock('../components/NavBar', () => ({ default: () => <nav /> }))

import api from '../api/axios'

const link = (powers = []) => ({
  id: 'l1', elderId: 'e1', otherUserName: 'Margaret', relationship: 'Daughter',
  status: 'ACTIVE', iAmElder: false, delegatedPowers: powers,
})

const openNeed = { id: 'n1', title: 'A ride to the doctor', description: 'Tuesday morning' }

const helperAt = (level) => ({
  connectionId: 'c1', helperUserId: 'h1', helperName: 'Arun', helperPhotoUrl: null,
  trustScore: 9, tier: 'Reliable', stageIndex: 2, stageLabel: 'Phone Ready',
  currentTrustLevel: level, readyToMeet: false,
})

// Mirrors the page's own loader, with granted powers and journey varied per test.
const mockWith = (powers = [], elder = {}) => {
  api.get.mockImplementation((url) => {
    if (url === '/family/links') {
      return Promise.resolve({
        data: { activeLinks: [link(powers)], incomingRequests: [], outgoingRequests: [] },
      })
    }
    if (url === '/family/journey') {
      return Promise.resolve({
        data: {
          elders: [{
            elderId: 'e1', elderName: 'Margaret', elderPhotoUrl: null,
            checkedInToday: true, openNeedsCount: 1,
            openNeeds: [openNeed], sharedHelpers: [], ...elder,
          }],
        },
      })
    }
    if (url === '/family/standings') return Promise.resolve({ data: { standings: [] } })
    return Promise.resolve({ data: {} })
  })
}

/**
 * Everything done in the parent's name now lives behind the "Act for me" tab,
 * matching the parent's own screen. Watching is what you can see; this is what
 * you can do.
 */
const openActForMe = async (user) =>
  user.click(await screen.findByRole('tab', { name: /act for me/i }))

const renderPage = () => render(
  <MemoryRouter initialEntries={['/family-home/parent/e1']}>
    <Routes>
      <Route path="/family-home/parent/:elderId" element={<FamilyParent />} />
    </Routes>
  </MemoryRouter>,
)

describe('FamilyParent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.post.mockResolvedValue({ data: {} })
    api.delete.mockResolvedValue({ data: {} })
    mockWith()
  })

  it('heads the page with the parent and how they are today', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Margaret' })).toBeInTheDocument()
    expect(screen.getByText(/you're margaret's daughter/i)).toBeInTheDocument()
    expect(screen.getByText(/checked in today/i)).toBeInTheDocument()
  })

  it('says plainly when the parent is no longer linked', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/family/links') {
        return Promise.resolve({ data: { activeLinks: [], incomingRequests: [], outgoingRequests: [] } })
      }
      return Promise.resolve({ data: {} })
    })
    renderPage()
    expect(await screen.findByText(/no longer linked to you/i)).toBeInTheDocument()
  })

  it('renders a shared helper row with name, trust badge and ladder stage', async () => {
    mockWith([], {
      openNeedsCount: 0,
      sharedHelpers: [{ ...helperAt('PHONE_CALL') }],
    })
    renderPage()
    expect(await screen.findByText('Friendships shared with you')).toBeInTheDocument()
    expect(screen.getByText('Arun')).toBeInTheDocument()
    expect(screen.getByText('Reliable')).toBeInTheDocument()
    expect(screen.getByText('· 9')).toBeInTheDocument()
    expect(screen.getByText(/stage 3 of 7/i)).toBeInTheDocument()
    expect(screen.getByText(/phone ready/i)).toBeInTheDocument()
    expect(screen.queryByText(/getting ready to meet in person/i)).not.toBeInTheDocument()
  })

  it('highlights a helper who is getting ready to meet in person', async () => {
    mockWith([], {
      openNeedsCount: 0,
      sharedHelpers: [{
        connectionId: 'c2', helperUserId: 'h2', helperName: 'Priya', helperPhotoUrl: null,
        trustScore: 12, tier: 'Highly Trusted', stageIndex: 5, stageLabel: 'Ready to Meet',
        currentTrustLevel: 'FIRST_MEET', readyToMeet: true,
      }],
    })
    renderPage()
    expect(await screen.findByText('Priya')).toBeInTheDocument()
    expect(screen.getByText(/stage 6 of 7/i)).toBeInTheDocument()
    expect(screen.getByText(/priya is getting ready to meet in person/i)).toBeInTheDocument()
  })

  it('offers the family updates thread at FIRST_MEET or above', async () => {
    mockWith([], {
      openNeedsCount: 0,
      sharedHelpers: [{
        connectionId: 'c2', helperName: 'Priya', helperPhotoUrl: null,
        trustScore: 12, tier: 'Highly Trusted', stageIndex: 5, stageLabel: 'Ready to Meet',
        readyToMeet: true,
      }],
    })
    renderPage()
    await screen.findByText('Priya')
    expect(screen.getByRole('button', { name: /family updates/i })).toBeInTheDocument()
  })

  it('offers no updates thread below FIRST_MEET (none exists yet)', async () => {
    mockWith([], {
      openNeedsCount: 0,
      sharedHelpers: [{
        connectionId: 'c1', helperName: 'Arun', helperPhotoUrl: null,
        trustScore: 9, tier: 'Reliable', stageIndex: 2, stageLabel: 'Phone Ready',
        readyToMeet: false,
      }],
    })
    renderPage()
    await screen.findByText('Arun')
    expect(screen.queryByRole('button', { name: /open updates/i })).not.toBeInTheDocument()
  })

  it('shows the plain-words empty state when the parent has shared no friendships', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Margaret' })
    expect(screen.getByText(/no friendships shared with you yet/i)).toBeInTheDocument()
  })
})

// Guardian mode: every action here is gated on a power the PARENT granted, and
// every one of them must read as "for Margaret", never as Sarah acting alone.
describe('FamilyParent — guardian mode actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.post.mockResolvedValue({ data: {} })
    api.delete.mockResolvedValue({ data: {} })
  })

  it('grants nothing when the parent granted nothing', async () => {
    const user = userEvent.setup()
    mockWith([], { sharedHelpers: [helperAt('TRUSTED')] })
    renderPage()
    await screen.findByText('A ride to the doctor')

    // Checked on the Act for me tab itself, not from Watching where these would
    // be absent regardless — the point is that the tab is empty, and says why.
    await openActForMe(user)
    expect(await screen.findByText(/hasn't asked you to do anything yet/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /ask for help for margaret/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /close this request for margaret/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /move the next step forward/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /leave a review for margaret/i })).not.toBeInTheDocument()
  })

  it('keeps the Watching tab read-only, with the doing on the other tab', async () => {
    const user = userEvent.setup()
    mockWith(['ADVANCE_TRUST'], { sharedHelpers: [helperAt('PHONE_CALL')] })
    renderPage()

    // Watching shows how they are and who they know — and offers no way to act.
    await screen.findByText('How Margaret is today')
    expect(screen.queryByText(/anything you do here is in margaret's name/i)).not.toBeInTheDocument()

    // The doing lives on Act for me, and everything there acts in the parent's name.
    await openActForMe(user)
    expect(await screen.findByText(/anything you do here is in margaret's name/i)).toBeInTheDocument()
  })

  it('posts a new help request for the parent when MANAGE_HELP_REQUESTS is granted', async () => {
    const user = userEvent.setup()
    mockWith(['MANAGE_HELP_REQUESTS'])
    renderPage()
    await openActForMe(user)
    await user.click(await screen.findByRole('button', { name: /ask for help for margaret/i }))
    await user.type(screen.getByLabelText(/what does margaret need help with/i), 'Shopping on Friday')
    await user.click(screen.getByRole('button', { name: /send for margaret/i }))
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/needs', expect.objectContaining({
        title: 'Shopping on Friday',
        onBehalfOfElderId: 'e1',
      }))
    })
  })

  it('closes one of the parent\'s open requests after a confirm step', async () => {
    const user = userEvent.setup()
    mockWith(['MANAGE_HELP_REQUESTS'])
    renderPage()
    await openActForMe(user)
    await user.click(await screen.findByRole('button', { name: /close this request for margaret/i }))
    // Destructive and done for someone else — never one careless tap.
    expect(screen.getByText(/close this for margaret\?/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /yes, close it/i }))
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/needs/n1'))
  })

  it('takes the parent\'s next trust step when ADVANCE_TRUST is granted', async () => {
    const user = userEvent.setup()
    mockWith(['ADVANCE_TRUST'], { sharedHelpers: [helperAt('PHONE_CALL')] })
    renderPage()
    await openActForMe(user)
    await user.click(await screen.findByRole('button', { name: /move the next step forward for margaret/i }))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/trust/c1/confirm'))
  })

  it('offers no trust step at the top of the ladder', async () => {
    mockWith(['ADVANCE_TRUST'], { sharedHelpers: [helperAt('TRUSTED')] })
    renderPage()
    await screen.findByText('Arun')
    expect(screen.queryByRole('button', { name: /move the next step forward/i })).not.toBeInTheDocument()
  })

  it('reviews a fully trusted helper for the parent when LEAVE_REVIEWS is granted', async () => {
    const user = userEvent.setup()
    mockWith(['LEAVE_REVIEWS'], { sharedHelpers: [helperAt('TRUSTED')] })
    renderPage()
    await openActForMe(user)
    await user.click(await screen.findByRole('button', { name: /leave a review for margaret/i }))
    await user.click(screen.getByRole('button', { name: /^4 stars$/i }))
    await user.click(screen.getByRole('button', { name: /save for margaret/i }))
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/reviews', expect.objectContaining({
        revieweeId: 'h1', rating: 4, onBehalfOfElderId: 'e1',
      }))
    })
  })

  it('offers no review below fully trusted — the same gate the parent lives under', async () => {
    mockWith(['LEAVE_REVIEWS'], { sharedHelpers: [helperAt('FIRST_MEET')] })
    renderPage()
    await screen.findByText('Arun')
    expect(screen.queryByRole('button', { name: /leave a review for margaret/i })).not.toBeInTheDocument()
  })
})
