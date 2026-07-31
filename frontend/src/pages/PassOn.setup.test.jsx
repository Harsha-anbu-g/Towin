// Setting the Sealed box up: three steps, the two acknowledgements, and the week
// she has to change her mind.
//
// Two rules on this screen are worth more than everything else here and both are
// asserted directly. Nothing is asked of anybody until she presses the last button
// — backing out halfway must leave three relatives who were never asked a question
// about her death. And the two sentences she ticks are sent back exactly as the
// server sent them down, because the server stores a hash of the wording shown and
// a paraphrase would record an agreement to words she never saw.
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
const DAVID = 'aaaaaaaa-0000-0000-0000-00000000a002'
const RUTH = 'aaaaaaaa-0000-0000-0000-00000000a003'

// The exact sentences the server publishes and hashes. Written out in full here on
// purpose: if the server's wording changes, this test should fail rather than
// quietly agree to the new one.
const NOT_A_WILL_ACK = 'I understand this is not a will.'
const KEY_TRUTH_ACK =
  'I understand that Towinly holds the key, so someone here could open my box — and that '
  + 'means I can never be shut out of it either. If I forget my password I reset it as usual.'

const threeOnHerList = {
  activeLinks: [
    { id: 'l1', otherUserId: SARAH, otherUserName: 'Sarah', relationship: 'Daughter', status: 'ACTIVE' },
    { id: 'l2', otherUserId: DAVID, otherUserName: 'David', relationship: 'Son', status: 'ACTIVE' },
    { id: 'l3', otherUserId: RUTH, otherUserName: 'Ruth', relationship: 'Sister', status: 'ACTIVE' },
  ],
  incomingRequests: [],
  outgoingRequests: [],
}

const notSetUp = {
  armed: false,
  armedAt: null,
  coolingOffUntil: null,
  canStillUndo: false,
  approvalsNeeded: null,
  keyholderTarget: null,
  emailConfirmed: true,
  hasPassword: true,
  notAWillAck: NOT_A_WILL_ACK,
  keyTruthAck: KEY_TRUTH_ACK,
}

const mockGet = ({ setup = notSetUp, links = threeOnHerList, keyholders = [], sealed = [] } = {}) => {
  api.get.mockImplementation((url) => {
    if (url === '/passon/mine') return Promise.resolve({ data: { stories: [], letters: [] } })
    if (url === '/family/links') return Promise.resolve({ data: links })
    if (url === '/connections') return Promise.resolve({ data: [] })
    if (url === '/passon/setup') return Promise.resolve({ data: setup })
    if (url === '/passon/keyholders') return Promise.resolve({ data: keyholders })
    // Names only, never a body — see SealedItemSummary. An armed box with nothing in it is
    // a real state: she can set the arrangement up before she writes anything down.
    if (url === '/passon/sealed') return Promise.resolve({ data: sealed })
    return Promise.resolve({ data: {} })
  })
}

const openSealedTab = async () => {
  render(
    <MemoryRouter initialEntries={['/what-i-pass-on?tab=sealed']}>
      <PassOn />
    </MemoryRouter>,
  )
  await screen.findByRole('heading', { name: 'The things only you know.' })
}

/** Walks steps one and two with the three people picked and two who must agree. */
const walkToTheLastStep = async (user) => {
  await user.click(screen.getByRole('button', { name: 'Set this up' }))
  await screen.findByRole('heading', { name: 'Who can open it one day?' })

  await user.click(screen.getByRole('checkbox', { name: /Sarah/ }))
  await user.click(screen.getByRole('checkbox', { name: /David/ }))
  await user.click(screen.getByRole('checkbox', { name: /Ruth/ }))
  await user.click(screen.getByRole('button', { name: 'Next' }))

  await screen.findByRole('heading', { name: 'How many must agree?' })
  await user.click(screen.getByRole('button', { name: 'Next' }))
  await screen.findByRole('heading', { name: 'Before you finish.' })
}

beforeEach(() => {
  vi.clearAllMocks()
  api.post.mockResolvedValue({ data: {} })
})

