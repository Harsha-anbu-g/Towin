// "What I pass on" — the elder's own page: the not-a-will primer, three tabs,
// the Story box and the Letters.
//
// The copy is asserted word for word on purpose. Every sentence on this page was
// written and reviewed for an audience being asked to write down the last things
// they know; a paraphrase that reads fine to a developer is a different promise to
// the person reading it. If a test here fails on wording, the wording is the bug.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import PassOn from './PassOn'

vi.mock('../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

vi.mock('../context/useAuth', () => ({
  useAuth: () => ({ user: { role: 'ELDER', name: 'Margaret', username: 'margaret' } }),
}))

vi.mock('../context/useToast', () => ({
  useToast: () => ({ toast: { success: vi.fn(), error: vi.fn() } }),
}))

// NavBar drags in theme/toast/api/polling machinery — not under test here.
vi.mock('../components/NavBar', () => ({ default: () => <nav /> }))

import api from '../api/axios'

const SARAH = 'aaaaaaaa-0000-0000-0000-00000000a001'
const PRIYA = 'aaaaaaaa-0000-0000-0000-00000000a002'

const familyLinks = {
  activeLinks: [
    { id: 'l1', otherUserId: SARAH, otherUserName: 'Sarah', relationship: 'Daughter', status: 'ACTIVE', iAmElder: true },
  ],
  incomingRequests: [],
  outgoingRequests: [],
}

const connections = [
  { id: 'c1', otherUserId: PRIYA, otherUserName: 'Priya', status: 'ACTIVE', currentTrustLevel: 'TRUSTED', type: 'HELPER' },
  // An ended friendship is not somebody you can still write to.
  { id: 'c2', otherUserId: 'gone', otherUserName: 'Gone', status: 'ENDED', currentTrustLevel: 'TRUSTED', type: 'HELPER' },
]

const mine = (stories = [], letters = []) => ({ stories, letters })

const mockGet = (data = mine()) => {
  api.get.mockImplementation((url) => {
    if (url === '/passon/mine') return Promise.resolve({ data })
    if (url === '/family/links') return Promise.resolve({ data: familyLinks })
    if (url === '/connections') return Promise.resolve({ data: connections })
    return Promise.resolve({ data: {} })
  })
}

// Reads the live address bar so the tab-in-the-URL rule can be asserted from
// both directions: what a link opens on, and what a tap writes back.
function LocationProbe() {
  const location = useLocation()
  return <span data-testid="where">{location.pathname + location.search}</span>
}

const renderPage = (entry = '/what-i-pass-on') =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <PassOn />
      <LocationProbe />
    </MemoryRouter>,
  )

const openTab = (user, name) => user.click(screen.getByRole('tab', { name }))

describe('What I pass on — the page itself', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGet()
    api.post.mockResolvedValue({ data: {} })
    api.put.mockResolvedValue({ data: {} })
    api.delete.mockResolvedValue({ data: {} })
  })

  it('names the page and says in one line what it is for', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: 'What I pass on', level: 1 })).toBeInTheDocument()
    expect(screen.getByText(
      'Your stories, your letters, and the things only you know. You choose who sees each one.',
    )).toBeInTheDocument()
  })

  it('says it is not a will, and explains the difference only when asked', async () => {
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByText('This is not a will, and it does not replace one.')).toBeInTheDocument()
    // The explanation stays folded away until she asks for it.
    expect(screen.queryByText(/a will decides who gets your money/i)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /what's the difference\?/i }))
    expect(screen.getByText(/A will decides who gets your money, your home and your things\./)).toBeInTheDocument()
    expect(screen.getByText(/whoever helped you make it that this page exists\./)).toBeInTheDocument()
  })

  it('offers the three parts as tabs, opening on the Story box', async () => {
    renderPage()
    expect(await screen.findByRole('tab', { name: 'Story box' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Letter box' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Sealed box' })).toBeInTheDocument()
  })

  it('keeps the open tab in the address bar, and opens on the tab a link names', async () => {
    const user = userEvent.setup()
    renderPage()
    await openTab(user, 'Letter box')
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/what-i-pass-on?tab=letters'))
  })

  it('opens straight onto the Letter box when the address says so', async () => {
    renderPage('/what-i-pass-on?tab=letters')
    expect(await screen.findByRole('tab', { name: 'Letter box' })).toHaveAttribute('aria-selected', 'true')
  })
})

