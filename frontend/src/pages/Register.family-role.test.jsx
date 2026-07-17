// US-003: FAMILY is a public signup role. The register page offers a plain-words
// option "I'm here for a family member" and submits role FAMILY to /auth/register.
import { describe, it, expect, vi, beforeEach } from 'vitest'
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

import api from '../api/axios'

const fill = (container, autoComplete, value, user) => {
  const input = container.querySelector(`input[autocomplete="${autoComplete}"]`)
  return user.type(input, value)
}

describe('Register family role option', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('offers the family option in plain words', () => {
    render(<MemoryRouter><Register /></MemoryRouter>)

    const option = screen.getByRole('button', { name: /i'm here for a family member/i })
    expect(option).toBeInTheDocument()
    // One-line explanation: they link to their parent inside the app after signing up
    expect(option).toHaveTextContent(/link .*(parent|family).* after you sign up/i)
  })

  it('submits role FAMILY when the family option is chosen', async () => {
    api.post.mockResolvedValueOnce({ data: {} })
    const user = userEvent.setup()
    const { container } = render(<MemoryRouter><Register /></MemoryRouter>)

    await user.click(screen.getByRole('button', { name: /i'm here for a family member/i }))
    await fill(container, 'username', 'sarah_daughter', user)
    await fill(container, 'email', 'sarah@example.com', user)
    const pwds = container.querySelectorAll('input[autocomplete="new-password"]')
    await user.type(pwds[0], 'longenoughpw')
    await user.type(pwds[1], 'longenoughpw')
    await user.click(container.querySelector('input[type="checkbox"]'))
    // exact case: the tab switcher is "Create account", the submit is "Create Account"
    await user.click(screen.getByRole('button', { name: 'Create Account' }))

    expect(api.post).toHaveBeenCalledWith('/auth/register', {
      username: 'sarah_daughter',
      email: 'sarah@example.com',
      password: 'longenoughpw',
      role: 'FAMILY',
    })
  })
})
