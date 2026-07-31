// PostHog records what people do. This feature is the one place in Towinly where
// what a person does is read their own secrets back to themselves, so the analytics
// configuration is part of the feature's safety and is tested like it.
//
// `maskAllInputs` masks what is typed into a field. It does nothing at all to text
// that has already been rendered to the page — which is exactly what a story, a
// letter and a revealed sealed item are.
import { describe, it, expect } from 'vitest'
import { NO_CAPTURE, PASS_ON_ROUTES, posthogOptions } from './analytics'

describe('the no-capture marker', () => {
  it('is the class PostHog itself looks for', () => {
    // Not a name of our own choosing: posthog-js blocks this class in session replay
    // and refuses to autocapture any element under it. Renaming it silently disarms both.
    expect(NO_CAPTURE).toBe('ph-no-capture')
  })
})

describe('session replay', () => {
  it('blocks anything carrying the marker', () => {
    expect(posthogOptions.session_recording.blockClass).toBe(NO_CAPTURE)
  })

  it('masks the text under the marker as well as blocking it', () => {
    // Belt and braces: blockClass drops the element, maskTextSelector replaces its
    // words. Either alone would be enough; a privacy control on somebody's last
    // words should not rest on one option being spelled right.
    expect(posthogOptions.session_recording.maskTextSelector).toBe(`.${NO_CAPTURE}`)
  })

  it('still masks everything typed into a field', () => {
    expect(posthogOptions.session_recording.maskAllInputs).toBe(true)
  })
})

describe('autocapture', () => {
  const ignored = (url) => posthogOptions.autocapture.url_ignorelist.some(rule => rule.test(url))

  it('is switched off on the elder page', () => {
    expect(ignored('https://www.towinly.com/what-i-pass-on')).toBe(true)
    expect(ignored('https://www.towinly.com/what-i-pass-on?tab=sealed')).toBe(true)
  })

  it('is switched off on the saved copy', () => {
    expect(ignored('https://www.towinly.com/what-i-pass-on/sheet')).toBe(true)
  })

  it('is switched off on the page one visitor reads', () => {
    expect(ignored('https://www.towinly.com/passed-on/42')).toBe(true)
  })

  it('is left on everywhere else', () => {
    expect(ignored('https://www.towinly.com/dashboard')).toBe(false)
    expect(ignored('https://www.towinly.com/messages')).toBe(false)
    expect(ignored('https://www.towinly.com/my-family')).toBe(false)
  })

  it('uses the same list the routes are declared in', () => {
    expect(posthogOptions.autocapture.url_ignorelist).toBe(PASS_ON_ROUTES)
  })
})
