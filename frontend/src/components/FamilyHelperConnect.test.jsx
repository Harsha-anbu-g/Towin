import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import FamilyHelperConnect from './FamilyHelperConnect'

vi.mock('../api/axios', () => ({ default: { post: vi.fn() } }))
vi.mock('../context/useToast', () => ({
  useToast: () => ({ toast: { success: vi.fn(), error: vi.fn() } }),
}))
import api from '../api/axios'

const helper = (over = {}) => ({
  connectionId: 'conn-1',
  helperName: 'Tom Walker',
  stageIndex: 5,
  ...over,
})

describe('FamilyHelperConnect (Step 4)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('stays hidden before the friendship reaches Ready to Meet', () => {
    const { container } = render(<FamilyHelperConnect helper={helper({ stageIndex: 4 })} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('offers the connect button at Ready to Meet with no existing connection', () => {
    render(<FamilyHelperConnect helper={helper()} />)
    expect(screen.getByRole('button', { name: /connect with tom/i })).toBeInTheDocument()
    expect(screen.getByText(/your parent always sees/i)).toBeInTheDocument()
  })

  it('shows the waiting state while the helper decides', () => {
    render(<FamilyHelperConnect helper={helper()} myConnection={{ status: 'PENDING' }} />)
    expect(screen.getByText(/waiting for tom to say yes/i)).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('shows the connected state once accepted', () => {
    render(<FamilyHelperConnect helper={helper()} myConnection={{ status: 'ACTIVE' }} />)
    expect(screen.getByText(/you and tom are connected/i)).toBeInTheDocument()
  })

  it('stays quiet after a decline — no pressure on the helper', () => {
    const { container } = render(
      <FamilyHelperConnect helper={helper()} myConnection={{ status: 'DECLINED' }} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('sends the request through the family endpoint', async () => {
    api.post.mockResolvedValueOnce({ data: {} })
    const onChanged = vi.fn()
    render(<FamilyHelperConnect helper={helper()} onChanged={onChanged} />)

    fireEvent.click(screen.getByRole('button', { name: /connect with tom/i }))

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/family/helper-connections', { connectionId: 'conn-1' })
    )
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
  })
})
