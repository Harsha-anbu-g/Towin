// Regression: ISSUE-001 (revised) — login failure message was a plain div with no
// role="alert", so screen readers never announced "Invalid username or password."
// Found by /qa on 2026-07-05
// Report: .gstack/qa-reports/qa-report-localhost-5174-2026-07-05.md
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Login from './Login'

vi.mock('../api/axios', () => ({
  default: { post: vi.fn() },
}))

vi.mock('../context/useAuth', () => ({
  useAuth: () => ({ login: vi.fn() }),
}))

import api from '../api/axios'

describe('Login error announcement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('announces a wrong-password failure via role="alert"', async () => {
    api.post.mockRejectedValueOnce({ response: { status: 400 } })
    const user = userEvent.setup()
    render(<MemoryRouter><Login /></MemoryRouter>)

    await user.type(screen.getByLabelText(/username, gmail, or phone/i), 'wrong@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'wrongpassword1')
    await user.click(screen.getByRole('button', { name: 'Log In' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Invalid username or password.')
  })

  it('announces the rate-limit message via role="alert"', async () => {
    api.post.mockRejectedValueOnce({
      response: { status: 429, data: { message: 'Too many attempts. Try again in 15 minutes.' } },
    })
    const user = userEvent.setup()
    render(<MemoryRouter><Login /></MemoryRouter>)

    await user.type(screen.getByLabelText(/username, gmail, or phone/i), 'real@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'goodpassword1')
    await user.click(screen.getByRole('button', { name: 'Log In' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Too many attempts. Try again in 15 minutes.')
  })
})
