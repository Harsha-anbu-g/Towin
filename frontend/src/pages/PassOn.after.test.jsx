// Letters that are held until after she is gone.
//
// Three things are asserted here and nothing else matters as much.
//
// She is told the truth about what happens. There is no timer and no automatic
// delivery, so the words under the choice describe a person doing a procedure by
// hand, and the test pins that sentence word for word.
//
// She is only offered the choice when it could actually be honoured. Her
// Keyholders and her quorum live in the Sealed box, and until she has set that up
// there is nobody who could ever ask for a held letter to be opened. The option is
// shown disabled with the reason, never hidden — she should know it exists.
//
// And what she chose survives an edit. The server reads a missing releaseWhen as
// "read it today", so a form that leaves the field out would quietly hand a held
// letter to a living person the next time she fixed a typo.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import PassOn from './PassOn'
import * as locks from '../components/passOnLocks'

vi.mock('../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

vi.mock('../context/useAuth', () => ({
  useAuth: () => ({ user: { role: 'ELDER', name: 'Margaret', username: 'margaret' } }),
}))

vi.mock('../context/useToast', () => ({
  useToast: () => ({ toast: { success: vi.fn(), error: vi.fn() } }),
}))

vi.mock('../components/NavBar', () => ({ default: () => <nav /> }))

import api from '../api/axios'

const SARAH = 'aaaaaaaa-0000-0000-0000-00000000a001'

const familyLinks = {
  activeLinks: [
    { id: 'l1', otherUserId: SARAH, otherUserName: 'Sarah', relationship: 'Daughter', status: 'ACTIVE' },
  ],
  incomingRequests: [],
  outgoingRequests: [],
}

/** Her Sealed box as it reads once she has named Keyholders, and before she has. */
const armedBox = {
  armed: true,
  armedAt: '2026-06-01T09:00:00',
  coolingOffUntil: null,
  canStillUndo: false,
  approvalsNeeded: 2,
  keyholderTarget: 3,
  emailConfirmed: true,
  hasPassword: true,
  notAWillAck: 'I understand this is not a will.',
  keyTruthAck: 'I understand that Towinly holds the key.',
  releaseContactEmail: null,
}

const noBox = { ...armedBox, armed: false, armedAt: null, approvalsNeeded: null, keyholderTarget: null }

const mockGet = ({ setup = armedBox, letters = [] } = {}) => {
  api.get.mockImplementation((url) => {
    if (url === '/passon/mine') return Promise.resolve({ data: { stories: [], letters } })
    if (url === '/family/links') return Promise.resolve({ data: familyLinks })
    if (url === '/connections') return Promise.resolve({ data: [] })
    if (url === '/passon/setup') return Promise.resolve({ data: setup })
    if (url === '/passon/keyholders') return Promise.resolve({ data: [] })
    if (url === '/passon/sealed') return Promise.resolve({ data: [] })
    return Promise.resolve({ data: {} })
  })
}

const renderLetters = () =>
  render(
    <MemoryRouter initialEntries={['/what-i-pass-on?tab=letters']}>
      <PassOn />
    </MemoryRouter>,
  )

/** Opens the letter composer with a name, a body and Sarah picked. */
const writeALetter = async (user) => {
  await user.click(await screen.findByRole('button', { name: 'Write a letter' }))
  await user.type(screen.getByLabelText('Give it a name'), 'For Sarah')
  await user.type(screen.getByLabelText('Write it'), 'You were always the brave one.')
  await user.click(screen.getByRole('radio', { name: /Sarah/ }))
}

const READ_NOW = 'They can read it now'
const AFTER_IM_GONE = "Only after I'm gone"

beforeEach(() => {
  vi.clearAllMocks()
  api.post.mockResolvedValue({ data: {} })
  api.put.mockResolvedValue({ data: {} })
  api.delete.mockResolvedValue({ data: {} })
})

describe('choosing when a letter can be read', () => {
  it('offers both, starts on "read it now", and says what "after" really means', async () => {
    const user = userEvent.setup()
    mockGet()
    renderLetters()
    await writeALetter(user)

    const now = screen.getByRole('radio', { name: new RegExp(READ_NOW) })
    const after = screen.getByRole('radio', { name: new RegExp(AFTER_IM_GONE) })
    expect(now).toHaveAttribute('aria-checked', 'true')
    expect(after).toHaveAttribute('aria-checked', 'false')

    // The whole promise, in the words she reads. No timer, no automatic delivery.
    expect(screen.getByText(
      'Nobody sees this until someone at Towinly has checked a death certificate, asked the '
      + 'people you chose, and tried to reach you for thirty days.',
    )).toBeInTheDocument()
  })

  it('sends releaseWhen NOW when she leaves the choice alone', async () => {
    const user = userEvent.setup()
    mockGet()
    renderLetters()
    await writeALetter(user)
    await user.click(screen.getByRole('button', { name: 'Save this letter' }))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/passon/items', {
        kind: 'LETTER',
        title: 'For Sarah',
        body: 'You were always the brave one.',
        audience: 'PERSON',
        audienceUserId: SARAH,
        releaseWhen: 'NOW',
      })
    })
  })

  it('sends releaseWhen AFTER when she asks for it to be held', async () => {
    const user = userEvent.setup()
    mockGet()
    renderLetters()
    await writeALetter(user)
    await user.click(screen.getByRole('radio', { name: new RegExp(AFTER_IM_GONE) }))
    await user.click(screen.getByRole('button', { name: 'Save this letter' }))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/passon/items', expect.objectContaining({
        kind: 'LETTER',
        releaseWhen: 'AFTER',
      }))
    })
  })

  it('keeps a held letter held when she comes back and fixes a typo', async () => {
    const user = userEvent.setup()
    mockGet({
      letters: [{
        id: 'e1', kind: 'LETTER', title: 'For Sarah', body: 'You were always the brave one.',
        audience: 'PERSON', audienceUserId: SARAH, audienceUserName: 'Sarah',
        releaseWhen: 'AFTER', firstReadAt: null,
      }],
    })
    renderLetters()
    await user.click(await screen.findByRole('button', { name: 'Change' }))

    expect(screen.getByRole('radio', { name: new RegExp(AFTER_IM_GONE) }))
      .toHaveAttribute('aria-checked', 'true')

    await user.click(screen.getByRole('button', { name: 'Save this letter' }))
    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith('/passon/items/e1', expect.objectContaining({
        releaseWhen: 'AFTER',
      }))
    })
  })

  it('never offers it on a story, which is for people to read now', async () => {
    const user = userEvent.setup()
    mockGet()
    render(
      <MemoryRouter initialEntries={['/what-i-pass-on']}>
        <PassOn />
      </MemoryRouter>,
    )
    await user.click(await screen.findByRole('button', { name: 'Tell a story' }))
    expect(screen.queryByRole('radio', { name: new RegExp(AFTER_IM_GONE) })).not.toBeInTheDocument()
  })
})

