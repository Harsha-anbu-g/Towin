// US-003 (Step 3): Helper post-visit note prompt — "Updates for the family"
// section on the helper's connection card. Only rendered when the double gate
// holds (conn ACTIVE + sharedWithFamily + trust >= FIRST_MEET); composer posts
// to the FAMILY_UPDATES channel and plainly states who reads the notes.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import HelperFamilyUpdates from './HelperFamilyUpdates'

vi.mock('../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}))

vi.mock('../context/useAuth', () => ({
  useAuth: () => ({ user: { userId: 'helper-1' } }),
}))

const toastError = vi.fn()
vi.mock('../context/useToast', () => ({
  useToast: () => ({ toast: { success: vi.fn(), error: toastError, info: vi.fn() } }),
}))

import api from '../api/axios'

const sharedConn = {
  id: 'c1',
  status: 'ACTIVE',
  sharedWithFamily: true,
  currentTrustLevel: 'FIRST_MEET',
  otherUserName: 'Margaret Thompson',
}

const page = (content) => ({ data: { content } })

describe('HelperFamilyUpdates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.get.mockResolvedValue(page([]))
    api.post.mockResolvedValue({ data: {} })
  })

  it('renders nothing when the connection is not shared with family', () => {
    const { container } = render(
      <HelperFamilyUpdates conn={{ ...sharedConn, sharedWithFamily: false }} />,
    )
    expect(container).toBeEmptyDOMElement()
    expect(api.get).not.toHaveBeenCalled()
  })

  it('renders nothing below FIRST_MEET even when shared', () => {
    const { container } = render(
      <HelperFamilyUpdates conn={{ ...sharedConn, currentTrustLevel: 'VERIFIED' }} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when the connection is not active', () => {
    const { container } = render(
      <HelperFamilyUpdates conn={{ ...sharedConn, status: 'PENDING' }} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('still renders at TRUSTED (above FIRST_MEET)', () => {
    render(<HelperFamilyUpdates conn={{ ...sharedConn, currentTrustLevel: 'TRUSTED' }} />)
    expect(screen.getByText(/updates for the family/i)).toBeInTheDocument()
  })

  it('shows the section with audience line when the double gate holds', async () => {
    render(<HelperFamilyUpdates conn={sharedConn} />)
    expect(screen.getByText(/updates for the family/i)).toBeInTheDocument()
    expect(
      screen.getByText(/their family and Margaret Thompson can read these notes/i),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith('/messages/c1?channel=FAMILY_UPDATES&size=50'),
    )
  })

  it('leads the composer with the post-visit note prompt', () => {
    render(<HelperFamilyUpdates conn={sharedConn} />)
    expect(
      screen.getByPlaceholderText(/write a short note about how things went/i),
    ).toBeInTheDocument()
  })

  it('renders thread messages with their sender labels', async () => {
    api.get.mockResolvedValue(page([
      {
        id: 'm1', senderId: 'elder-1', senderLabel: 'Margaret Thompson',
        content: 'Thank you for the visit!', createdAt: '2026-07-19T10:00:00Z',
        channel: 'FAMILY_UPDATES',
      },
      {
        id: 'm2', senderId: 'fam-1', senderLabel: 'their daughter Sarah',
        content: 'So glad it went well.', createdAt: '2026-07-19T11:00:00Z',
        channel: 'FAMILY_UPDATES',
      },
    ]))
    render(<HelperFamilyUpdates conn={sharedConn} />)
    expect(await screen.findByText('Thank you for the visit!')).toBeInTheDocument()
    expect(screen.getByText('So glad it went well.')).toBeInTheDocument()
    expect(screen.getByText('their daughter Sarah')).toBeInTheDocument()
  })

  it('shows a waiting-friendly empty state when there are no notes yet', async () => {
    render(<HelperFamilyUpdates conn={sharedConn} />)
    expect(
      await screen.findByText(/no notes yet\. after a visit, write how it went/i),
    ).toBeInTheDocument()
  })

  it('posts the note to the FAMILY_UPDATES channel and clears the box', async () => {
    api.post.mockResolvedValue({
      data: {
        id: 'm9', senderId: 'helper-1', content: 'We did the shopping today.',
        createdAt: '2026-07-19T12:00:00Z', channel: 'FAMILY_UPDATES',
      },
    })
    const user = userEvent.setup()
    render(<HelperFamilyUpdates conn={sharedConn} />)
    const box = screen.getByPlaceholderText(/write a short note about how things went/i)
    await user.type(box, 'We did the shopping today.')
    await user.click(screen.getByRole('button', { name: /share note/i }))
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        '/messages/c1/send?channel=FAMILY_UPDATES',
        { content: 'We did the shopping today.' },
      ),
    )
    expect(box).toHaveValue('')
    expect(await screen.findByText('We did the shopping today.')).toBeInTheDocument()
  })

  it('explains when the note could not be sent', async () => {
    api.post.mockRejectedValueOnce({ response: { data: { message: 'Not allowed' } } })
    const user = userEvent.setup()
    render(<HelperFamilyUpdates conn={sharedConn} />)
    const box = screen.getByPlaceholderText(/write a short note about how things went/i)
    await user.type(box, 'Hello')
    await user.click(screen.getByRole('button', { name: /share note/i }))
    await waitFor(() => expect(toastError).toHaveBeenCalled())
    expect(box).toHaveValue('Hello')
  })
})
