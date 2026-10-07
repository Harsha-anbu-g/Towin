// Regression: the chat sent its whole history with every question, and the
// server refuses more than 12 turns, so from about the seventh question on every
// reply was "Sorry, I couldn't answer just now". The current question was also
// sent twice, once as the message and again inside the history.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import AskAiAssistant from './AskAiAssistant'

vi.mock('../context/useAuth', () => ({
  useAuth: () => ({ user: { userId: 'elder-1' } }),
}))

vi.mock('../api/axios', () => ({
  default: { post: vi.fn() },
}))

import api from '../api/axios'

describe('AskAiAssistant history', () => {
  beforeEach(() => vi.clearAllMocks())

  it('keeps a long conversation working: recent history only, question sent once', async () => {
    api.post.mockImplementation(async (_url, body) => ({ data: { reply: `Answer to ${body.message}` } }))
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/guide']}><AskAiAssistant /></MemoryRouter>)
    await user.click(screen.getByRole('button', { name: /ask ai/i }))

    for (let i = 1; i <= 9; i += 1) {
      await user.type(screen.getByPlaceholderText(/type your question/i), `Question ${i}{Enter}`)
      await screen.findByText(`Answer to Question ${i}`)
    }

    const [, last] = api.post.mock.calls.at(-1)
    expect(last.message).toBe('Question 9')
    expect(last.history.length).toBeLessThanOrEqual(10)
    expect(last.history.some((m) => m.content === 'Question 9')).toBe(false)
    expect(last.history.at(-1)).toEqual({ role: 'assistant', content: 'Answer to Question 8' })

    const [, first] = api.post.mock.calls[0]
    expect(first.history).toEqual([])
  })

  it('says to wait a minute when asked too fast', async () => {
    api.post.mockRejectedValueOnce({ response: { status: 429 } })
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/guide']}><AskAiAssistant /></MemoryRouter>)
    await user.click(screen.getByRole('button', { name: /ask ai/i }))
    await user.type(screen.getByPlaceholderText(/type your question/i), 'Hello{Enter}')
    expect(await screen.findByText(/wait a minute/i)).toBeInTheDocument()
  })
})
