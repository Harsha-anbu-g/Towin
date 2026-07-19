// Step 3 (reworked 2026-07-19): the family-side card offers a DOORWAY to the
// group thread in Messages. Only friendships at FIRST_MEET or above qualify.
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import FamilyHelperUpdates from './FamilyHelperUpdates'

const navigateMock = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}))

const helper = (over = {}) => ({
  connectionId: 'conn-9',
  helperName: 'Tom Walker',
  stageIndex: 5,
  ...over,
})

describe('FamilyHelperUpdates (doorway)', () => {
  it('offers the doorway with the shared-readers line at FIRST_MEET', () => {
    render(<FamilyHelperUpdates helper={helper()} elderName="Margaret" />)
    expect(screen.getByText(/Margaret and Tom Walker read these notes too/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /family updates/i })).toBeInTheDocument()
  })

  it('still offers the doorway above FIRST_MEET', () => {
    render(<FamilyHelperUpdates helper={helper({ stageIndex: 6 })} elderName="Margaret" />)
    expect(screen.getByRole('button', { name: /family updates/i })).toBeInTheDocument()
  })

  it('stays hidden below FIRST_MEET', () => {
    const { container } = render(<FamilyHelperUpdates helper={helper({ stageIndex: 4 })} elderName="Margaret" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('the doorway opens the group thread in Messages', () => {
    render(<FamilyHelperUpdates helper={helper()} elderName="Margaret" />)
    screen.getByRole('button', { name: /family updates/i }).click()
    expect(navigateMock).toHaveBeenCalledWith('/messages/conn-9?channel=family')
  })
})
