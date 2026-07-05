import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import TrustBadge from './TrustBadge'

describe('TrustBadge', () => {
  it('shows the tier name', () => {
    render(<TrustBadge tier="Reliable" />)
    expect(screen.getByText('Reliable')).toBeInTheDocument()
  })

  it('falls back to New Member when tier is missing', () => {
    render(<TrustBadge />)
    expect(screen.getByText('New Member')).toBeInTheDocument()
  })

  it('falls back to New Member styling for an unknown tier', () => {
    render(<TrustBadge tier="Made Up Tier" />)
    const badge = screen.getByText('Made Up Tier')
    expect(badge).toHaveStyle({ color: 'var(--ink-4)' })
  })

  it('gives Community Champion the green achievement styling', () => {
    render(<TrustBadge tier="Community Champion" />)
    const badge = screen.getByText('Community Champion')
    expect(badge).toHaveStyle({ color: 'var(--green-deep)' })
  })

  it('shows the score next to the tier when provided', () => {
    render(<TrustBadge tier="Reliable" score={72} />)
    expect(screen.getByText('· 72')).toBeInTheDocument()
  })

  it('hides the score separator when score is absent', () => {
    render(<TrustBadge tier="Reliable" />)
    expect(screen.queryByText(/·/)).not.toBeInTheDocument()
  })

  it('still shows a score of 0 (zero is a real score, not "missing")', () => {
    render(<TrustBadge tier="New Member" score={0} />)
    expect(screen.getByText('· 0')).toBeInTheDocument()
  })
})
