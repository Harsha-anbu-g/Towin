// Deleting an account from the admin console runs the same purge as "delete my account",
// so it can destroy stories, letters and a Sealed box that the users table never shows.
// Every test here is about the admin being told that before they press it, and about the
// warning never failing quietly.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DeleteUserButton from './DeleteUserButton'

vi.mock('../api/axios', () => ({
  default: { get: vi.fn(), delete: vi.fn() },
}))

import api from '../api/axios'

const WARNING = {
  stories: 3,
  letters: 2,
  sealedItems: 4,
  keyholders: 2,
  summary: 'Deleting this account also deletes 3 stories, 2 letters and 4 things in a Sealed box. None of it can be brought back.',
  keyholderNote: '2 people hold a key to that Sealed box. Nobody is told when it goes.',
}

describe('DeleteUserButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.get.mockResolvedValue({ data: WARNING })
    api.delete.mockResolvedValue({})
  })

  it('asks nothing and deletes nothing until it is pressed', () => {
    render(<DeleteUserButton userId="u1" />)
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    expect(api.get).not.toHaveBeenCalled()
    expect(api.delete).not.toHaveBeenCalled()
  })

  it('says what would be lost before asking the question', async () => {
    const user = userEvent.setup()
    render(<DeleteUserButton userId="u1" />)
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/admin/users/u1/delete-preview'))
    expect(await screen.findByText(/3 stories, 2 letters and 4 things in a Sealed box/)).toBeInTheDocument()
    expect(screen.getByText(/2 people hold a key/)).toBeInTheDocument()
    // Still nothing destroyed.
    expect(api.delete).not.toHaveBeenCalled()
  })

  it('leaves the key sentence out when the server did not send one', async () => {
    const user = userEvent.setup()
    api.get.mockResolvedValue({ data: { summary: 'Deleting this account cannot be undone.' } })
    render(<DeleteUserButton userId="u1" />)
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(await screen.findByText('Deleting this account cannot be undone.')).toBeInTheDocument()
    expect(screen.queryByText(/hold a key/)).not.toBeInTheDocument()
  })

  it('deletes only after the confirmation, and tells the page it happened', async () => {
    const user = userEvent.setup()
    const onDeleted = vi.fn()
    render(<DeleteUserButton userId="u1" onDeleted={onDeleted} />)
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await screen.findByText(/3 stories/)

    await user.click(screen.getByRole('button', { name: 'Delete account' }))

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/admin/users/u1'))
    await waitFor(() => expect(onDeleted).toHaveBeenCalled())
  })

  it('backing out destroys nothing', async () => {
    const user = userEvent.setup()
    render(<DeleteUserButton userId="u1" />)
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await screen.findByText(/3 stories/)

    await user.click(screen.getByRole('button', { name: 'Keep' }))

    expect(api.delete).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('says plainly that it could not look, rather than showing an empty warning', async () => {
    const user = userEvent.setup()
    api.get.mockRejectedValue(new Error('offline'))
    render(<DeleteUserButton userId="u1" />)
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(await screen.findByText(/could not check what this account holds/i)).toBeInTheDocument()
  })

  it('says nothing was removed when the delete itself fails', async () => {
    const user = userEvent.setup()
    api.delete.mockRejectedValue(new Error('boom'))
    const onDeleted = vi.fn()
    render(<DeleteUserButton userId="u1" onDeleted={onDeleted} />)
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await screen.findByText(/3 stories/)

    await user.click(screen.getByRole('button', { name: 'Delete account' }))

    expect(await screen.findByText('That account could not be deleted. Nothing was removed.')).toBeInTheDocument()
    expect(onDeleted).not.toHaveBeenCalled()
  })
})
