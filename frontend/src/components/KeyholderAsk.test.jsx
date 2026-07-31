// "What I pass on" — the Keyholder acceptance card on the family member's own screen.
//
// Nobody is conscripted into a duty about a death without being asked, so the two things
// this card must always do are say what is really being asked and offer a real "no". Every
// test here is about one of those two.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import KeyholderAsk from './KeyholderAsk'

vi.mock('../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}))

import api from '../api/axios'

const ASK = {
  id: 'k1',
  ownerId: 'o1',
  ownerName: 'Margaret',
  approvalsNeeded: 2,
  keyholderCount: 3,
}

describe('KeyholderAsk', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.get.mockResolvedValue({ data: [ASK] })
    api.post.mockResolvedValue({ data: {} })
  })

  it('renders nothing at all when nobody has asked', async () => {
    api.get.mockResolvedValue({ data: [] })
    const { container } = render(<KeyholderAsk />)
    await waitFor(() => expect(api.get).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('says who asked and what is really being asked', async () => {
    render(<KeyholderAsk />)
    expect(await screen.findByText('Margaret has asked you to hold a key.')).toBeInTheDocument()
    expect(screen.getByText(/the people who can ask to open Margaret's Sealed box/i)).toBeInTheDocument()
    expect(screen.getByText(/you never will unless that day comes/i)).toBeInTheDocument()
  })

  it('uses the real numbers, not the example from the design', async () => {
    api.get.mockResolvedValue({ data: [{ ...ASK, approvalsNeeded: 3, keyholderCount: 5 }] })
    render(<KeyholderAsk />)
    expect(await screen.findByText(/3 of the 5 of you would have to agree/i)).toBeInTheDocument()
  })

  it('leaves the number out entirely before the elder has chosen one', async () => {
    api.get.mockResolvedValue({ data: [{ ...ASK, approvalsNeeded: null }] })
    render(<KeyholderAsk />)
    await screen.findByText('Margaret has asked you to hold a key.')
    expect(screen.queryByText(/would have to agree/i)).not.toBeInTheDocument()
  })

  it('always says they can change their mind', async () => {
    render(<KeyholderAsk />)
    expect(await screen.findByText('You can change your mind whenever you like.')).toBeInTheDocument()
  })

  it('offers a real no, not only a yes', async () => {
    render(<KeyholderAsk />)
    expect(await screen.findByRole('button', { name: 'Yes, I will do that' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'No thanks' })).toBeInTheDocument()
  })

  it('saying yes sends accept true and thanks them by name', async () => {
    const user = userEvent.setup()
    render(<KeyholderAsk />)
    await user.click(await screen.findByRole('button', { name: 'Yes, I will do that' }))

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/passon/keyholders/k1/respond', { accept: true }))
    expect(await screen.findByText('Thank you. Margaret will see that you said yes.')).toBeInTheDocument()
  })

  it('saying no sends accept false and does not press them', async () => {
    const user = userEvent.setup()
    render(<KeyholderAsk />)
    await user.click(await screen.findByRole('button', { name: 'No thanks' }))

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/passon/keyholders/k1/respond', { accept: false }))
    expect(await screen.findByText('That is fine. Nothing more is needed from you.')).toBeInTheDocument()
  })

  it('shows the server’s own words when an answer will not send', async () => {
    const user = userEvent.setup()
    api.post.mockRejectedValue({ response: { data: { message: 'That has already been answered.' } } })
    render(<KeyholderAsk />)
    await user.click(await screen.findByRole('button', { name: 'Yes, I will do that' }))

    expect(await screen.findByText('That has already been answered.')).toBeInTheDocument()
    // Still answerable: a failed send must not swallow the question.
    expect(screen.getByRole('button', { name: 'Yes, I will do that' })).toBeInTheDocument()
  })

  it('stays quiet rather than shouting when the list cannot be fetched', async () => {
    api.get.mockRejectedValue(new Error('offline'))
    const { container } = render(<KeyholderAsk />)
    await waitFor(() => expect(api.get).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })
})
