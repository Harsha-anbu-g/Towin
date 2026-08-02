// The Terms of Service and the Privacy Policy, after they were rewritten to describe what
// Towinly actually does with what a person writes down to be read after they die.
//
// Three things here are regressions waiting to happen, and each has a test of its own:
//
//   1. The terms told every single person who signed up "This is a placeholder document.
//      Final terms will be reviewed by counsel before launch." — inside the document they
//      were ticking a box against.
//   2. Both pages named support@ and privacy@ on a reserved domain that can never receive
//      mail, including in the sentence telling somebody where to write to have their data
//      deleted. There is no screen in the app that exports or deletes an account, so that
//      sentence is the only route there is.
//   3. Neither page mentioned death at all, on a product that holds letters written to be
//      read afterwards.
import { describe, it, expect, vi } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Terms from './Terms'
import Privacy from './Privacy'
import Register from './Register'
import { termsSections, privacySections, DRAFT } from '../lib/legalCopy'
import { LEGAL_CONTACT } from '../lib/legalContact'

vi.mock('../api/axios', () => ({
  default: { post: vi.fn() },
}))

vi.mock('../context/useAuth', () => ({
  useAuth: () => ({ login: vi.fn() }),
}))

const CONFIGURED = 'someone@example.org'

/** Both documents, in both states, as one list of paragraphs to scan. */
const everyParagraph = () => [
  ...termsSections(CONFIGURED),
  ...termsSections(null),
  ...privacySections(CONFIGURED),
  ...privacySections(null),
].map(s => `${s.h} ${s.p}`)

describe('the placeholder document is gone', () => {
  it('no longer calls itself a placeholder or promises a review before launch', () => {
    for (const text of everyParagraph()) {
      expect(text).not.toMatch(/placeholder/i)
      expect(text).not.toMatch(/reviewed by counsel/i)
    }
  })

  it('says instead who wrote it, what is missing, and when', async () => {
    render(<MemoryRouter><Terms /></MemoryRouter>)

    expect(screen.getByText(DRAFT.eyebrow)).toBeInTheDocument()
    expect(screen.getByText(DRAFT.asOf)).toBeInTheDocument()
  })

  it('shows the same notice inside the signup modal, where the placeholder line used to be', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><Register /></MemoryRouter>)

    await user.click(screen.getByRole('button', { name: /terms of service/i }))

    expect(screen.queryByText(/placeholder document/i)).not.toBeInTheDocument()
    expect(screen.getByText(DRAFT.eyebrow)).toBeInTheDocument()
  })
})

describe('no address that cannot receive mail', () => {
  // Built at runtime so the needle itself never appears in this file.
  const RESERVED = ['@towinly', 'example'].join('.')

  const sourceFiles = (dir, found = []) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name.startsWith('.')) continue
      const path = join(dir, name)
      if (statSync(path).isDirectory()) { sourceFiles(path, found); continue }
      if (/\.(jsx?|css|html)$/.test(path)) found.push(path)
    }
    return found
  }

  it('is nowhere in the shipped frontend source', () => {
    // Vitest runs from the frontend root, so this is frontend/src.
    const src = join(process.cwd(), 'src')

    const offenders = sourceFiles(src)
      .filter(path => readFileSync(path, 'utf8').includes(RESERVED))

    expect(offenders).toEqual([])
  })

  it('says plainly that there is no address, on a deployment that has not set one', () => {
    const contact = termsSections(null).at(-1)

    expect(contact.email).toBeUndefined()
    expect(contact.p).toBe(LEGAL_CONTACT.noAddressYet)
  })

  it('tells a person there is no way to ask for a copy or a deletion either', () => {
    const rights = privacySections(null).find(s => /copy of your information/i.test(s.h))

    expect(rights.p).toMatch(/no address set to write to/i)
    expect(rights.p).not.toMatch(/at the bottom of this page/i)
  })

  it('carries the configured address, and only that one, when there is one', () => {
    const contact = privacySections(CONFIGURED).at(-1)

    expect(contact.email).toBe(CONFIGURED)
  })
})

describe('what happens when somebody dies', () => {
  const terms = () => termsSections(CONFIGURED).find(s => /after you are gone/i.test(s.h))
  const privacy = () => privacySections(CONFIGURED).find(s => /after somebody dies/i.test(s.h))

  it('has a section on each page', () => {
    expect(terms()).toBeDefined()
    expect(privacy()).toBeDefined()
  })

  it('promises nothing automatic and nothing on a timer', () => {
    expect(terms().p).toMatch(/nothing on Towinly opens by itself/i)
    expect(terms().p).toMatch(/no timer/i)
    expect(privacy().p).toMatch(/no timer and no automatic step/i)
  })

  it('describes the by-hand release: a person, a certificate, each keyholder, thirty days', () => {
    for (const section of [terms(), privacy()]) {
      expect(section.p).toMatch(/death certificate/i)
      expect(section.p).toMatch(/keyholders/i)
      expect(section.p).toMatch(/separately/i)
      expect(section.p).toMatch(/thirty days/i)
    }
  })

  it('is on the Privacy page a reader can actually reach', () => {
    render(<MemoryRouter><Privacy /></MemoryRouter>)

    expect(screen.getByRole('heading', { name: /after somebody dies/i })).toBeInTheDocument()
  })

  it('says nothing written on Towinly is a will', () => {
    const will = termsSections(CONFIGURED).find(s => /is a will/i.test(s.h))

    expect(will.p).toMatch(/who inherits/i)
    expect(will.p).toMatch(/none of it replaces a will/i)
  })
})

describe('the honest limits of the Sealed box', () => {
  const kept = () => privacySections(CONFIGURED).find(s => /how the Sealed box is kept/i.test(s.h))

  it('does not overclaim: a stolen copy is unreadable, a break-in is not', () => {
    expect(kept().p).toMatch(/stole our records, they could not read a word/i)
    expect(kept().p).toMatch(/broke into the company itself, they could/i)
  })

  it('says the contents are unrecoverable if the key is lost', () => {
    const lost = privacySections(CONFIGURED).find(s => /if the key is ever lost/i.test(s.h))

    expect(lost.p).toMatch(/gone/i)
    expect(lost.p).toMatch(/nobody can get it back, including us/i)
  })
})