describe('What I pass on — Story box', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGet()
    api.post.mockResolvedValue({ data: {} })
    api.put.mockResolvedValue({ data: {} })
    api.delete.mockResolvedValue({ data: {} })
  })

  it('shows what a story can be when there are none, and one way to start', async () => {
    renderPage()
    expect(await screen.findByText(
      'Nothing here yet. A story can be a small one — how you met, what you learned the hard way, the recipe nobody else has.',
    )).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tell a story' })).toBeInTheDocument()
  })

  it('replaces the start button with the form, so only one button is filled', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Tell a story' }))
    expect(screen.queryByRole('button', { name: 'Tell a story' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Give it a name')).toBeInTheDocument()
    expect(screen.getByLabelText('Tell it')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save this story' })).toBeInTheDocument()
  })

  it('steers her away from the answers a bank would ask for', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Tell a story' }))
    expect(screen.getByText(
      'Please keep things a bank would ask you — your first pet, the street you grew up on, your mother’s family name — out of here. Those belong in the Sealed box.',
    )).toBeInTheDocument()
  })

  it('offers all four audiences in her own words', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Tell a story' }))
    expect(screen.getByRole('radiogroup', { name: 'Who should see this?' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /^Anyone/ })).toBeInTheDocument()
    expect(screen.getByText('Anyone who opens your page, including people you have never met.')).toBeInTheDocument()
    expect(screen.getByText('Only the family members on your family list.')).toBeInTheDocument()
    expect(screen.getByText('Only the helpers you have built up trust with.')).toBeInTheDocument()
    expect(screen.getByText('One person you choose. Nobody else.')).toBeInTheDocument()
  })

  it('saves a story with the audience she picked', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Tell a story' }))
    await user.type(screen.getByLabelText('Give it a name'), 'The winter we lost the roof')
    await user.type(screen.getByLabelText('Tell it'), 'It came off in the night.')
    await user.click(screen.getByRole('radio', { name: /^My family/ }))
    await user.click(screen.getByRole('button', { name: 'Save this story' }))
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/passon/items', {
        kind: 'STORY',
        title: 'The winter we lost the roof',
        body: 'It came off in the night.',
        audience: 'FAMILY',
        audienceUserId: null,
      })
    })
  })

  it('asks once before showing a story to people she has never met', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Tell a story' }))
    await user.type(screen.getByLabelText('Give it a name'), 'The winter we lost the roof')
    await user.type(screen.getByLabelText('Tell it'), 'It came off in the night.')
    await user.click(screen.getByRole('radio', { name: /^Anyone/ }))
    await user.click(screen.getByRole('button', { name: 'Save this story' }))
    // Nothing is saved until she says yes to the wider audience.
    expect(api.post).not.toHaveBeenCalled()
    expect(await screen.findByText(/anyone who opens your page can read this/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /show it to anyone/i }))
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/passon/items', expect.objectContaining({ audience: 'EVERYONE' }))
    })
  })

  it('lists what she has written, and takes one down when she confirms', async () => {
    const user = userEvent.setup()
    mockGet(mine([
      { id: 's1', kind: 'STORY', title: 'The winter we lost the roof', body: 'It came off in the night.', audience: 'EVERYONE', releaseWhen: 'NOW' },
    ]))
    renderPage()
    expect(await screen.findByText('The winter we lost the roof')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^remove$/i }))
    await user.click(await screen.findByRole('button', { name: /^take it down$/i }))
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/passon/items/s1'))
  })

  it('edits a story in place through the same form', async () => {
    const user = userEvent.setup()
    mockGet(mine([
      { id: 's1', kind: 'STORY', title: 'The winter we lost the roof', body: 'It came off in the night.', audience: 'FAMILY', releaseWhen: 'NOW' },
    ]))
    renderPage()
    await user.click(await screen.findByRole('button', { name: /^change$/i }))
    const title = screen.getByLabelText('Give it a name')
    expect(title).toHaveValue('The winter we lost the roof')
    await user.clear(title)
    await user.type(title, 'The winter the roof went')
    await user.click(screen.getByRole('button', { name: 'Save this story' }))
    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith('/passon/items/s1', expect.objectContaining({
        title: 'The winter the roof went',
        audience: 'FAMILY',
      }))
    })
  })
})

