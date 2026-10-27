// Regression: the helper said "the app will show you the request and ask you to
// confirm", and the website never did. The server's proposal (data.action) was
// dropped, so an elder who typed "do" got the same promise again. Now the site
// shows the request in its own dialog and acts only on Yes.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
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

const PROPOSAL = {
  reply: 'The app will show you the request and ask you to confirm. It is not posted until you confirm.',
  action: { name: 'postHelpRequest', arguments: { title: 'A ride to the doctor on Thursday', category: 'TRANSPORTATION' } },
}

async function askForARide() {
  const user = userEvent.setup()
  render(<MemoryRouter initialEntries={['/dashboard']}><AskAiAssistant /></MemoryRouter>)
  await user.click(screen.getByRole('button', { name: /ask ai/i }))
  await user.type(screen.getByPlaceholderText(/type your question/i), 'post a req for doctor on thursday{Enter}')
  await screen.findByText(/will show you the request/i)
  const dialog = await screen.findByRole('dialog', { name: 'Post this request?' })
  return { user, dialog }
}

describe('AskAiAssistant proposals', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.post.mockImplementation(async (url) => {
      if (url === '/assistant/chat') return { data: PROPOSAL }
      if (url === '/needs') return { data: { id: 'n1' } }
      if (url === '/streaks/checkin') return { data: { currentStreak: 4, alreadyCheckedIn: false } }
      throw new Error(`unexpected ${url}`)
    })
  })

  it('shows the proposed request in the dialog and posts it on Yes', async () => {
    const { user, dialog } = await askForARide()
    expect(dialog).toHaveTextContent('The helper wants to post this request for you:')
    expect(dialog).toHaveTextContent('A ride to the doctor on Thursday')
    expect(dialog).toHaveTextContent('Rides')

    await user.click(within(dialog).getByRole('button', { name: 'Yes, post it' }))

    expect(api.post).toHaveBeenCalledWith('/needs', {
      title: 'A ride to the doctor on Thursday',
      description: null,
      category: 'TRANSPORTATION',
      urgency: 'NORMAL',
    })
    expect(await screen.findByText(/Done\. Your request is posted/)).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Post this request?' })).not.toBeInTheDocument()
  })

  it('posts nothing on Not now and keeps the chat open', async () => {
    const { user, dialog } = await askForARide()
    await user.click(within(dialog).getByRole('button', { name: 'Not now' }))

    expect(api.post.mock.calls.some(([url]) => url === '/needs')).toBe(false)
    expect(screen.queryByRole('dialog', { name: 'Post this request?' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Done\./)).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText(/type your question/i)).toBeInTheDocument()
  })

  it('Escape closes the dialog, not the whole chat', async () => {
    const { user } = await askForARide()
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog', { name: 'Post this request?' })).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText(/type your question/i)).toBeInTheDocument()
    expect(api.post.mock.calls.some(([url]) => url === '/needs')).toBe(false)
  })

  it('offers the check-in the same way', async () => {
    api.post.mockImplementation(async (url) => {
      if (url === '/assistant/chat') return { data: { reply: 'The app will ask you to confirm.', action: { name: 'checkInToday', arguments: {} } } }
      if (url === '/streaks/checkin') return { data: { currentStreak: 4, alreadyCheckedIn: false } }
      throw new Error(`unexpected ${url}`)
    })
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/dashboard']}><AskAiAssistant /></MemoryRouter>)
    await user.click(screen.getByRole('button', { name: /ask ai/i }))
    await user.type(screen.getByPlaceholderText(/type your question/i), 'check me in{Enter}')
    const dialog = await screen.findByRole('dialog', { name: 'Check in today?' })
    await user.click(within(dialog).getByRole('button', { name: 'Yes, check in' }))

    expect(api.post).toHaveBeenCalledWith('/streaks/checkin')
    expect(await screen.findByText('Done. You are checked in for today.')).toBeInTheDocument()
  })
})
