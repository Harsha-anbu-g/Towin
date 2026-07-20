// US-011: Share switch on the elder connection card — elder-only toggle that
// flips per-connection family visibility via POST /connections/{id}/family-visibility.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FamilyShareToggle from './FamilyShareToggle'

vi.mock('../api/axios', () => ({
  default: { post: vi.fn() },
}))

const toastError = vi.fn()
vi.mock('../context/useToast', () => ({
  useToast: () => ({ toast: { success: vi.fn(), error: toastError } }),
}))

import api from '../api/axios'

describe('FamilyShareToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.post.mockResolvedValue({ data: {} })
  })

  it('defaults to off and says the friendship is kept private', () => {
    render(<FamilyShareToggle connectionId="c1" />)
    const sw = screen.getByRole('switch', { name: /let my family see this friendship/i })
    expect(sw).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByText(/kept private from family/i)).toBeInTheDocument()
  })

  it('renders on when the connection is already shared', () => {
    render(<FamilyShareToggle connectionId="c1" shared />)
    const sw = screen.getByRole('switch', { name: /let my family see this friendship/i })
    expect(sw).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText(/your family can watch how this friendship is going/i)).toBeInTheDocument()
  })

  it('turning it on calls the family-visibility endpoint with shared=true', async () => {
    const user = userEvent.setup()
    render(<FamilyShareToggle connectionId="c1" />)
    await user.click(screen.getByRole('switch'))
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/connections/c1/family-visibility', { shared: true }),
    )
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText(/your family can watch how this friendship is going/i)).toBeInTheDocument()
  })

  it('turning it off calls the endpoint with shared=false', async () => {
    const user = userEvent.setup()
    render(<FamilyShareToggle connectionId="c1" shared />)
    await user.click(screen.getByRole('switch'))
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/connections/c1/family-visibility', { shared: false }),
    )
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
  })

  it('rolls back and explains when saving fails', async () => {
    api.post.mockRejectedValueOnce(new Error('boom'))
    const user = userEvent.setup()
    render(<FamilyShareToggle connectionId="c1" />)
    await user.click(screen.getByRole('switch'))
    await waitFor(() =>
      expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false'),
    )
    expect(toastError).toHaveBeenCalled()
    expect(screen.getByText(/kept private from family/i)).toBeInTheDocument()
  })
})