describe('when she has no Keyholders yet', () => {
  it('shows the choice disabled with the reason, and never hides it', async () => {
    const user = userEvent.setup()
    mockGet({ setup: noBox })
    renderLetters()
    await writeALetter(user)

    const after = screen.getByRole('radio', { name: new RegExp(AFTER_IM_GONE) })
    expect(after).toBeInTheDocument()
    expect(after).toBeDisabled()
    expect(screen.getByText(
      'First choose the people who can open things for you, in your Sealed box. Then you can '
      + 'hold a letter until after you are gone.',
    )).toBeInTheDocument()
  })

  it('takes her to the Sealed box from the reason', async () => {
    const user = userEvent.setup()
    mockGet({ setup: noBox })
    renderLetters()
    await writeALetter(user)

    await user.click(screen.getByRole('button', { name: 'Go to my Sealed box' }))
    expect(await screen.findByRole('tab', { name: 'Sealed box' })).toHaveAttribute('aria-selected', 'true')
  })

  it('cannot be talked into sending AFTER by tapping the disabled option', async () => {
    const user = userEvent.setup()
    mockGet({ setup: noBox })
    renderLetters()
    await writeALetter(user)

    await user.click(screen.getByRole('radio', { name: new RegExp(AFTER_IM_GONE) }))
    await user.click(screen.getByRole('button', { name: 'Save this letter' }))
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/passon/items', expect.objectContaining({
        releaseWhen: 'NOW',
      }))
    })
  })

  it('still lets her change a letter she is already holding', async () => {
    // She armed her box, wrote a held letter, then undid the setup. The choice is
    // hers to keep — silently turning her last words into a letter for today would
    // be the worst thing this form could do.
    const user = userEvent.setup()
    mockGet({
      setup: noBox,
      letters: [{
        id: 'e1', kind: 'LETTER', title: 'For Sarah', body: 'Look after the garden.',
        audience: 'PERSON', audienceUserId: SARAH, audienceUserName: 'Sarah',
        releaseWhen: 'AFTER', firstReadAt: null,
      }],
    })
    renderLetters()
    await user.click(await screen.findByRole('button', { name: 'Change' }))

    const after = screen.getByRole('radio', { name: new RegExp(AFTER_IM_GONE) })
    expect(after).toHaveAttribute('aria-checked', 'true')
    expect(after).not.toBeDisabled()
  })
})

describe('what the page says about letters now', () => {
  it('no longer claims the after-you-are-gone part is unbuilt', async () => {
    const user = userEvent.setup()
    mockGet()
    renderLetters()
    await screen.findByRole('button', { name: 'Write a letter' })
    expect(screen.queryByText(/still building/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/until we are sure it works/i)).not.toBeInTheDocument()

    // And the words that replaced it describe what really happens.
    expect(screen.getByText(/Every letter can be read today, or held until after you are gone\./))
      .toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Write a letter' }))
  })

  it('has no "still building" sentence left anywhere in the words this feature ships', () => {
    // passOnLocks is the single source of this feature's copy. If the old promise
    // survives anywhere in it, it survives in the bundle.
    const said = JSON.stringify(locks, (_key, value) =>
      typeof value === 'function' ? '' : value)
    expect(said).not.toMatch(/still building/i)
    expect(said).not.toMatch(/we will not offer it/i)
  })
})

describe('a letter card says which kind it is', () => {
  it('marks a held letter as held and a today letter as readable now', async () => {
    mockGet({
      letters: [
        {
          id: 'e1', kind: 'LETTER', title: 'For Sarah', body: 'You were always the brave one.',
          audience: 'PERSON', audienceUserId: SARAH, audienceUserName: 'Sarah',
          releaseWhen: 'NOW', firstReadAt: null,
        },
        {
          id: 'e2', kind: 'LETTER', title: 'For David', body: 'Look after the garden.',
          audience: 'PERSON', audienceUserId: 'bbbb', audienceUserName: 'David',
          releaseWhen: 'AFTER', firstReadAt: null,
        },
      ],
    })
    renderLetters()

    expect(await screen.findByText('They can read this now')).toBeInTheDocument()
    expect(screen.getByText('Held until after you are gone')).toBeInTheDocument()
  })
})
