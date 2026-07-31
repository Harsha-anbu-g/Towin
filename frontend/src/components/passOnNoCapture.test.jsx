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
import { NO_CAPTURE } from '../lib/analytics'
import PassOnItemCard from './PassOnItemCard'
import PassOnReadCard from './PassOnReadCard'

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
