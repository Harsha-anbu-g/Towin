// The Reunion list page: an elder's wish goes to the server and opens the new
// reunion; a helper with nothing to plan reads why the page is empty.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Reunion from './Reunion'

vi.mock('../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))
const auth = { user: { role: 'ELDER', userId: 'e1' } }
vi.mock('../context/useAuth', () => ({ useAuth: () => auth }))
vi.mock('../context/useToast', () => ({ useToast: () => ({ toast: { success: vi.fn(), error: vi.fn() } }) }))
vi.mock('../components/NavBar', () => ({ default: () => <nav /> }))

import api from '../api/axios'

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/reunion']}>
      <Routes>
        <Route path="/reunion" element={<Reunion />} />
        <Route path="/reunion/:reunionId" element={<p>the reunion page</p>} />
      </Routes>
    </MemoryRouter>
  )

beforeEach(() => {
  vi.clearAllMocks()
  auth.user = { role: 'ELDER', userId: 'e1' }
})

describe('Reunion', () => {
  it('an elder makes a wish and lands on the new reunion', async () => {
    api.get.mockResolvedValue({ data: [] })
    api.post.mockResolvedValue({ data: { id: 'r9', step: 'ORGANISER' } })
    renderPage()
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText('Who do you want to see again?'), 'B.Sc. batch, Presidency College')
    await user.type(screen.getByLabelText('Which years?'), '1968 to 1971')
    await user.click(screen.getByRole('button', { name: 'Make the wish' }))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/reunions', {
      institution: 'B.Sc. batch, Presidency College', years: '1968 to 1971', city: '', note: '',
    }))
    expect(await screen.findByText('the reunion page')).toBeInTheDocument()
  })

  it('an empty institution is refused before anything is sent', async () => {
    api.get.mockResolvedValue({ data: [] })
    renderPage()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Make the wish' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Say which batch, class or office it was.')
    expect(api.post).not.toHaveBeenCalled()
  })

  it('a helper with nothing to plan reads why the page is empty', async () => {
    auth.user = { role: 'HELPER', userId: 'h1' }
    api.get.mockResolvedValue({ data: [] })
    renderPage()
    expect(await screen.findByText('When someone asks you to plan their reunion, it shows here.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Make the wish' })).not.toBeInTheDocument()
  })

  it('lists reunions with their step and guest line', async () => {
    api.get.mockResolvedValue({ data: [{ id: 'r1', institution: 'Office batch', step: 'FINDING', guestCount: 6, comingCount: 3 }] })
    renderPage()
    expect(await screen.findByText('Office batch')).toBeInTheDocument()
    expect(screen.getByText('Step 3 of 7 · Finding')).toBeInTheDocument()
    expect(screen.getByText('6 remembered · 3 coming')).toBeInTheDocument()
  })
})
