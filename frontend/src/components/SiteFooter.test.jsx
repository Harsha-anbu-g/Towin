// The footer carries Towinly's public profiles. A wrong address here sends
// visitors to someone else's page, so the two links are pinned exactly.
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SiteFooter from './SiteFooter'

describe('SiteFooter', () => {
  it('links to the Towinly Instagram account in a new tab', () => {
    render(<SiteFooter />)
    const link = screen.getByRole('link', { name: 'Instagram' })
    expect(link).toHaveAttribute('href', 'https://www.instagram.com/towinly.trust/')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })

  it('links to the Towinly LinkedIn company page in a new tab', () => {
    render(<SiteFooter />)
    const link = screen.getByRole('link', { name: 'LinkedIn' })
    expect(link).toHaveAttribute('href', 'https://www.linkedin.com/company/towinly/')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })

  it('draws an icon beside each link and hides it from screen readers', () => {
    render(<SiteFooter />)
    for (const name of ['Instagram', 'LinkedIn']) {
      const icon = screen.getByRole('link', { name }).querySelector('svg')
      expect(icon).toBeInTheDocument()
      expect(icon).toHaveAttribute('aria-hidden', 'true')
    }
  })

  it('keeps the copyright line', () => {
    render(<SiteFooter />)
    expect(screen.getByText(/All rights reserved/i)).toBeInTheDocument()
  })
})
