// "From Margaret" — reading somebody else's page.
//
// Two rules are the whole point of this screen and both are asserted here rather
// than trusted: a visitor sees only what the server handed *them*, and nothing
// from the Sealed box ever appears, under any condition. The second is tested
// against a payload that carries sealed content anyway — the screen must have no
// code path that could render it even if a future server mistake sent it.
//
// The copy is asserted word for word. The wording on this page was written for
// somebody who may have just been told a person has died; a paraphrase that reads
// fine to a developer is a different sentence to them.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import PassOnFrom from './PassOnFrom'

vi.mock('../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

vi.mock('../context/useToast', () => ({
  useToast: () => ({ toast: { success: vi.fn(), error: vi.fn() } }),
}))

// NavBar drags in theme/toast/api/polling machinery — not under test here.
vi.mock('../components/NavBar', () => ({ default: () => <nav /> }))

import api from '../api/axios'

const MARGARET = 'aaaaaaaa-0000-0000-0000-00000000e001'
const VISITOR = 'aaaaaaaa-0000-0000-0000-00000000v001'

const story = {
  id: 's1',
  kind: 'STORY',
  title: 'The winter we lost the roof',
  body: 'It came off in the night and we boiled water on the stove for a week.',
  audience: 'FAMILY',
  releaseWhen: 'NOW',
  createdAt: '2026-06-03T10:00:00',
}

const secondStory = {
  id: 's2',
  kind: 'STORY',
  title: 'How I met your grandfather',
  body: 'At a dance hall, and he stood on my foot.',
  audience: 'EVERYONE',
  releaseWhen: 'NOW',
  createdAt: '2026-06-02T10:00:00',
}

const letter = {
  id: 'l1',
  kind: 'LETTER',
  title: 'For you',
  body: 'You were braver than you ever knew.',
  audience: 'PERSON',
  audienceUserId: VISITOR,
  audienceUserName: 'Sarah',
  releaseWhen: 'NOW',
  createdAt: '2026-06-01T10:00:00',
}

const payload = (items = []) => ({ ownerId: MARGARET, ownerName: 'Margaret', items })

const mockGet = (data = payload()) => {
  api.get.mockImplementation((url) => {
    if (url === `/passon/from/${MARGARET}`) return Promise.resolve({ data })
    return Promise.resolve({ data: {} })
  })
}

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={[`/passed-on/${MARGARET}`]}>
      <Routes>
        <Route path="/passed-on/:ownerId" element={<PassOnFrom />} />
      </Routes>
    </MemoryRouter>,
  )

describe('From Margaret — the page itself', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGet()
    api.post.mockResolvedValue({ data: {} })
  })

  it('is named after the person who wrote it', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: 'From Margaret', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('What Margaret chose to share with you.')).toBeInTheDocument()
  })

  it('asks the server for this one page and reads nothing else', async () => {
    renderPage()
    await waitFor(() => expect(api.get).toHaveBeenCalledWith(`/passon/from/${MARGARET}`))
    expect(api.get).toHaveBeenCalledTimes(1)
  })

  it('shows what the server handed this visitor, and says who each letter is from', async () => {
    mockGet(payload([story, letter]))
    renderPage()
    expect(await screen.findByRole('heading', { name: 'The winter we lost the roof' })).toBeInTheDocument()
    expect(screen.getByText(/we boiled water on the stove/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'For you' })).toBeInTheDocument()
    expect(screen.getByText('A letter for you')).toBeInTheDocument()
  })

  it('says so plainly when there is nothing here for this visitor', async () => {
    renderPage()
    expect(await screen.findByText('Margaret has not shared anything with you yet.')).toBeInTheDocument()
  })

  it('never shows anything from the Sealed box, even if the payload carries some', async () => {
    // A deliberately wrong payload. The screen must have no branch that could
    // render sealed content, so that a future server mistake cannot leak it.
    mockGet({
      ...payload([story]),
      sealed: [{ id: 'x1', title: 'Bank details', body: 'The account is at...' }],
      sealedItems: [{ id: 'x2', title: 'Where the papers are', body: 'In the blue tin.' }],
    })
    renderPage()
    await screen.findByRole('heading', { name: 'The winter we lost the roof' })
    expect(screen.queryByText(/bank details/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/where the papers are/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/the account is at/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/in the blue tin/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/sealed/i)).not.toBeInTheDocument()
  })

  it('gives a visitor no way to change or take down what somebody else wrote', async () => {
    mockGet(payload([story, letter]))
    renderPage()
    await screen.findByRole('heading', { name: 'The winter we lost the roof' })
    expect(screen.queryByRole('button', { name: /change/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /take it down/i })).not.toBeInTheDocument()
  })

  it('says plainly when the page cannot be opened, rather than showing an empty one', async () => {
    api.get.mockRejectedValue({ response: { status: 404 } })
    renderPage()
    expect(await screen.findByText('We could not open that page.')).toBeInTheDocument()
  })
})

describe('From Margaret — objecting to a story', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGet(payload([story, secondStory, letter]))
    api.post.mockResolvedValue({ data: {} })
  })

  it('offers a quiet way to object on every story', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'The winter we lost the roof' })
    // One per story. A letter is written to this visitor alone and cannot name a
    // third person to a room, so it does not carry one.
    expect(screen.getAllByRole('button', { name: 'Report this' })).toHaveLength(2)
  })

  it('asks what is wrong before sending anything', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: 'The winter we lost the roof' })
    await user.click(screen.getAllByRole('button', { name: 'Report this' })[0])

    expect(screen.getByLabelText('What is wrong with it?')).toBeInTheDocument()
    expect(screen.getByLabelText('Tell us more (you can skip this)')).toBeInTheDocument()
    expect(api.post).not.toHaveBeenCalled()
  })

  it('sends the report naming the story it is about, not just the person', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: 'The winter we lost the roof' })
    await user.click(screen.getAllByRole('button', { name: 'Report this' })[0])
    await user.selectOptions(screen.getByLabelText('What is wrong with it?'), 'It says something untrue about me')
    await user.type(screen.getByLabelText('Tell us more (you can skip this)'), 'I was not there.')
    await user.click(screen.getByRole('button', { name: 'Send this to Towinly' }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/reports', {
      reportedUserId: MARGARET,
      contentType: 'PASSON_ITEM',
      contentId: 's1',
      reason: 'It says something untrue about me',
      description: 'I was not there.',
    }))
  })

  it('thanks the visitor and closes the form once it is sent', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: 'The winter we lost the roof' })
    await user.click(screen.getAllByRole('button', { name: 'Report this' })[0])
    await user.click(screen.getByRole('button', { name: 'Send this to Towinly' }))

    expect(await screen.findByText('Thank you. Somebody at Towinly will read this.')).toBeInTheDocument()
    expect(screen.queryByLabelText('What is wrong with it?')).not.toBeInTheDocument()
  })

  it('only ever has one form open, so a report cannot be filed against the wrong story', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: 'The winter we lost the roof' })

    // Opening the first story's form takes that story's own button away, so the
    // one button still on the page belongs to the second story.
    await user.click(screen.getAllByRole('button', { name: 'Report this' })[0])
    expect(screen.getAllByRole('button', { name: 'Report this' })).toHaveLength(1)

    // Opening the second one moves the form rather than adding a second.
    await user.click(screen.getByRole('button', { name: 'Report this' }))
    expect(screen.getAllByLabelText('What is wrong with it?')).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Send this to Towinly' }))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(
      '/reports',
      expect.objectContaining({ contentId: 's2' }),
    ))
  })
})
