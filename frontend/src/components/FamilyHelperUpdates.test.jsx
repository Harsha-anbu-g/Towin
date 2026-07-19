// US-004 (Step 3): family-side updates thread on the shared helper journey
// card. Only friendships at FIRST_MEET or above have a thread; the card
// offers an "Open updates" button that reveals the read + reply view.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FamilyHelperUpdates from './FamilyHelperUpdates'

vi.mock('../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}))

vi.mock('../context/useAuth', () => ({
  useAuth: () => ({ user: { userId: 'fam-1' } }),
}))

const toastError = vi.fn()
vi.mock('../context/useToast', () => ({
  useToast: () => ({ toast: { success: vi.fn(), error: toastError, info: vi.fn() } }),
}))

import api from '../api/axios'

// stageIndex mirrors backend TrustLevel values (FIRST_MEET = 5, TRUSTED = 6).
const helper = {
  connectionId: 'c1',
  helperName: 'Tom Walker',
  stageIndex: 5,
  stageLabel: 'Ready to Meet',
}

const page = (content) => ({ data: { content } })

describe('FamilyHelperUpdates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.get.mockResolvedValue(page([]))
    api.post.mockResolvedValue({ data: {} })
  })

  it('renders nothing below FIRST_MEET (no thread exists yet)', () => {
    const { container } = render(
      <FamilyHelperUpdates helper={{ ...helper, stageIndex: 4 }} elderName="Margaret" />,
    )
    expect(container).toBeEmptyDOMElement()
    expect(api.get).not.toHaveBeenCalled()
  })

  it('offers an Open updates button at FIRST_MEET without loading the thread yet', () => {
    render(<FamilyHelperUpdates helper={helper} elderName="Margaret" />)
    expect(screen.getByRole('button', { name: /open updates/i })).toBeInTheDocument()
    expect(api.get).not.toHaveBeenCalled()
  })

  it('still offers the thread at TRUSTED (above FIRST_MEET)', () => {
    render(<FamilyHelperUpdates helper={{ ...helper, stageIndex: 6 }} elderName="Margaret" />)
    expect(screen.getByRole('button', { name: /open updates/i })).toBeInTheDocument()
  })

  it('opens the thread with the thank-you composer and loads FAMILY_UPDATES', async () => {
    const user = userEvent.setup()
    render(<FamilyHelperUpdates helper={helper} elderName="Margaret" />)
    await user.click(screen.getByRole('button', { name: /open updates/i }))
    expect(
      screen.getByPlaceholderText(/say thank you or ask how it went/i),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith('/messages/c1?channel=FAMILY_UPDATES&size=50'),
    )
    // the button flips so the thread can be put away again
    expect(screen.getByRole('button', { name: /hide updates/i })).toBeInTheDocument()
  })

  it('explains the empty thread: who writes next and when', async () => {
    const user = userEvent.setup()
    render(<FamilyHelperUpdates helper={helper} elderName="Margaret" />)
    await user.click(screen.getByRole('button', { name: /open updates/i }))
    expect(
      await screen.findByText(/no updates yet\. after a visit, Tom Walker can write how it went/i),
    ).toBeInTheDocument()
  })

  it('shows helper notes with their sender labels', async () => {
    api.get.mockResolvedValue(page([
      {
        id: 'm1', senderId: 'helper-1', senderLabel: 'helper Tom Walker',
        content: 'We did the shopping, she was in great spirits.',
        createdAt: '2026-07-19T10:00:00Z', channel: 'FAMILY_UPDATES',
      },
    ]))
    const user = userEvent.setup()
    render(<FamilyHelperUpdates helper={helper} elderName="Margaret" />)
    await user.click(screen.getByRole('button', { name: /open updates/i }))
    expect(
      await screen.findByText('We did the shopping, she was in great spirits.'),
    ).toBeInTheDocument()
    expect(screen.getByText('helper Tom Walker')).toBeInTheDocument()
  })

  it('posts the reply to the FAMILY_UPDATES channel', async () => {
    api.post.mockResolvedValue({
      data: {
        id: 'm9', senderId: 'fam-1', content: 'Thank you so much, Tom!',
        createdAt: '2026-07-19T12:00:00Z', channel: 'FAMILY_UPDATES',
      },
    })
    const user = userEvent.setup()
    render(<FamilyHelperUpdates helper={helper} elderName="Margaret" />)
    await user.click(screen.getByRole('button', { name: /open updates/i }))
    const box = screen.getByPlaceholderText(/say thank you or ask how it went/i)
    await user.type(box, 'Thank you so much, Tom!')
    await user.click(screen.getByRole('button', { name: /^send$/i }))
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        '/messages/c1/send?channel=FAMILY_UPDATES',
        { content: 'Thank you so much, Tom!' },
      ),
    )
    expect(await screen.findByText('Thank you so much, Tom!')).toBeInTheDocument()
  })
})
