// The saved copy, as content rather than as a screen.
//
// This is the one thing in the whole feature that leaves the building: a file in a drawer, read
// by somebody in the week after a death, possibly years after it was made. So it is tested as
// text, not as rendered markup — what matters is the words that end up in the file, in order,
// and the words that must never end up there under any circumstances.
//
// The strongest test in this file is the one that feeds it sealed items carrying a `body`
// anyway. The server does not send one and cannot: SealedItemSummary has no such field. This
// asserts the second line of defence — that nothing on this side would write it out even if a
// future server mistake handed it over.
import { describe, it, expect } from 'vitest'
import { buildSheet, sheetAsText, sheetFileName } from './passOnSheet'
import { RELEASE_CONTACT, SHEET } from './passOnLocks'

const MADE_ON = '2026-08-05T10:00:00'

/** What a deployment that has set SEALED_BOX_RELEASE_CONTACT_EMAIL sends down. */
const RELEASE_EMAIL = 'sealedbox@example.org'

const sheetFor = (over = {}) => buildSheet({
  ownerName: 'Margaret',
  preparedAt: MADE_ON,
  items: [],
  keyholders: [],
  approvalsNeeded: null,
  keyholderTarget: null,
  releaseContactEmail: RELEASE_EMAIL,
  ...over,
})

const textFor = (over = {}) => sheetAsText(sheetFor(over))

const items = [
  { id: 'i1', label: 'Where the money is', kindHint: 'MONEY' },
  { id: 'i2', label: 'The house papers', kindHint: 'PAPERS' },
]

const keyholders = [
  { id: 'k1', personName: 'Sarah', status: 'ACTIVE', respondedAt: '2026-06-02T09:00:00' },
  { id: 'k2', personName: 'David', status: 'INVITED', respondedAt: null },
  { id: 'k3', personName: 'Ruth', status: 'DECLINED', respondedAt: '2026-06-04T09:00:00' },
]

describe('the saved one-page copy', () => {
  it('names what is in the box', () => {
    const text = textFor({ items })

    expect(text).toContain('Where the money is — Money')
    expect(text).toContain('The house papers — Papers')
  })

  it('never writes what any of it says, even if a body is handed to it', () => {
    const withBodies = items.map(item => ({
      ...item,
      body: 'Account 4471 at the credit union on Rue Principale',
    }))

    const text = textFor({ items: withBodies })

    expect(text).toContain('Where the money is')
    expect(text).not.toContain('Account 4471')
    expect(text).not.toContain('credit union')
  })

  it('says who can ask to open it in the same words as her own screen', () => {
    const text = textFor({ keyholders, approvalsNeeded: 2, keyholderTarget: 3 })

    expect(text).toContain('2 of the 3 must agree.')
    expect(text).toContain('Sarah said yes on 2 June')
    expect(text).toContain('David has not answered yet')
    expect(text).toContain('Ruth said no')
  })

  // She took that key back herself. It is not part of who can open the box one day, and a name
  // on this page is a name her family will go and telephone.
  it('leaves out a key she took back herself', () => {
    const text = textFor({
      keyholders: [...keyholders, { id: 'k4', personName: 'Peter', status: 'REMOVED' }],
      approvalsNeeded: 2,
      keyholderTarget: 3,
    })

    expect(text).not.toContain('Peter')
  })

  it('says who to write to and what they will be asked for', () => {
    const text = textFor({ items, keyholders, approvalsNeeded: 2, keyholderTarget: 3 })

    expect(text).toContain(`Write to ${RELEASE_CONTACT.who} at ${RELEASE_EMAIL}.`)
    expect(text).toContain('a death certificate, which a person here reads and writes down')
    expect(text).toContain('word from each of the people above, one at a time, that they agree')
    expect(text).toContain('then a wait of thirty days, while Towinly keeps trying to reach Margaret')
    expect(text).toContain('there is no button anywhere that opens the box')
  })

  // The address is deployment configuration, and a deployment that has not set one must not
  // have an address invented for it here. This file is kept with a will and read by somebody
  // in the week after a death: a plausible-looking mailbox that cannot receive mail takes
  // their letter and gives them no way of finding out it went nowhere.
  it('says plainly that there is no address yet, rather than printing one that does not work', () => {
    const text = textFor({
      items, keyholders, approvalsNeeded: 2, keyholderTarget: 3, releaseContactEmail: null,
    })

    expect(text).toContain(RELEASE_CONTACT.notSetYet)
    expect(text).toContain(SHEET.howToAsk.noAddressYet)
    expect(text).not.toContain('Write to')
    // Nothing anywhere in the file that a grieving family could mistake for an address.
    expect(text).not.toMatch(/@/)
  })

  // An older server, or a payload that lost the field on the way. Same answer: no address.
  it('says the same thing when the payload has no address field at all', () => {
    const text = sheetAsText(buildSheet({ ownerName: 'Margaret', preparedAt: MADE_ON }))

    expect(text).toContain(RELEASE_CONTACT.notSetYet)
    expect(text).not.toMatch(/@/)
  })

  it('ends with "This is not a will."', () => {
    const lines = textFor({ items, keyholders }).trim().split(/\r?\n/)

    expect(lines[lines.length - 1]).toBe('This is not a will.')
  })

  it('carries the day it was made, with the year on it', () => {
    expect(textFor()).toContain('Made on 5 August 2026, from Towinly.')
  })

  it('says plainly when there is nothing in the box and nobody has been asked', () => {
    const text = textFor()

    expect(text).toContain(SHEET.inTheBox.empty)
    expect(text).toContain(SHEET.whoCanOpen.empty)
  })

  // Before she picks a number there is no number. A made-up threshold on a page about her death
  // is the one thing this file must never contain.
  it('leaves the threshold sentence out until she has chosen one', () => {
    const text = textFor({ keyholders })

    expect(text).not.toContain('must agree')
  })

  it('is named so she can find it again in a folder of downloads', () => {
    expect(sheetFileName('Margaret')).toBe('Towinly - what Margaret passes on.txt')
  })

  // A name with a slash in it would otherwise ask the browser to save into a folder.
  it('refuses characters a file name cannot hold', () => {
    expect(sheetFileName('Anne-Marie O"Neill/Roy')).toBe('Towinly - what Anne-Marie ONeillRoy passes on.txt')
  })

  it('uses line endings every computer can read', () => {
    expect(textFor({ items })).toContain('\r\n')
  })
})
