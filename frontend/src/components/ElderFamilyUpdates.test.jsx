// US-004 (Step 3): the elder-side thread section — the transparency
// guarantee in UI form. Labeled "Updates your family can see"; the elder
// always reads and writes the same feed family + helper use. If the elder
// turns sharing off, family loses the thread but the elder keeps it.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ElderFamilyUpdates from './ElderFamilyUpdates'

vi.mock('../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}))

vi.mock('../context/useAuth', () => ({
  useAuth: () => ({ user: { userId: 'elder-1' } }),
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
  otherUserName: 'Tom Walker',
}

const page = (content) => ({ data: { content } })

describe('ElderFamilyUpdates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.get.mockResolvedValue(page([]))
    api.post.mockResolvedValue({ data: {} })
  })

  it('renders nothing when the connection is not active', () => {
    const { container } = render(
      <ElderFamilyUpdates conn={{ ...sharedConn, status: 'PENDING' }} />,
    )
    expect(container).toBeEmptyDOMElement()
    expect(api.get).not.toHaveBeenCalled()
  })

  it('renders nothing below FIRST_MEET (no thread exists yet)', () => {
    const { container } = render(
      <ElderFamilyUpdates conn={{ ...sharedConn, currentTrustLevel: 'VERIFIED' }} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the family-visible section when shared at FIRST_MEET', async () => {
    render(<ElderFamilyUpdates conn={sharedConn} />)
    expect(screen.getByText(/updates your family can see/i)).toBeInTheDocument()
    expect(
      screen.getByText(/you, your family and Tom Walker all see the same notes/i),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith('/messages/c1?channel=FAMILY_UPDATES&size=50'),
    )
  })

  it('explains the empty thread: who writes next and when', async () => {
    render(<ElderFamilyUpdates conn={sharedConn} />)
    expect(
      await screen.findByText(/no updates yet\. after a visit, Tom Walker can write how it went/i),
    ).toBeInTheDocument()
  })

  it('posts the elder reply to the FAMILY_UPDATES channel', async () => {
    api.post.mockResolvedValue({
      data: {
        id: 'm9', senderId: 'elder-1', content: 'It was a lovely visit.',
        createdAt: '2026-07-19T12:00:00Z', channel: 'FAMILY_UPDATES',
      },
    })
    const user = userEvent.setup()
    render(<ElderFamilyUpdates conn={sharedConn} />)
    const box = screen.getByPlaceholderText(/write a note your family and Tom Walker can read/i)
    await user.type(box, 'It was a lovely visit.')
    await user.click(screen.getByRole('button', { name: /^send$/i }))
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        '/messages/c1/send?channel=FAMILY_UPDATES',
        { content: 'It was a lovely visit.' },
      ),
    )
    expect(await screen.findByText('It was a lovely visit.')).toBeInTheDocument()
  })

  it('hides the section when sharing is off and there are no notes (private friendship)', async () => {
    api.get.mockResolvedValue(page([]))
    const { container } = render(
      <ElderFamilyUpdates conn={{ ...sharedConn, sharedWithFamily: false }} />,
    )
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith('/messages/c1?channel=FAMILY_UPDATES&size=1'),
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('keeps the thread when sharing is off but notes exist, and says family cannot see it', async () => {
    api.get.mockImplementation((url) =>
      Promise.resolve(page([
        {
          id: 'm1', senderId: 'helper-9', senderLabel: 'helper Tom Walker',
          content: 'We did the shopping today.',
          createdAt: '2026-07-19T10:00:00Z', channel: 'FAMILY_UPDATES',
        },
      ].slice(0, url.includes('size=1') ? 1 : 50))),
    )
    render(<ElderFamilyUpdates conn={{ ...sharedConn, sharedWithFamily: false }} />)
    expect(await screen.findByText(/updates with Tom Walker/i)).toBeInTheDocument()
    expect(
      screen.getByText(/sharing is off, so your family can't see these notes\. you and Tom Walker still can/i),
    ).toBeInTheDocument()
    expect(await screen.findByText('We did the shopping today.')).toBeInTheDocument()
  })
})
