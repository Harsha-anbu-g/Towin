// The line under the check-in button that says who this reaches. It is the
// whole point of the page, so it has to be right in every state — including
// the common one where nobody is linked yet.
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import CheckInFamilyNote from './CheckInFamilyNote'

const show = (props) =>
  render(<MemoryRouter><CheckInFamilyNote {...props} /></MemoryRouter>)

describe('CheckInFamilyNote', () => {
  it('names the family who will see a check-in that has not happened yet', () => {
    show({ names: ['Sarah', 'David'], checkedIn: false })
    expect(screen.getByText(/Sarah and David will see this/i)).toBeInTheDocument()
  })

  it('switches to the past tense once they have checked in', () => {
    show({ names: ['Sarah', 'David'], checkedIn: true })
    expect(screen.getByText(/Sarah and David can see you checked in/i)).toBeInTheDocument()
  })

  it('collapses a long family list', () => {
    show({ names: ['Sarah', 'David', 'Priya', 'Tom'], checkedIn: false })
    expect(screen.getByText(/Sarah, David and 2 others will see this/i)).toBeInTheDocument()
  })

  it('offers to add family when nobody is linked, and never scolds', () => {
    show({ names: [], checkedIn: false })
    expect(screen.getByText(/see you checked in/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /add your family/i })).toHaveAttribute('href', '/family')
  })

  it('shows the invitation while still loading, not a wrong name list', () => {
    show({ names: undefined, checkedIn: false })
    expect(screen.getByRole('link', { name: /add your family/i })).toBeInTheDocument()
  })
})
