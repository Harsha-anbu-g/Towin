// The saved copy, as a screen.
//
// The content itself is tested in components/passOnSheet.test.js; this file is about the one
// thing only the page can get wrong — that what she is shown and what lands in her downloads
// folder are the same document, and that neither can ever contain a word of what is in her box.
//
// Both are asserted against a payload carrying sealed bodies anyway. The server cannot send one
// (SealedItemSummary has no body field), so this is the second line of defence: the screen must
// have no branch that could render it, and the file no line that could carry it, even if a
// future server mistake handed it over.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import PassOnSheet from './PassOnSheet'

vi.mock('../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

vi.mock('../context/useToast', () => ({
  useToast: () => ({ toast: { success: vi.fn(), error: vi.fn() } }),
}))

// NavBar drags in theme/toast/api/polling machinery — not under test here.
vi.mock('../components/NavBar', () => ({ default: () => <nav /> }))

import api from '../api/axios'

const THE_SECRET = 'Account 4471 at the credit union on Rue Principale'

const payload = (over = {}) => ({
  ownerName: 'Margaret',
  preparedAt: '2026-08-05T10:00:00',
  armed: true,
  approvalsNeeded: 2,
  keyholderTarget: 3,
  items: [
    // A body it must never use, sent on purpose. See the note at the top of this file.
    { id: 'i1', label: 'Where the money is', kindHint: 'MONEY', body: THE_SECRET },
    { id: 'i2', label: 'The house papers', kindHint: 'PAPERS' },
  ],
  keyholders: [
    { id: 'k1', personName: 'Sarah', status: 'ACTIVE', respondedAt: '2026-06-02T09:00:00' },
    { id: 'k2', personName: 'David', status: 'INVITED', respondedAt: null },
  ],
  lastSavedAt: null,
  ...over,
})

const mockSheet = (data = payload()) => {
  api.get.mockImplementation((url) => {
    if (url === '/passon/sheet') return Promise.resolve({ data })
    return Promise.resolve({ data: {} })
  })
  api.post.mockResolvedValue({ data: {} })
}

const renderPage = () => render(<MemoryRouter><PassOnSheet /></MemoryRouter>)

/** Captures whatever the page hands the browser to save, so the file itself can be read back. */
let savedBlobs
let clickedAnchors

beforeEach(() => {
  vi.clearAllMocks()
  savedBlobs = []
  clickedAnchors = []

  globalThis.URL.createObjectURL = vi.fn((blob) => {
    savedBlobs.push(blob)
    return 'blob:the-copy'
  })
  globalThis.URL.revokeObjectURL = vi.fn()

  // The anchor is created and clicked rather than rendered, so the click is intercepted here.
  const realClick = HTMLAnchorElement.prototype.click
  HTMLAnchorElement.prototype.click = function intercepted() {
    clickedAnchors.push({ href: this.href, download: this.download })
  }
  HTMLAnchorElement.prototype.click.restore = realClick
})

afterEach(() => {
  HTMLAnchorElement.prototype.click = HTMLAnchorElement.prototype.click.restore
})

const savedText = () => savedBlobs[savedBlobs.length - 1].text()

describe('the saved one-page copy', () => {
  it('shows her the copy before she saves it', async () => {
    mockSheet()
    renderPage()

    expect(await screen.findByText('What Margaret passes on')).toBeInTheDocument()
    expect(screen.getByText(/Where the money is/)).toBeInTheDocument()
    expect(screen.getByText(/The house papers/)).toBeInTheDocument()
    expect(screen.getByText('2 of the 3 must agree.')).toBeInTheDocument()
    expect(screen.getByText('Sarah said yes on 2 June')).toBeInTheDocument()
    expect(screen.getByText('David has not answered yet')).toBeInTheDocument()
    expect(screen.getByText('This is not a will.')).toBeInTheDocument()
  })

  it('never shows a word of what is in the box', async () => {
    mockSheet()
    renderPage()

    await screen.findByText('What Margaret passes on')
    expect(screen.queryByText(new RegExp('4471'))).not.toBeInTheDocument()
    expect(screen.queryByText(/credit union/)).not.toBeInTheDocument()
  })

  it('says who to write to and what they will be asked for', async () => {
    mockSheet()
    renderPage()

    expect(await screen.findByText(/Write to Towinly at support@towinly.example\./))
      .toBeInTheDocument()
    expect(screen.getByText(/a death certificate/)).toBeInTheDocument()
    expect(screen.getByText(/no button anywhere that opens the box/)).toBeInTheDocument()
  })

  it('saves a file carrying the names and never the contents', async () => {
    mockSheet()
    renderPage()
    await screen.findByText('What Margaret passes on')

    await userEvent.click(screen.getByRole('button', { name: 'Save this to my computer' }))

    await waitFor(() => expect(savedBlobs).toHaveLength(1))
    const text = await savedText()
    expect(text).toContain('What Margaret passes on')
    expect(text).toContain('Where the money is — Money')
    expect(text).toContain('Sarah said yes on 2 June')
    expect(text).toContain('This is not a will.')
    expect(text).not.toContain('4471')
    expect(text).not.toContain('credit union')
  })

  it('gives the file a name she could find again', async () => {
    mockSheet()
    renderPage()
    await screen.findByText('What Margaret passes on')

    await userEvent.click(screen.getByRole('button', { name: 'Save this to my computer' }))

    await waitFor(() => expect(clickedAnchors).toHaveLength(1))
    expect(clickedAnchors[0].download).toBe('Towinly - what Margaret passes on.txt')
  })

  it('tells her plainly that she has never taken a copy out', async () => {
    mockSheet()
    renderPage()

    expect(await screen.findByText('You have not saved a copy yet.')).toBeInTheDocument()
  })

  it('says when she last took one out', async () => {
    mockSheet(payload({ lastSavedAt: '2026-08-02T09:30:00' }))
    renderPage()

    expect(await screen.findByText('You last saved a copy on 2 August 2026.')).toBeInTheDocument()
  })

  // Without this the page would go on saying "you have not saved a copy yet" to somebody who
  // just did, which teaches her to ignore the one line on the page that matters.
  it('records that she took a copy out', async () => {
    mockSheet()
    renderPage()
    await screen.findByText('What Margaret passes on')

    await userEvent.click(screen.getByRole('button', { name: 'Save this to my computer' }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/passon/sheet/saved'))
  })

  it('says so plainly when it cannot get her copy ready', async () => {
    api.get.mockRejectedValue(new Error('offline'))
    renderPage()

    expect(await screen.findByText('We could not get your copy ready. Please try again.'))
      .toBeInTheDocument()
  })

  // An empty box and nobody asked is the ordinary state of somebody who has just started, and
  // the page has to read as a page rather than as a broken one.
  it('reads honestly with nothing in the box and nobody asked', async () => {
    mockSheet(payload({
      items: [], keyholders: [], armed: false, approvalsNeeded: null, keyholderTarget: null,
    }))
    renderPage()

    expect(await screen.findByText('There is nothing in the box yet.')).toBeInTheDocument()
    expect(screen.getByText('Nobody has been asked yet.')).toBeInTheDocument()
    expect(screen.queryByText(/must agree/)).not.toBeInTheDocument()
  })

  // Digital only. The design decision is explicit: there is no print step anywhere in this
  // feature, so there is no print control on the one page somebody would expect one.
  it('offers no way to print it', async () => {
    mockSheet()
    renderPage()
    await screen.findByText('What Margaret passes on')

    expect(screen.queryByRole('button', { name: /print/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/print/i)).not.toBeInTheDocument()
  })
})
