// Step 3 (reworked 2026-07-19): the elder card offers a DOORWAY to the family
// updates group thread in Messages. Sharing off keeps the doorway only when
// notes already exist (the elder never loses their own history).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import ElderFamilyUpdates from './ElderFamilyUpdates'

const navigateMock = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}))

vi.mock('../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}))
import api from '../api/axios'

const conn = (over = {}) => ({
  id: 'conn-2',
  status: 'ACTIVE',
  sharedWithFamily: true,
  currentTrustLevel: 'FIRST_MEET',
  otherUserName: 'Tom Walker',
  ...over,
})

describe('ElderFamilyUpdates (doorway)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.get.mockResolvedValue({ data: { content: [] } })
  })

  it('shows "Updates your family can see" with the doorway when shared', async () => {
    render(<ElderFamilyUpdates conn={conn()} />)
    expect(await screen.findByText(/updates your family can see/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /family updates/i })).toBeInTheDocument()
  })

  it('keeps the doorway when sharing is off but notes already exist', async () => {
    api.get.mockResolvedValue({ data: { content: [{ id: 'm1' }] } })
    render(<ElderFamilyUpdates conn={conn({ sharedWithFamily: false })} />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /family updates/i })).toBeInTheDocument()
    )
  })

  it('shows nothing when sharing is off and no notes exist', async () => {
    const { container } = render(<ElderFamilyUpdates conn={conn({ sharedWithFamily: false })} />)
    await waitFor(() => expect(api.get).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('shows nothing below FIRST_MEET', () => {
    const { container } = render(<ElderFamilyUpdates conn={conn({ currentTrustLevel: 'VIDEO_CALL' })} />)
    expect(container).toBeEmptyDOMElement()
  })
})