describe('setting the Sealed box up', () => {
  it('offers one way in, and the teaching card stays until she takes it', async () => {
    mockGet()
    await openSealedTab()

    expect(screen.getByRole('button', { name: 'Set this up' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Who can open it one day?' })).not.toBeInTheDocument()
  })

  it('says plainly that a family list of two is a dead end, and does not offer the pick', async () => {
    mockGet({
      links: { ...threeOnHerList, activeLinks: threeOnHerList.activeLinks.slice(0, 2) },
    })
    await openSealedTab()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Set this up' }))

    expect(await screen.findByText('You need at least three people on your family list first.'))
      .toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: /Sarah/ })).not.toBeInTheDocument()
  })

  it('will not move past the first step until three people are picked', async () => {
    mockGet()
    await openSealedTab()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Set this up' }))
    await screen.findByRole('heading', { name: 'Who can open it one day?' })

    await user.click(screen.getByRole('checkbox', { name: /Sarah/ }))
    await user.click(screen.getByRole('checkbox', { name: /David/ }))
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()

    await user.click(screen.getByRole('checkbox', { name: /Ruth/ }))
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
  })

  it('says the number back to her in real names, and never as an example', async () => {
    mockGet()
    await openSealedTab()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Set this up' }))
    await screen.findByRole('heading', { name: 'Who can open it one day?' })
    await user.click(screen.getByRole('checkbox', { name: /Sarah/ }))
    await user.click(screen.getByRole('checkbox', { name: /David/ }))
    await user.click(screen.getByRole('checkbox', { name: /Ruth/ }))
    await user.click(screen.getByRole('button', { name: 'Next' }))

    await screen.findByRole('heading', { name: 'How many must agree?' })
    expect(screen.getByText(
      'So: any 2 of Sarah, David and Ruth. That means 2 of them can open it even if the other one says no.',
    )).toBeInTheDocument()
  })

  it('asks nobody anything until she presses the last button', async () => {
    // The whole reason the invitations are sent from inside the finish call. Walking
    // in and out of the setup must leave three relatives who were never asked a
    // question about her death.
    mockGet()
    await openSealedTab()

    const user = userEvent.setup()
    await walkToTheLastStep(user)
    await user.click(screen.getByRole('button', { name: 'Not now' }))

    expect(api.post).not.toHaveBeenCalled()
  })

  it('stops her at the last step when her email is not confirmed', async () => {
    mockGet({ setup: { ...notSetUp, emailConfirmed: false } })
    await openSealedTab()

    const user = userEvent.setup()
    await walkToTheLastStep(user)

    expect(screen.getByText(
      'Please confirm your email address first. One day it is how we would reach you about '
      + 'your box, and we need to know it works.',
    )).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Finish setting this up' })).not.toBeInTheDocument()
  })

  it('stops a Google-only account, which has no password to keep the box shut', async () => {
    mockGet({ setup: { ...notSetUp, hasPassword: false } })
    await openSealedTab()

    const user = userEvent.setup()
    await walkToTheLastStep(user)

    expect(screen.getByText(/this account signs in with Google/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Finish setting this up' })).not.toBeInTheDocument()
  })

  // The save row asks her to keep a copy outside Towinly, and it may only offer what the
  // product actually does. There is no mailto, no send-to-self and no sheet-email path
  // anywhere in this feature, so an offer to email it to herself is a promise she would find
  // out about only when she went looking for a button that was never built — on the screen
  // where she is deciding whether to trust this with where her money is.
  it('offers the download and nothing it cannot do, and still says not to rely on the app', async () => {
    mockGet()
    await openSealedTab()

    const user = userEvent.setup()
    await walkToTheLastStep(user)

    expect(screen.getByText('Keep a copy somewhere else')).toBeInTheDocument()
    expect(screen.getByText(
      'Save your one-page copy to your computer, and keep it wherever your family would think '
      + 'to look. Do not let this app be your only copy.',
    )).toBeInTheDocument()
    expect(screen.queryByText(/in an email/)).not.toBeInTheDocument()
  })

  it('will not finish until both boxes are ticked', async () => {
    mockGet()
    await openSealedTab()

    const user = userEvent.setup()
    await walkToTheLastStep(user)

    expect(screen.getByRole('button', { name: 'Finish setting this up' })).toBeDisabled()
    await user.click(screen.getByRole('checkbox', { name: NOT_A_WILL_ACK }))
    expect(screen.getByRole('button', { name: 'Finish setting this up' })).toBeDisabled()
    await user.click(screen.getByRole('checkbox', { name: KEY_TRUTH_ACK }))
    expect(screen.getByRole('button', { name: 'Finish setting this up' })).toBeEnabled()
  })

  it('sends back the two sentences exactly as the server sent them down', async () => {
    // The server stores a hash of the wording shown, and refuses any wording it does
    // not publish. A paraphrase here would record an agreement to words she never saw.
    mockGet()
    await openSealedTab()

    const user = userEvent.setup()
    await walkToTheLastStep(user)
    await user.click(screen.getByRole('checkbox', { name: NOT_A_WILL_ACK }))
    await user.click(screen.getByRole('checkbox', { name: KEY_TRUTH_ACK }))
    await user.click(screen.getByRole('button', { name: 'Finish setting this up' }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/passon/arm', {
      personIds: [SARAH, DAVID, RUTH],
      approvalsNeeded: 2,
      notAWillAck: NOT_A_WILL_ACK,
      keyTruthAck: KEY_TRUTH_ACK,
    }))
  })
})

describe('the seven days', () => {
  const settling = {
    ...notSetUp,
    armed: true,
    armedAt: '2026-08-05T10:00:00',
    coolingOffUntil: '2026-08-12T10:00:00',
    canStillUndo: true,
    approvalsNeeded: 2,
    keyholderTarget: 3,
  }

  const asked = [
    { id: 'k1', personId: SARAH, personName: 'Sarah', status: 'ACTIVE', countsToward: true, invitedAt: '2026-08-05T10:00:00', respondedAt: '2026-08-06T09:00:00' },
    { id: 'k2', personId: DAVID, personName: 'David', status: 'INVITED', countsToward: false, invitedAt: '2026-08-05T10:00:00', respondedAt: null },
    { id: 'k3', personId: RUTH, personName: 'Ruth', status: 'INVITED', countsToward: false, invitedAt: '2026-08-05T10:00:00', respondedAt: null },
  ]

  it('names the people who were actually written to', async () => {
    mockGet({ setup: settling, keyholders: asked })
    render(
      <MemoryRouter initialEntries={['/what-i-pass-on?tab=sealed']}>
        <PassOn />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Your box is set up.')).toBeInTheDocument()
    expect(screen.getByText(
      'Nothing can be opened by anyone but you. We will check with you once more in seven days '
      + 'before this is settled, and we have written to Sarah, David and Ruth to ask if they will '
      + 'hold a key.',
    )).toBeInTheDocument()
  })

  it('gives her one tap out of it, and takes every key back with it', async () => {
    mockGet({ setup: settling, keyholders: asked })
    render(
      <MemoryRouter initialEntries={['/what-i-pass-on?tab=sealed']}>
        <PassOn />
      </MemoryRouter>,
    )
    await screen.findByText('Your box is set up.')

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'If this was not your idea, undo it' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/nobody is told you did this/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Yes, undo it' }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/passon/undo'))
  })

  it('shows each person with a real status, and never a made-up one', async () => {
    mockGet({ setup: settling, keyholders: asked })
    render(
      <MemoryRouter initialEntries={['/what-i-pass-on?tab=sealed']}>
        <PassOn />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Sarah said yes on 6 August')).toBeInTheDocument()
    expect(screen.getByText('David has not answered yet')).toBeInTheDocument()
    expect(screen.getByText('2 of the 3 must agree.')).toBeInTheDocument()
  })

  // Her saved copy is the answer to "what if Towinly disappears", and a page nobody can reach
  // is a page that is not shipped. This is the only way to it.
  it('offers her the way to her saved copy', async () => {
    mockGet({ setup: settling, keyholders: asked })
    render(
      <MemoryRouter initialEntries={['/what-i-pass-on?tab=sealed']}>
        <PassOn />
      </MemoryRouter>,
    )

    const link = await screen.findByRole('link', { name: /Save your one-page copy/ })
    expect(link).toHaveAttribute('href', '/what-i-pass-on/sheet')
  })

  it('drops the undo once the week has passed, and says nothing about it', async () => {
    mockGet({
      setup: { ...settling, canStillUndo: false, coolingOffUntil: '2026-08-01T10:00:00' },
      keyholders: asked,
    })
    render(
      <MemoryRouter initialEntries={['/what-i-pass-on?tab=sealed']}>
        <PassOn />
      </MemoryRouter>,
    )
    await screen.findByText('Who can open it one day')

    expect(screen.queryByText('Your box is set up.')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'If this was not your idea, undo it' }))
      .not.toBeInTheDocument()
  })
})
