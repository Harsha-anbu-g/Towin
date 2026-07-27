import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import FamilyHelperConnect from './FamilyHelperConnect'

const navigate = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }))
vi.mock('../api/axios', () => ({ default: { post: vi.fn() } }))
vi.mock('../context/useToast', () => ({
  useToast: () => ({ toast: { success: vi.fn(), error: vi.fn() } }),
}))
import api from '../api/axios'

const helper = (over = {}) => ({
  connectionId: 'conn-1',
  helperName: 'Harsha',
  stageIndex: 5,
  ...over,
})

const standing = (over = {}) => ({
  standingConnectionId: 'conn-1',
  helperUserId: 'helper-1',
  paused: false,
  chatConnectionId: null,
  ...over,
})

describe('FamilyHelperConnect (trust inheritance)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('explains what unlocks family chat below Messaging', () => {
    render(<FamilyHelperConnect helper={helper({ stageIndex: 0 })} elderName="Margaret" />)
    expect(screen.getByText(/family chat opens when margaret and harsha reach messaging/i)).toBeInTheDocument()
  })

  it('offers Message directly when the standing is active — no request step', () => {
    render(<FamilyHelperConnect helper={helper()} standing={standing()} elderName="Margaret" />)
    expect(screen.getByRole('button', { name: /message harsha/i })).toBeInTheDocument()
    expect(screen.getByText(/you hold margaret('|’)s trust with harsha/i)).toBeInTheDocument()
  })

  it('opens the chat through the standings endpoint and navigates to it', async () => {
    api.post.mockResolvedValueOnce({ data: 'chat-9' })
    render(<FamilyHelperConnect helper={helper()} standing={standing()} elderName="Margaret" />)

    fireEvent.click(screen.getByRole('button', { name: /message harsha/i }))

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/family/standings/conn-1/chat')
    )
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/messages/chat-9'))
  })

  it('goes straight to an already-open chat without another call', () => {
    render(<FamilyHelperConnect helper={helper()} standing={standing({ chatConnectionId: 'chat-7' })} elderName="Margaret" />)

    fireEvent.click(screen.getByRole('button', { name: /message harsha/i }))

    expect(api.post).not.toHaveBeenCalled()
    expect(navigate).toHaveBeenCalledWith('/messages/chat-7')
  })

  it('shows the paused state with a Resume button', async () => {
    api.post.mockResolvedValueOnce({})
    render(<FamilyHelperConnect helper={helper()} standing={standing({ paused: true })} elderName="Margaret" />)

    expect(screen.getByText(/you paused this chat/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /resume/i }))

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/family/standings/conn-1/resume')
    )
  })

  it('keeps Pause, Remove and the fine print behind Manage, so Message leads', () => {
    render(<FamilyHelperConnect helper={helper()} standing={standing()} elderName="Margaret" />)

    expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
    expect(screen.queryByText(/if margaret stops sharing this friendship/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /manage this chat/i }))

    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument()
    expect(screen.getByText(/if margaret stops sharing this friendship/i)).toBeInTheDocument()
  })

  it('revokes through the standings endpoint after the person confirms', async () => {
    api.post.mockResolvedValueOnce({})
    const onChanged = vi.fn()
    render(<FamilyHelperConnect helper={helper()} standing={standing()} elderName="Margaret" onChanged={onChanged} />)

    fireEvent.click(screen.getByRole('button', { name: /manage this chat/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))

    // The app's own dialog, not a browser confirm() — losing a chat is worth a
    // clear question with a way back out.
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /yes, remove/i }))

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/family/standings/conn-1/revoke')
    )
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
  })

  it('backs out of Remove without touching the connection', () => {
    render(<FamilyHelperConnect helper={helper()} standing={standing()} elderName="Margaret" />)

    fireEvent.click(screen.getByRole('button', { name: /manage this chat/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    fireEvent.click(screen.getByRole('button', { name: /keep it/i }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(api.post).not.toHaveBeenCalled()
  })

  it('offers to bring back a removed connection once standings have loaded', () => {
    render(<FamilyHelperConnect helper={helper()} standingsLoaded={true} elderName="Margaret" />)
    expect(screen.getByText(/you removed this connection/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /bring it back/i })).toBeInTheDocument()
  })

  it('stays silent (no false "removed") while standings are still loading', () => {
    const { container } = render(
      <FamilyHelperConnect helper={helper()} standingsLoaded={false} elderName="Margaret" />
    )
    expect(screen.queryByText(/you removed this connection/i)).not.toBeInTheDocument()
    expect(container).toBeEmptyDOMElement()
  })
})
