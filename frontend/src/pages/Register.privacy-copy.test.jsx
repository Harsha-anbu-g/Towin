// The Privacy Policy claimed "industry-standard encryption in transit and at
// rest". At rest is not true of the database, so the sentence was a promise we
// could not keep. This locks the corrected wording in place.
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Register from './Register'

vi.mock('../api/axios', () => ({
  default: { post: vi.fn() },
}))

vi.mock('../context/useAuth', () => ({
  useAuth: () => ({ login: vi.fn() }),
}))

const openPrivacy = async () => {
  const user = userEvent.setup()
  render(<MemoryRouter><Register /></MemoryRouter>)
  await user.click(screen.getByRole('button', { name: /privacy policy/i }))
  return screen.getByRole('heading', { name: /security/i }).parentElement
}

describe('Privacy Policy security section', () => {
  it('does not claim the database is encrypted at rest', async () => {
    const security = await openPrivacy()

    expect(security).not.toHaveTextContent(/in transit and at rest/i)
  })

  it('still promises encryption in transit', async () => {
    const security = await openPrivacy()

    expect(security).toHaveTextContent(/in transit/i)
  })

  it('names the Sealed box as the part that is encrypted while stored', async () => {
    const security = await openPrivacy()

    expect(security).toHaveTextContent(/sealed box/i)
  })
})
