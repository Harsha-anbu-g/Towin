// US-013: Trust page family line — "Family connected +N of 5" for elders only.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Trust from './Trust'

vi.mock('../api/axios', () => ({
  default: { get: vi.fn() },
}))

const authState = { user: { role: 'ELDER', name: 'Margaret' } }
vi.mock('../context/useAuth', () => ({
  useAuth: () => authState,
}))

// NavBar pulls theme/toast/api/polling machinery — not under test here.
vi.mock('../components/NavBar', () => ({ default: () => <nav /> }))

import api from '../api/axios'

const breakdown = (family) => ({
  totalScore: 12,
  tier: 'Getting Started',
  maxPerCustomer: 15,
  profile: { earned: 1, max: 3, groups: [] },
  customers: [],
  family,
})

const renderPage = () => render(<MemoryRouter><Trust /></MemoryRouter>)

describe('Trust — family line (US-013)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows the Family connected line with +N of 5 for an elder', async () => {
    authState.user = { role: 'ELDER', name: 'Margaret' }
    api.get.mockResolvedValue({ data: breakdown({ earned: 2, max: 5 }) })
    renderPage()
    expect(await screen.findByText('Family connected')).toBeInTheDocument()
    expect(screen.getByLabelText('+2 of 5')).toBeInTheDocument()
  })

  it('shows +0 of 5 when the elder has no accepted family members yet', async () => {
    authState.user = { role: 'ELDER', name: 'Margaret' }
    api.get.mockResolvedValue({ data: breakdown({ earned: 0, max: 5 }) })
    renderPage()
    expect(await screen.findByText('Family connected')).toBeInTheDocument()
    expect(screen.getByLabelText('+0 of 5')).toBeInTheDocument()
  })

  it('shows no family line when the breakdown has no family component (non-elders)', async () => {
    authState.user = { role: 'HELPER', name: 'Arun' }
    api.get.mockResolvedValue({ data: breakdown(null) })
    renderPage()
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/trust/my-score'))
    // Wait for the loaded state, then assert the line is absent.
    expect(await screen.findByText('Your profile')).toBeInTheDocument()
    expect(screen.queryByText('Family connected')).not.toBeInTheDocument()
  })
})
