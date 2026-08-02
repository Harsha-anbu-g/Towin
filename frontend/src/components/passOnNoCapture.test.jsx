// Session replay records the rendered page. Left alone it would produce a video of an
// elderly woman reading the letter she wrote to her dead husband, held on a third-party
// analytics service, watchable by anyone with a PostHog login.
//
// So every element that renders words she wrote carries the marker PostHog blocks. This
// file is the guard on that: it asserts against the words themselves rather than against
// a `className=` in the source, so a card that is restructured later either keeps the
// protection or fails here.
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NO_CAPTURE } from '../lib/analytics'
import PassOnItemCard from './PassOnItemCard'
import PassOnReadCard from './PassOnReadCard'
import SealedItemCard from './SealedItemCard'

const STORY = {
  id: 's1',
  kind: 'STORY',
  title: 'The winter we lost the roof',
  body: 'Your father climbed up in the snow with a tarpaulin and two bricks.',
  audience: 'ANYONE',
}

const LETTER = {
  id: 'l1',
  kind: 'LETTER',
  title: 'For Sarah',
  body: 'I never told you why I kept the blue tin. It was your grandmother’s.',
  audience: 'PERSON',
  audienceUserName: 'Sarah',
  firstReadAt: '2026-06-03T09:00:00',
}

/** The words are hidden from the recording only if some ancestor carries the marker. */
const isHidden = (element) => element.closest(`.${NO_CAPTURE}`) !== null

describe('her own page', () => {
  it('hides the words of a story from the recording', () => {
    render(<PassOnItemCard item={STORY} onChange={() => {}} onRemove={() => {}} />)

    expect(isHidden(screen.getByText(STORY.body))).toBe(true)
    expect(isHidden(screen.getByText(STORY.title))).toBe(true)
  })

  it('hides the words of a letter from the recording', () => {
    render(<PassOnItemCard item={LETTER} onChange={() => {}} onRemove={() => {}} />)

    expect(isHidden(screen.getByText(LETTER.body))).toBe(true)
    expect(isHidden(screen.getByText(LETTER.title))).toBe(true)
  })

  it('leaves the buttons visible in the recording', () => {
    // Precise redaction, not a black rectangle over the page: whether she can find
    // [Change] is exactly what replay is for, and none of her words are in the word
    // "Change".
    render(<PassOnItemCard item={STORY} onChange={() => {}} onRemove={() => {}} />)

    expect(isHidden(screen.getByRole('button', { name: 'Change' }))).toBe(false)
    expect(isHidden(screen.getByRole('button', { name: 'Remove' }))).toBe(false)
  })
})

describe('her sealed box', () => {
  // The most sensitive string in the product. `maskAllInputs` masks what she types
  // into the password field and does nothing whatever to the decrypted answer that
  // comes back, so without the marker session replay would hold a video of an elderly
  // woman reading out where her money is — on a third-party service, watchable by
  // anyone with a login to it.
  const ITEM = { id: 'i1', label: 'Where the money is', kindHint: 'MONEY' }
  const SECRET = 'The Barclays account at the Halifax branch, and the key is under the third flowerpot.'

  const cardProps = {
    item: ITEM,
    onRemove: () => {},
    onReveal: () => Promise.resolve({ ...ITEM, body: SECRET }),
  }

  it('hides the name she gave it from the recording', () => {
    // The name is encrypted in the database precisely because "Where the cash is
    // hidden", attached to a named elderly person at a known address, is a burglary
    // list. Handing the same sentence to session replay would undo that.
    render(<SealedItemCard {...cardProps} />)

    expect(isHidden(screen.getByText(ITEM.label))).toBe(true)
  })

  it('hides the words it was hiding, once they are on the screen', async () => {
    const user = userEvent.setup()
    render(<SealedItemCard {...cardProps} />)

    await user.click(screen.getByRole('button', { name: 'See this' }))
    await user.type(screen.getByLabelText('Your password'), 'rosebush22')
    await user.click(screen.getByRole('button', { name: 'Show it to me' }))

    expect(isHidden(await screen.findByText(SECRET))).toBe(true)
  })

  it('leaves the chip and the buttons visible in the recording', () => {
    // Precise redaction, not a black rectangle over the page. Whether she can find
    // [See this] is exactly what replay is for, and "Money" carries no name, no
    // address and no amount.
    render(<SealedItemCard {...cardProps} />)

    expect(isHidden(screen.getByRole('button', { name: 'See this' }))).toBe(false)
    expect(isHidden(screen.getByText('Money'))).toBe(false)
    expect(isHidden(screen.getByText('Locked'))).toBe(false)
  })
})

describe('the page one visitor reads', () => {
  const props = {
    reportOpen: false,
    reportSent: false,
    reportError: '',
    sending: false,
    onOpenReport: () => {},
    onCancelReport: () => {},
    onSendReport: () => {},
  }

  it('hides the words of a story from the recording', () => {
    render(<PassOnReadCard item={STORY} {...props} />)

    expect(isHidden(screen.getByText(STORY.body))).toBe(true)
    expect(isHidden(screen.getByText(STORY.title))).toBe(true)
  })

  it('hides the words of a letter from the recording', () => {
    render(<PassOnReadCard item={LETTER} {...props} />)

    expect(isHidden(screen.getByText(LETTER.body))).toBe(true)
    expect(isHidden(screen.getByText(LETTER.title))).toBe(true)
  })
})
