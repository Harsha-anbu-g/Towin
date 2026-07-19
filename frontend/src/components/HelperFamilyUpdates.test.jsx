// Step 3 (reworked 2026-07-19): the helper card offers a DOORWAY to the family
// updates group thread in Messages — the notes no longer live inline. The
// double gate is unchanged: conn ACTIVE + sharedWithFamily + trust >= FIRST_MEET.
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import HelperFamilyUpdates from './HelperFamilyUpdates'

const navigateMock = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}))

const conn = (over = {}) => ({
  id: 'conn-1',
  status: 'ACTIVE',
  sharedWithFamily: true,
  currentTrustLevel: 'FIRST_MEET',
  otherUserName: 'Margaret',
  ...over,
})

describe('HelperFamilyUpdates (doorway)', () => {
  it('shows the section with the audience line when the double gate holds', () => {
    render(<HelperFamilyUpdates conn={conn()} />)
    expect(screen.getByText(/updates for the family/i)).toBeInTheDocument()
    expect(screen.getByText(/their family and Margaret can read these notes/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /family updates/i })).toBeInTheDocument()
  })

  it('still renders at TRUSTED (above FIRST_MEET)', () => {
    render(<HelperFamilyUpdates conn={conn({ currentTrustLevel: 'TRUSTED' })} />)
    expect(screen.getByRole('button', { name: /family updates/i })).toBeInTheDocument()
  })

  it('stays hidden when the friendship is not shared with family', () => {
    const { container } = render(<HelperFamilyUpdates conn={conn({ sharedWithFamily: false })} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('stays hidden below FIRST_MEET', () => {
    const { container } = render(<HelperFamilyUpdates conn={conn({ currentTrustLevel: 'VIDEO_CALL' })} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('the doorway opens the group thread in Messages', () => {
    render(<HelperFamilyUpdates conn={conn()} />)
    screen.getByRole('button', { name: /family updates/i }).click()
    expect(navigateMock).toHaveBeenCalledWith('/messages/conn-1?channel=family')
  })
})
