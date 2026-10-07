// The translation layer itself: lookup, fallback, placeholders, switching,
// and the language picker. Same rules as the iPhone app's.
import { describe, it, expect, afterEach } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  __setLanguageForTests,
  browserLanguage,
  currentLanguage,
  dateLocale,
  translate,
  tr,
  useLanguage,
} from '.'
import emphasize from './emphasize'
import LanguagePicker from '../components/LanguagePicker'

afterEach(() => __setLanguageForTests('en'))

describe('tr', () => {
  it('passes English through untouched', () => {
    expect(tr('Log out')).toBe('Log out')
  })

  it('gives a known sentence in the chosen language', () => {
    expect(translate('Log out', undefined, 'fr')).toBe('Se déconnecter')
    expect(translate('Log out', undefined, 'ta')).toBe('வெளியேறு')
  })

  it('falls back to English, never to a blank or a key', () => {
    expect(translate('A sentence nobody translated', undefined, 'fr')).toBe('A sentence nobody translated')
  })

  it('fills placeholders wherever the translation puts them', () => {
    expect(translate('Message {firstName}', { firstName: 'Nina' }, 'en')).toBe('Message Nina')
    expect(translate('Message {firstName}', { firstName: 'Nina' }, 'fr')).toBe('Écrire à Nina')
  })

  it('leaves a placeholder with no value visible rather than dropping it', () => {
    expect(translate('Message {firstName}', {}, 'en')).toBe('Message {firstName}')
  })
})

describe('dateLocale', () => {
  it('follows the chosen language, and English keeps the browser or page locale', () => {
    expect(dateLocale()).toBeUndefined()
    expect(dateLocale('en-GB')).toBe('en-GB')
    __setLanguageForTests('fr')
    expect(dateLocale('en-GB')).toBe('fr-CA')
    __setLanguageForTests('ta')
    expect(dateLocale()).toBe('ta-IN')
  })
})

it('reads the browser language as one the site speaks, or English', () => {
  expect(['en', 'fr', 'ta']).toContain(browserLanguage())
})

it('re-renders anyone listening when the language changes', () => {
  function Probe() {
    useLanguage()
    return <p>{tr('Log out')}</p>
  }
  render(<Probe />)
  expect(screen.getByText('Log out')).toBeInTheDocument()
  act(() => __setLanguageForTests('fr'))
  expect(currentLanguage()).toBe('fr')
  expect(screen.getByText('Se déconnecter')).toBeInTheDocument()
})

it('emphasize keeps one sentence and draws the marked part wherever it lands', () => {
  __setLanguageForTests('fr')
  const { container } = render(
    <p>{emphasize(tr('Your *Trust* Score'), (part) => <em>{part}</em>)}</p>
  )
  expect(container.textContent).toBe('Votre score de confiance')
  expect(container.querySelector('em').textContent).toBe('confiance')
})

describe('LanguagePicker', () => {
  it('names each language in its own words, with the current one checked', () => {
    render(<LanguagePicker />)
    expect(screen.getByRole('radiogroup', { name: 'Language' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'English' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Français' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('radio', { name: 'தமிழ்' })).toBeInTheDocument()
  })

  it('switches the whole site and remembers the choice in this browser', async () => {
    render(<LanguagePicker />)
    await userEvent.click(screen.getByRole('radio', { name: 'Français' }))
    await waitFor(() => expect(currentLanguage()).toBe('fr'))
    expect(localStorage.getItem('towinly-language')).toBe('fr')
    expect(document.documentElement.lang).toBe('fr')
    expect(screen.getByRole('radiogroup', { name: 'Langue' })).toBeInTheDocument()
    localStorage.removeItem('towinly-language')
  })
})