describe('What I pass on — Letter box', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGet()
    api.post.mockResolvedValue({ data: {} })
    api.put.mockResolvedValue({ data: {} })
    api.delete.mockResolvedValue({ data: {} })
  })

  it('says what a letter is when there are none', async () => {
    const user = userEvent.setup()
    renderPage()
    await openTab(user, 'Letter box')
    expect(await screen.findByText('No letters yet. A letter goes to one person, and only that person.')).toBeInTheDocument()
  })

  it('is honest about the part that is not built, instead of offering it', async () => {
    const user = userEvent.setup()
    renderPage()
    await openTab(user, 'Letter box')
    expect(await screen.findByText(
      'Every letter here can be read today. We are still building the part where a letter opens after you are gone, and we will not offer it until we are sure it works. When it is ready we will tell you, and you will be able to change any letter over.',
    )).toBeInTheDocument()
    // The choice itself is absent, not greyed out: nothing on this tab lets her
    // pick a letter that opens after she is gone.
    expect(screen.queryByRole('radio', { name: /after/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /after/i })).not.toBeInTheDocument()
  })

  it('writes a letter to one named person', async () => {
    const user = userEvent.setup()
    renderPage()
    await openTab(user, 'Letter box')
    await user.click(await screen.findByRole('button', { name: 'Write a letter' }))
    await user.type(screen.getByLabelText('Give it a name'), 'For Sarah')
    await user.type(screen.getByLabelText('Write it'), 'You were always the brave one.')
    await user.click(screen.getByRole('radio', { name: /Sarah/ }))
    await user.click(screen.getByRole('button', { name: 'Save this letter' }))
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/passon/items', {
        kind: 'LETTER',
        title: 'For Sarah',
        body: 'You were always the brave one.',
        audience: 'PERSON',
        audienceUserId: SARAH,
      })
    })
  })

  it('offers family and trusted helpers to write to, and nobody whose friendship has ended', async () => {
    const user = userEvent.setup()
    renderPage()
    await openTab(user, 'Letter box')
    await user.click(await screen.findByRole('button', { name: 'Write a letter' }))
    expect(screen.getByRole('radio', { name: /Sarah/ })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Priya/ })).toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: /Gone/ })).not.toBeInTheDocument()
  })

  it('shows who a letter is for, that they can read it now, and when they read it', async () => {
    const user = userEvent.setup()
    mockGet(mine([], [
      {
        id: 'e1', kind: 'LETTER', title: 'For Sarah', body: 'You were always the brave one.',
        audience: 'PERSON', audienceUserId: SARAH, audienceUserName: 'Sarah',
        releaseWhen: 'NOW', firstReadAt: '2026-06-03T09:00:00',
      },
      {
        id: 'e2', kind: 'LETTER', title: 'For David', body: 'Look after the garden.',
        audience: 'PERSON', audienceUserId: 'bbbb', audienceUserName: 'David',
        releaseWhen: 'NOW', firstReadAt: null,
      },
    ]))
    renderPage()
    await openTab(user, 'Letter box')
    expect(await screen.findByText('To Sarah')).toBeInTheDocument()
    expect(screen.getByText('To David')).toBeInTheDocument()
    expect(screen.getAllByText('They can read this now')).toHaveLength(2)
    expect(screen.getByText('Sarah read this on 3 June')).toBeInTheDocument()
  })
})

describe('What I pass on — Sealed box, before it is set up', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGet()
  })

  it('teaches what the box is for and how it is kept safe, without overpromising', async () => {
    const user = userEvent.setup()
    renderPage()
    await openTab(user, 'Sealed box')
    expect(await screen.findByText('The things only you know.')).toBeInTheDocument()
    expect(screen.getByText(
      'Where the money is. Which bank. Where the papers are kept. Write them down once, here.',
    )).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'How this is kept safe' })).toBeInTheDocument()
    // The honest promise, including the part most products leave out.
    expect(screen.getByText(/If someone broke into the company itself, they could\./)).toBeInTheDocument()
    expect(screen.getByText(/You can never be shut out of your own box\./)).toBeInTheDocument()
  })

  it('says plainly that the after-death part is not switched on yet', async () => {
    const user = userEvent.setup()
    renderPage()
    await openTab(user, 'Sealed box')
    expect(await screen.findByRole('heading', { name: 'After you are gone' })).toBeInTheDocument()
    expect(screen.getByText(/It is not ready, and we will not switch it on until it is\./)).toBeInTheDocument()
    // No paper anywhere in this feature (owner call 2026-07-30).
    expect(screen.queryByText(/print/i)).not.toBeInTheDocument()
  })
})
