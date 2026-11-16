// The one-time "points count after a help is finished" note, as the dashboards
// mount it: no cards handed in, so it loads the score itself, and only while
// it has not been dismissed.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import TrustRuleNote from './TrustRuleNote'

vi.mock('../api/axios', () => ({ default: { get: vi.fn() } }))
import api from '../api/axios'

const TITLE = 'Points count after a help is finished'
const KEY = 'towinly_trust_rule_explained'
const score = (customers) => api.get.mockResolvedValue({ data: { customers } })

describe('TrustRuleNote on a dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('loads the score and shows the note, with a way to the score page', async () => {
    score([{ connectionId: 'c1', counted: false }])
    const onSeeScore = vi.fn()
    render(<TrustRuleNote onSeeScore={onSeeScore} />)
    expect(await screen.findByText(TITLE)).toBeInTheDocument()
    expect(api.get).toHaveBeenCalledWith('/trust/my-score')
    fireEvent.click(screen.getByRole('button', { name: 'See your score' }))
    expect(onSeeScore).toHaveBeenCalledTimes(1)
  })

  it('"Got it" puts it away and the next visit does not load the score for it', async () => {
    score([{ connectionId: 'c1', counted: true }])
    const first = render(<TrustRuleNote />)
    fireEvent.click(await screen.findByRole('button', { name: 'Got it' }))
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument()
    expect(localStorage.getItem(KEY)).toBe('true')
    first.unmount()

    api.get.mockClear()
    render(<TrustRuleNote />)
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument()
    expect(api.get).not.toHaveBeenCalled()
  })

  it('stays away for an older server, for no friends, and when the load fails', async () => {
    score([{ connectionId: 'c1' }])
    const old = render(<TrustRuleNote />)
    await waitFor(() => expect(api.get).toHaveBeenCalled())
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument()
    old.unmount()

    api.get.mockRejectedValue(new Error('offline'))
    render(<TrustRuleNote />)
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2))
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument()
  })

  it('uses the cards a page already has and does not load them again', () => {
    render(<TrustRuleNote customers={[{ connectionId: 'c1', counted: false }]} />)
    expect(screen.getByText(TITLE)).toBeInTheDocument()
    expect(api.get).not.toHaveBeenCalled()
  })
})
