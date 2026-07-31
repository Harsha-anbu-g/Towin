// The item half of the Sealed box: what is inside, putting something in, and the
// one screen in Towinly that ever shows a decrypted secret.
//
// Two rules here are worth more than everything else and both are asserted directly.
// Nothing she wrote is on the screen until she has typed her password — the list has
// names on it and no preview text at all, so a relative reading over her shoulder
// learns that "the password book" exists and not one word of what is in it. And every
// refusal is shown in the server's own sentence, because the seven-day freeze after a
// password change is the one message on this page somebody may act on.
//
// The copy is asserted word for word on purpose. If a test here fails on wording, the
// wording is the bug.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import PassOn from './PassOn'

vi.mock('../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

vi.mock('../context/useAuth', () => ({
  useAuth: () => ({ user: { role: 'ELDER', name: 'Margaret', username: 'margaret' } }),
}))

const toast = { success: vi.fn(), error: vi.fn() }
vi.mock('../context/useToast', () => ({ useToast: () => ({ toast }) }))

vi.mock('../components/NavBar', () => ({ default: () => <nav /> }))

import api from '../api/axios'

const SARAH = 'aaaaaaaa-0000-0000-0000-00000000a001'

/** What a deployment that has set the release contact sends down with the setup state. */
const RELEASE_CONTACT_EMAIL = 'sealedbox@example.org'

// A box that was set up long enough ago that the seven-day undo card is gone, so the
// item half is the first thing on the tab.
const settled = {
  armed: true,
  armedAt: '2026-06-01T10:00:00',
  coolingOffUntil: '2026-06-08T10:00:00',
  canStillUndo: false,
  approvalsNeeded: 2,
  keyholderTarget: 3,
  emailConfirmed: true,
  hasPassword: true,
  notAWillAck: 'I understand this is not a will.',
  keyTruthAck: 'I understand that Towinly holds the key.',
  // Deployment configuration, from SEALED_BOX_RELEASE_CONTACT_EMAIL. Null on a deployment
  // that has not set one, and the screen says so — see the pair of tests on the freeze.
  releaseContactEmail: RELEASE_CONTACT_EMAIL,
}

const links = {
  activeLinks: [
    { id: 'l1', otherUserId: SARAH, otherUserName: 'Sarah', relationship: 'Daughter', status: 'ACTIVE' },
  ],
  incomingRequests: [],
  outgoingRequests: [],
}

const keyholders = [
  { id: 'k1', personId: SARAH, personName: 'Sarah', status: 'ACTIVE', respondedAt: '2026-06-02T09:00:00' },
]

// What the list route returns: names, chips, sizes and dates. No body field exists on
// it at all — that is the server's design, and this fixture matches it exactly so the
// screen can never be written against a body it will not get.
const THREE_THINGS = [
  { id: 'i1', label: 'Where the money is', kindHint: 'MONEY', byteSize: 120, createdAt: '2026-06-02T09:00:00' },
  { id: 'i2', label: 'The password book', kindHint: 'PASSWORDS', byteSize: 80, createdAt: '2026-06-03T09:00:00' },
  { id: 'i3', label: 'Where the papers are', kindHint: 'PAPERS', byteSize: 60, createdAt: '2026-06-04T09:00:00' },
]

const SECRET = 'The Barclays account at the Halifax branch, and the key is under the third flowerpot.'

const mockGet = (sealed = THREE_THINGS, setup = settled) => {
  api.get.mockImplementation((url) => {
    if (url === '/passon/mine') return Promise.resolve({ data: { stories: [], letters: [] } })
    if (url === '/family/links') return Promise.resolve({ data: links })
    if (url === '/connections') return Promise.resolve({ data: [] })
    if (url === '/passon/setup') return Promise.resolve({ data: setup })
    if (url === '/passon/keyholders') return Promise.resolve({ data: keyholders })
    if (url === '/passon/sealed') return Promise.resolve({ data: sealed })
    return Promise.resolve({ data: {} })
  })
}

/** A rejection shaped the way axios delivers one of the server's plain refusals. */
const refusal = (message) => Promise.reject({ response: { data: { message } } })

const openSealedTab = async () => {
  render(
    <MemoryRouter initialEntries={['/what-i-pass-on?tab=sealed']}>
      <PassOn />
    </MemoryRouter>,
  )
  await screen.findByRole('heading', { name: 'Who can open it one day' })
}

/** The card for one thing, found by the name she gave it. */
const cardFor = (label) => screen.getByText(label).closest('article')

beforeEach(() => {
  vi.clearAllMocks()
  api.post.mockResolvedValue({ data: {} })
  api.delete.mockResolvedValue({ data: {} })
})

describe('what is in the box', () => {
  it('counts what is inside, and says nobody else can see it', async () => {
    mockGet()
    await openSealedTab()

    expect(await screen.findByText(
      'Your box is shut. 3 things are inside. Nobody can see them but you.',
    )).toBeInTheDocument()
  })

  it('says "1 thing is inside" when there is one', async () => {
    mockGet([THREE_THINGS[0]])
    await openSealedTab()

    expect(await screen.findByText(
      'Your box is shut. 1 thing is inside. Nobody can see them but you.',
    )).toBeInTheDocument()
  })

  it('says the box is empty rather than showing an empty list', async () => {
    mockGet([])
    await openSealedTab()

    expect(await screen.findByText(
      'Your box is shut. There is nothing in it yet. Nobody can see what you put in but you.',
    )).toBeInTheDocument()
  })

  it('shows one card per thing, with its name, its chip and the word "Locked"', async () => {
    mockGet()
    await openSealedTab()

    const card = await waitFor(() => cardFor('Where the money is'))
    expect(within(card).getByText('Money')).toBeInTheDocument()
    expect(within(card).getByText('Locked')).toBeInTheDocument()

    expect(within(cardFor('The password book')).getByText('Passwords')).toBeInTheDocument()
    expect(within(cardFor('Where the papers are')).getByText('Papers')).toBeInTheDocument()
  })

  it('stays on its feet when the list route answers with something that is not a list', async () => {
    // Observed, not imagined: a 200 carrying an object took the whole page down with
    // "inside.map is not a function". This is the page she opens to check her sealed box is
    // still there, so it has to survive a server answering oddly.
    mockGet({})
    await openSealedTab()

    expect(await screen.findByText(
      'Your box is shut. There is nothing in it yet. Nobody can see what you put in but you.',
    )).toBeInTheDocument()
  })

  it('shows no preview of what any of it says', async () => {
    // The list route carries no body at all. This is the screen-side half of that
    // rule: a card that started clipping a preview in later would fail here.
    mockGet()
    await openSealedTab()

    await waitFor(() => cardFor('Where the money is'))
    expect(screen.queryByText(/Barclays/)).not.toBeInTheDocument()
    expect(screen.queryByText(/flowerpot/)).not.toBeInTheDocument()
  })
})

describe('opening one thing', () => {
  it('asks for her password before it opens anything', async () => {
    const user = userEvent.setup()
    mockGet()
    await openSealedTab()

    const card = await waitFor(() => cardFor('Where the money is'))
    await user.click(within(card).getByRole('button', { name: 'See this' }))

    expect(within(card).getByText('Type your password to see this.')).toBeInTheDocument()
    // Nothing has been asked of the server yet.
    expect(api.post).not.toHaveBeenCalledWith(
      expect.stringContaining('/reveal'), expect.anything(),
    )
  })

  it('shows what she wrote once the password is right', async () => {
    const user = userEvent.setup()
    mockGet()
    api.post.mockImplementation((url) => {
      if (url === '/passon/sealed/i1/reveal') {
        return Promise.resolve({
          data: { id: 'i1', kindHint: 'MONEY', label: 'Where the money is', body: SECRET },
        })
      }
      return Promise.resolve({ data: {} })
    })
    await openSealedTab()

    const card = await waitFor(() => cardFor('Where the money is'))
    await user.click(within(card).getByRole('button', { name: 'See this' }))
    await user.type(within(card).getByLabelText('Your password'), 'rosebush22')
    await user.click(within(card).getByRole('button', { name: 'Show it to me' }))

    expect(await screen.findByText(SECRET)).toBeInTheDocument()
    expect(api.post).toHaveBeenCalledWith('/passon/sealed/i1/reveal', { password: 'rosebush22' })
    // The password row is gone, replaced by the words themselves.
    expect(within(card).queryByText('Type your password to see this.')).not.toBeInTheDocument()
  })

  it('never puts the password in the address it calls', async () => {
    // A password in a path or a query string is written into access logs, browser
    // history and referrer headers, and this one opens the whole account.
    const user = userEvent.setup()
    mockGet()
    api.post.mockResolvedValue({ data: { id: 'i1', kindHint: 'MONEY', label: 'Where the money is', body: SECRET } })
    await openSealedTab()

    const card = await waitFor(() => cardFor('Where the money is'))
    await user.click(within(card).getByRole('button', { name: 'See this' }))
    await user.type(within(card).getByLabelText('Your password'), 'rosebush22')
    await user.click(within(card).getByRole('button', { name: 'Show it to me' }))

    await waitFor(() => expect(api.post).toHaveBeenCalled())
    const [url] = api.post.mock.calls.find(([u]) => u.includes('/reveal'))
    expect(url).not.toContain('rosebush22')
  })

  it('puts the words away again when she asks', async () => {
    const user = userEvent.setup()
    mockGet()
    api.post.mockResolvedValue({ data: { id: 'i1', kindHint: 'MONEY', label: 'Where the money is', body: SECRET } })
    await openSealedTab()

    const card = await waitFor(() => cardFor('Where the money is'))
    await user.click(within(card).getByRole('button', { name: 'See this' }))
    await user.type(within(card).getByLabelText('Your password'), 'rosebush22')
    await user.click(within(card).getByRole('button', { name: 'Show it to me' }))
    await screen.findByText(SECRET)

    await user.click(within(card).getByRole('button', { name: 'Hide this again' }))
    expect(screen.queryByText(SECRET)).not.toBeInTheDocument()
  })

  it('asks for the password rather than sending an empty one', async () => {
    const user = userEvent.setup()
    mockGet()
    await openSealedTab()

    const card = await waitFor(() => cardFor('Where the money is'))
    await user.click(within(card).getByRole('button', { name: 'See this' }))
    await user.click(within(card).getByRole('button', { name: 'Show it to me' }))

    expect(within(card).getByRole('alert')).toHaveTextContent('Please type your password.')
    expect(api.post).not.toHaveBeenCalledWith(
      expect.stringContaining('/reveal'), expect.anything(),
    )
  })

  it('says in plain words when the password is wrong, and opens nothing', async () => {
    const user = userEvent.setup()
    mockGet()
    api.post.mockImplementation(() => refusal('That password was not right. Please try again.'))
    await openSealedTab()

    const card = await waitFor(() => cardFor('Where the money is'))
    await user.click(within(card).getByRole('button', { name: 'See this' }))
    await user.type(within(card).getByLabelText('Your password'), 'wrong'.repeat(2))
    await user.click(within(card).getByRole('button', { name: 'Show it to me' }))

    expect(await within(card).findByRole('alert'))
      .toHaveTextContent('That password was not right. Please try again.')
    expect(screen.queryByText(SECRET)).not.toBeInTheDocument()
    // She stays where she is, with the field still in front of her.
    expect(within(card).getByLabelText('Your password')).toBeInTheDocument()
  })

  it('explains the freeze after a password change in the words the server sent, and says who to write to', async () => {
    // The most realistic attack in this feature: whoever reads her email can reset
    // her password. The freeze is what stands between that and her bank details, so
    // the sentence is the server's own, with its real date, and it is followed by a
    // person to write to rather than a feedback form.
    const user = userEvent.setup()
    const frozen = 'You changed your password recently. For your safety your Sealed box stays '
      + 'shut until 12 August. If that was not you, tell us straight away.'
    mockGet()
    api.post.mockImplementation(() => refusal(frozen))
    await openSealedTab()

    const card = await waitFor(() => cardFor('Where the money is'))
    await user.click(within(card).getByRole('button', { name: 'See this' }))
    await user.type(within(card).getByLabelText('Your password'), 'rosebush22')
    await user.click(within(card).getByRole('button', { name: 'Show it to me' }))

    const alert = await within(card).findByRole('alert')
    expect(alert).toHaveTextContent(frozen)
    expect(alert).toHaveTextContent(`Write to Towinly at ${RELEASE_CONTACT_EMAIL}.`)
  })

  // The address is deployment configuration and there is no fallback. Sending her to a
  // plausible-looking mailbox that cannot receive mail would be worse than telling her the
  // truth: she would write to it, hear nothing, and have no way of knowing why — on the one
  // message in this feature that means somebody may be going through her account.
  it('admits there is no address to write to rather than inventing one', async () => {
    const user = userEvent.setup()
    const frozen = 'You changed your password recently. For your safety your Sealed box stays '
      + 'shut until 12 August. If that was not you, tell us straight away.'
    mockGet(THREE_THINGS, { ...settled, releaseContactEmail: null })
    api.post.mockImplementation(() => refusal(frozen))
    await openSealedTab()

    const card = await waitFor(() => cardFor('Where the money is'))
    await user.click(within(card).getByRole('button', { name: 'See this' }))
    await user.type(within(card).getByLabelText('Your password'), 'rosebush22')
    await user.click(within(card).getByRole('button', { name: 'Show it to me' }))

    const alert = await within(card).findByRole('alert')
    expect(alert).toHaveTextContent(frozen)
    expect(alert).toHaveTextContent('Towinly has not set an address to write to yet.')
    expect(alert.textContent).not.toMatch(/@/)
  })

  it('says something plain when the server says nothing at all', async () => {
    const user = userEvent.setup()
    mockGet()
    api.post.mockImplementation(() => Promise.reject(new Error('network down')))
    await openSealedTab()

    const card = await waitFor(() => cardFor('Where the money is'))
    await user.click(within(card).getByRole('button', { name: 'See this' }))
    await user.type(within(card).getByLabelText('Your password'), 'rosebush22')
    await user.click(within(card).getByRole('button', { name: 'Show it to me' }))

    expect(await within(card).findByRole('alert'))
      .toHaveTextContent('We could not open that. Please try again.')
  })
})

describe('putting something in', () => {
  it('promises her the name is never seen by anybody else', async () => {
    const user = userEvent.setup()
    mockGet()
    await openSealedTab()

    await user.click(await screen.findByRole('button', { name: 'Put something in' }))

    expect(screen.getByText('What is it?')).toBeInTheDocument()
    expect(screen.getByText(
      'Give it a name you would recognise. Nobody else ever sees this name, not even your Keyholders.',
    )).toBeInTheDocument()
  })

  it('locks away the name, the words and the kind she chose', async () => {
    const user = userEvent.setup()
    mockGet()
    await openSealedTab()

    await user.click(await screen.findByRole('button', { name: 'Put something in' }))
    await user.type(screen.getByLabelText('What is it?'), 'Where the money is')
    await user.type(screen.getByLabelText('Write it down'), SECRET)
    await user.click(screen.getByRole('radio', { name: /Money/ }))
    await user.click(screen.getByRole('button', { name: 'Lock this away' }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/passon/sealed', {
      label: 'Where the money is',
      body: SECRET,
      kindHint: 'MONEY',
    }))
  })

  it('keeps every word on the screen when the save fails', async () => {
    // She has just typed out where her money is. Closing the form and showing her a toast
    // would ask her to write the whole thing again from memory.
    const user = userEvent.setup()
    mockGet()
    api.post.mockImplementation(() => refusal('We could not save that. Please try again.'))
    await openSealedTab()

    await user.click(await screen.findByRole('button', { name: 'Put something in' }))
    await user.type(screen.getByLabelText('What is it?'), 'Where the money is')
    await user.type(screen.getByLabelText('Write it down'), SECRET)
    await user.click(screen.getByRole('radio', { name: /Money/ }))
    await user.click(screen.getByRole('button', { name: 'Lock this away' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(screen.getByLabelText('What is it?')).toHaveValue('Where the money is')
    expect(screen.getByLabelText('Write it down')).toHaveValue(SECRET)
  })

  it('will not save a thing with no name', async () => {
    const user = userEvent.setup()
    mockGet()
    await openSealedTab()

    await user.click(await screen.findByRole('button', { name: 'Put something in' }))
    await user.type(screen.getByLabelText('Write it down'), SECRET)
    await user.click(screen.getByRole('radio', { name: /Money/ }))
    await user.click(screen.getByRole('button', { name: 'Lock this away' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Please give it a name.')
    expect(api.post).not.toHaveBeenCalledWith('/passon/sealed', expect.anything())
  })

  it('will not save a thing before she has said what kind it is', async () => {
    const user = userEvent.setup()
    mockGet()
    await openSealedTab()

    await user.click(await screen.findByRole('button', { name: 'Put something in' }))
    await user.type(screen.getByLabelText('What is it?'), 'Where the money is')
    await user.type(screen.getByLabelText('Write it down'), SECRET)
    await user.click(screen.getByRole('button', { name: 'Lock this away' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Please choose what kind of thing this is.')
    expect(api.post).not.toHaveBeenCalledWith('/passon/sealed', expect.anything())
  })
})

describe('taking something out', () => {
  it('asks first, in words that say it cannot be undone', async () => {
    const user = userEvent.setup()
    mockGet()
    await openSealedTab()

    const card = await waitFor(() => cardFor('Where the money is'))
    await user.click(within(card).getByRole('button', { name: 'Delete' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Take this out of the box?')).toBeInTheDocument()
    expect(within(dialog).getByText(
      'It will be gone for good. Nobody will be able to read it again, and that includes you.',
    )).toBeInTheDocument()
    expect(api.delete).not.toHaveBeenCalled()
  })

  it('leaves it alone when she backs out', async () => {
    const user = userEvent.setup()
    mockGet()
    await openSealedTab()

    const card = await waitFor(() => cardFor('Where the money is'))
    await user.click(within(card).getByRole('button', { name: 'Delete' }))
    await user.click(await screen.findByRole('button', { name: 'Keep it' }))

    expect(api.delete).not.toHaveBeenCalled()
  })

  it('takes it out only once she has said yes', async () => {
    const user = userEvent.setup()
    mockGet()
    await openSealedTab()

    const card = await waitFor(() => cardFor('Where the money is'))
    await user.click(within(card).getByRole('button', { name: 'Delete' }))
    await user.click(await screen.findByRole('button', { name: 'Take it out' }))

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/passon/sealed/i1'))
  })
})

describe('before the box is set up', () => {
  it('offers nothing to put in, because there is nowhere to put it', async () => {
    mockGet([], { ...settled, armed: false, canStillUndo: false })
    render(
      <MemoryRouter initialEntries={['/what-i-pass-on?tab=sealed']}>
        <PassOn />
      </MemoryRouter>,
    )
    await screen.findByRole('heading', { name: 'The things only you know.' })

    expect(screen.queryByRole('button', { name: 'Put something in' })).not.toBeInTheDocument()
  })
})
