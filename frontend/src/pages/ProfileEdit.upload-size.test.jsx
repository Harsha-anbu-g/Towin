// Both upload paths on the profile page — the photo and the ID document — used
// to send whatever was picked. Spring's multipart limit is 5MB, so a bigger file
// came back as a raw 500 with nothing the user could act on.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ProfileEdit from './ProfileEdit'
import { MAX_UPLOAD_BYTES } from '../lib/uploads'

vi.mock('../api/axios', () => ({
  default: { get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))

vi.mock('../context/useAuth', () => ({
  useAuth: () => ({ user: { role: 'ELDER', name: 'Margaret' }, logout: vi.fn() }),
}))

// NavBar pulls theme/toast/polling machinery — not under test here.
vi.mock('../components/NavBar', () => ({ default: () => <nav /> }))

import api from '../api/axios'

const profile = {
  name: 'Margaret',
  username: 'margaret',
  age: 73,
  verificationStatus: 'NONE',
  interests: [],
  languages: [],
  skillsOffered: [],
  hobbies: [],
}

const sizedFile = (bytes, name, type) => {
  const file = new File(['x'], name, { type })
  Object.defineProperty(file, 'size', { value: bytes })
  return file
}

const renderPage = async () => {
  const view = render(<MemoryRouter><ProfileEdit /></MemoryRouter>)
  await screen.findByRole('heading', { name: /margaret/i })
  return view
}

describe('ProfileEdit upload size check', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.get.mockImplementation((url) =>
      url === '/profile/me' ? Promise.resolve({ data: profile }) : Promise.resolve({ data: [] }))
    api.put.mockResolvedValue({ data: { photoUrl: '/x.jpg' } })
    api.post.mockResolvedValue({ data: {} })
    // jsdom has no object URLs; the happy path asks for one.
    URL.createObjectURL = vi.fn(() => 'blob:preview')
    URL.revokeObjectURL = vi.fn()
  })

  it('refuses a photo over 5 MB and says so in plain words', async () => {
    const { container } = await renderPage()
    const input = container.querySelector('#photo-upload')

    fireEvent.change(input, { target: { files: [sizedFile(MAX_UPLOAD_BYTES + 1, 'big.jpg', 'image/jpeg')] } })

    expect(await screen.findByText(/larger than 5 MB/i)).toBeInTheDocument()
    // Nothing to upload, so no Upload button and no request.
    expect(screen.queryByRole('button', { name: /^upload$/i })).not.toBeInTheDocument()
    expect(api.put).not.toHaveBeenCalled()
  })

  it('accepts a photo within the limit', async () => {
    const { container } = await renderPage()
    const input = container.querySelector('#photo-upload')

    fireEvent.change(input, { target: { files: [sizedFile(1024, 'small.jpg', 'image/jpeg')] } })

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^upload$/i })).toBeInTheDocument())
    expect(screen.queryByText(/larger than 5 MB/i)).not.toBeInTheDocument()
  })

  it('refuses an ID document over 5 MB', async () => {
    const { container } = await renderPage()
    const input = container.querySelector('input[accept="image/*,.pdf"]')

    fireEvent.change(input, { target: { files: [sizedFile(MAX_UPLOAD_BYTES + 1, 'big.pdf', 'application/pdf')] } })

    expect(await screen.findByText(/larger than 5 MB/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^upload$/i })).not.toBeInTheDocument()
    expect(api.post).not.toHaveBeenCalled()
  })
})
