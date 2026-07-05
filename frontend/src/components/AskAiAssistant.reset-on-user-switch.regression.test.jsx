// Regression: ISSUE-003 — the Ask AI panel kept the previous user's whole
// conversation after logout/login (elders often share devices with family).
// The chat must reset whenever the signed-in user changes.
// Found by /qa on 2026-07-05
// Report: .gstack/qa-reports/qa-report-localhost-5174-2026-07-05.md
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import AskAiAssistant from './AskAiAssistant'

let mockUser = { userId: 'elder-1' }

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}))

vi.mock('../api/axios', () => ({
  default: { post: vi.fn() },
}))

import api from '../api/axios'

function renderWidget() {
  return render(<MemoryRouter><AskAiAssistant /></MemoryRouter>)
}

describe('AskAiAssistant reset on user switch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUser = { userId: 'elder-1' }
  })

  it('clears the previous conversation when a different user logs in', async () => {
    api.post.mockResolvedValueOnce({ data: { reply: 'Your trust score is 28 points.' } })
    const user = userEvent.setup()
    const { rerender } = renderWidget()

    await user.click(screen.getByRole('button', { name: /ask ai/i }))
    await user.type(screen.getByPlaceholderText(/type your question/i), 'What is my trust score?')
    await user.click(screen.getByRole('button', { name: /send/i }))
    expect(await screen.findByText('Your trust score is 28 points.')).toBeInTheDocument()

    mockUser = { userId: 'helper-9' }
    rerender(<MemoryRouter><AskAiAssistant /></MemoryRouter>)

    await waitFor(() => {
      expect(screen.queryByText('What is my trust score?', { selector: 'div,p,span' })).not.toBeInTheDocument()
      expect(screen.queryByText('Your trust score is 28 points.')).not.toBeInTheDocument()
    })
  })

  it('clears the conversation on logout (user becomes null)', async () => {
    api.post.mockResolvedValueOnce({ data: { reply: 'Here is how the Trust Journey works.' } })
    const user = userEvent.setup()
    const { rerender } = renderWidget()

    await user.click(screen.getByRole('button', { name: /ask ai/i }))
    await user.type(screen.getByPlaceholderText(/type your question/i), 'How does the Trust Journey work?')
    await user.click(screen.getByRole('button', { name: /send/i }))
    expect(await screen.findByText('Here is how the Trust Journey works.')).toBeInTheDocument()

    mockUser = null
    rerender(<MemoryRouter><AskAiAssistant /></MemoryRouter>)

    await waitFor(() => {
      expect(screen.queryByText('Here is how the Trust Journey works.')).not.toBeInTheDocument()
    })
  })
})
