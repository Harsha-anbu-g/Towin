// One reunion's page, by seat and step: the elder at "Who plans" sees the
// people allowed; the organiser at "Finding" gets the list tools and never the
// elder's approve button; the elder's approve button appears only once
// someone is coming, and says why until then.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ReunionDetail from './ReunionDetail'

vi.mock('../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))
vi.mock('../context/useAuth', () => ({
  useAuth: () => ({ user: { role: 'ELDER', userId: 'e1' } }),
}))
vi.mock('../context/useToast', () => ({
  useToast: () => ({ toast: { success: vi.fn(), error: vi.fn() } }),
}))
vi.mock('../components/NavBar', () => ({ default: () => <nav /> }))

import api from '../api/axios'

const base = {
  id: 'r1', elderId: 'e1', elderName: 'Margaret',
  institution: 'B.Sc. batch, Presidency College', years: '1968 to 1971', city: 'Madras',
  guests: [], guestCount: 0, comingCount: 0, arrivedCount: 0, homeCount: 0,
}

const serve = (reunion, organisers = []) => {
  api.get.mockImplementation((url) =>
    Promise.resolve({ data: url.endsWith('/organisers') ? organisers : reunion })
  )
}

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/reunion/r1']}>
      <Routes>
        <Route path="/reunion/:reunionId" element={<ReunionDetail />} />
      </Routes>
    </MemoryRouter>
  )

beforeEach(() => vi.clearAllMocks())

describe('ReunionDetail', () => {
  it('the elder at Who plans sees the people allowed and why', async () => {
    serve({ ...base, step: 'ORGANISER', myRole: 'ELDER' }, [
      { userId: 'h1', name: 'Priya', kind: 'HELPER' },
      { userId: 'f1', name: 'Sarah', kind: 'FAMILY', relationship: 'Daughter' },
    ])
    renderPage()
    expect(await screen.findByText('Step 2 of 7 · Who plans')).toBeInTheDocument()
    expect(await screen.findByText('Priya')).toBeInTheDocument()
    expect(screen.getByText('Helper you fully trust')).toBeInTheDocument()
    expect(screen.getByText('Daughter')).toBeInTheDocument()
    expect(screen.queryByText('Approve the guest list')).not.toBeInTheDocument()
  })

  it('the organiser at Finding gets the list tools and never the approve button', async () => {
    serve({
      ...base, step: 'FINDING', myRole: 'ORGANISER', organiserId: 'h1', organiserName: 'Priya',
      guests: [{ id: 'g1', name: 'Kumar', state: 'REMEMBERED' }], guestCount: 1,
    })
    renderPage()
    expect(await screen.findByText('Kumar')).toBeInTheDocument()
    expect(screen.getByText('For Margaret')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add to the list' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Found' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Step down from planning' })).toBeInTheDocument()
    expect(screen.queryByText('Approve the guest list')).not.toBeInTheDocument()
    expect(screen.queryByText('Stop this reunion')).not.toBeInTheDocument()
  })

  it('the elder at Finding sees approve only once someone is coming, with the reason until then', async () => {
    serve({
      ...base, step: 'FINDING', myRole: 'ELDER', organiserName: 'Priya',
      guests: [{ id: 'g1', name: 'Kumar', state: 'REACHED' }], guestCount: 1, comingCount: 0,
    })
    renderPage()
    const approve = await screen.findByRole('button', { name: 'Approve the guest list' })
    expect(approve).toBeDisabled()
    expect(screen.getByText('At least one guest needs to be coming before the plan.')).toBeInTheDocument()
    expect(screen.getByText('Priya is planning it')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add to the list' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Stop this reunion' })).toBeInTheDocument()
  })

  it('done reads as a story: who came, everyone home', async () => {
    serve({ ...base, step: 'DONE', myRole: 'ELDER', thankYou: 'Thank you all for coming', arrivedCount: 4, homeCount: 4 })
    renderPage()
    expect(await screen.findByText('4 came, and every one of them got home.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Keep the story in your box/ })).toBeInTheDocument()
    expect(screen.queryByText('Stop this reunion')).not.toBeInTheDocument()
  })
})
