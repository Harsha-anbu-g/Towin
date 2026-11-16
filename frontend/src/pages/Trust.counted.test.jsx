// Trust tiers step 1: a friendship adds points once the elder has ended a help
// between the two. The server sends `counted` on each card of
// GET /trust/my-score; while it is false every point on the card is 0. The
// page then shows one plain line instead of a row of empty meters, a one-time
// note explains the rule, and "helped you reach this" counts only the
// friendships that add points.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Trust from './Trust'

vi.mock('../api/axios', () => ({ default: { get: vi.fn() } }))
vi.mock('../context/useAuth', () => ({ useAuth: () => ({ user: { role: 'HELPER', name: 'Arun' } }) }))
vi.mock('../components/NavBar', () => ({ default: () => <nav /> }))

import api from '../api/axios'

const LINE = 'Counts after a help is finished'
const NOTE_TITLE = 'Points count after a help is finished'
const NOTE_KEY = 'towinly_trust_rule_explained'

const counted = {
  connectionId: 'c1', customerName: 'Margaret Hill', customerPhotoUrl: null,
  currentStageLabel: 'Video call', stageIndex: 3, counted: true,
  total: 7, totalMax: 15, rooting: 4, rootingMax: 7, review: 0, reviewMax: 5, hasReview: false,
  profile: 3, profileMax: 3, family: 0, familyMax: 0,
}
const waiting = {
  ...counted, connectionId: 'c2', customerName: 'David Stone', counted: false,
  total: 0, rooting: 0, profile: 0,
}

const page = (customers) => {
  api.get.mockResolvedValue({
    data: { totalScore: 7, tier: 'Getting Started', profile: { earned: 3, max: 3, groups: [] }, family: null, customers },
  })
  return render(<MemoryRouter><Trust /></MemoryRouter>)
}

describe('Trust: points count after a help is finished', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('shows one line, not empty meters, for a friendship with no finished help', async () => {
    page([waiting])
    expect(await screen.findByText('David Stone')).toBeInTheDocument()
    expect(screen.getByText(LINE)).toBeInTheDocument()
    expect(screen.getByText('Video call')).toBeInTheDocument()
    expect(screen.queryByText('Trust stages')).not.toBeInTheDocument()
    expect(screen.queryByText('Their review')).not.toBeInTheDocument()
  })

  it('keeps the meters for a friendship with a finished help', async () => {
    page([counted])
    expect(await screen.findByText('Margaret Hill')).toBeInTheDocument()
    expect(screen.getByText('Trust stages')).toBeInTheDocument()
    expect(screen.queryByText(LINE)).not.toBeInTheDocument()
  })

  it('counts only friendships that add points as "helped you reach this"', async () => {
    page([counted, waiting])
    expect(await screen.findByText('1 person helped you reach this')).toBeInTheDocument()
  })

  it('says nobody helped while no friendship counts yet', async () => {
    page([waiting])
    expect(await screen.findByText('David Stone')).toBeInTheDocument()
    expect(screen.queryByText(/helped you reach this/)).not.toBeInTheDocument()
  })

  it('shows the note once, and "Got it" puts it away for good', async () => {
    const first = page([counted, waiting])
    expect(await screen.findByText(NOTE_TITLE)).toBeInTheDocument()
    expect(screen.getByText(
      'A friendship adds to your score once a help between you two is finished. If your score went down, this is why.'
    )).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
    expect(screen.queryByText(NOTE_TITLE)).not.toBeInTheDocument()
    expect(localStorage.getItem(NOTE_KEY)).toBe('true')
    first.unmount()

    page([counted, waiting])
    expect(await screen.findByText('David Stone')).toBeInTheDocument()
    expect(screen.queryByText(NOTE_TITLE)).not.toBeInTheDocument()
  })

  it('changes nothing for an older server that sends no `counted`', async () => {
    const { counted: _dropped, ...oldCard } = counted
    page([oldCard])
    expect(await screen.findByText('Margaret Hill')).toBeInTheDocument()
    expect(screen.getByText('Trust stages')).toBeInTheDocument()
    expect(screen.getByText('1 person helped you reach this')).toBeInTheDocument()
    expect(screen.queryByText(LINE)).not.toBeInTheDocument()
    expect(screen.queryByText(NOTE_TITLE)).not.toBeInTheDocument()
  })

  it('tells someone with no friends that points come after a finished help', async () => {
    page([])
    expect(await screen.findByText(
      'Connect with your first elder. Once a help between you is finished, you earn points here.'
    )).toBeInTheDocument()
  })
})
