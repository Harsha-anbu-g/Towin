// Regression: ISSUE-002 — one click on SOS sent the alert instantly with no
// confirmation. A misclick (common with tremor) silently alarmed emergency
// contacts. SOS now arms a short cancelable countdown before sending.
// Found by /qa on 2026-07-05
// Report: .gstack/qa-reports/qa-report-localhost-5174-2026-07-05.md
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { StrictMode } from 'react'
import { useSosCountdown } from './useSosCountdown'

describe('useSosCountdown', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('does not send on arm — it starts a 5 second countdown', () => {
    const send = vi.fn()
    const { result } = renderHook(() => useSosCountdown(send))

    act(() => result.current.press())

    expect(send).not.toHaveBeenCalled()
    expect(result.current.countdown).toBe(5)
  })

  it('counts down one per second', () => {
    const send = vi.fn()
    const { result } = renderHook(() => useSosCountdown(send))

    act(() => result.current.press())
    act(() => vi.advanceTimersByTime(2000))

    expect(result.current.countdown).toBe(3)
    expect(send).not.toHaveBeenCalled()
  })

  it('sends exactly once when the countdown reaches zero', () => {
    const send = vi.fn()
    const { result } = renderHook(() => useSosCountdown(send))

    act(() => result.current.press())
    act(() => vi.advanceTimersByTime(5000))

    expect(send).toHaveBeenCalledTimes(1)
    expect(result.current.countdown).toBe(null)
  })

  it('a second press during the countdown cancels — nothing is sent', () => {
    const send = vi.fn()
    const { result } = renderHook(() => useSosCountdown(send))

    act(() => result.current.press())
    act(() => vi.advanceTimersByTime(2000))
    act(() => result.current.press())
    act(() => vi.advanceTimersByTime(10000))

    expect(send).not.toHaveBeenCalled()
    expect(result.current.countdown).toBe(null)
  })

  // Regression: US-015 E2E found the live SOS press firing TWO requests in dev —
  // the second 429'd on the rate limiter. Root cause: send() ran inside the
  // setCountdown updater, which React StrictMode double-invokes. Updaters must
  // stay pure; the send has to live outside them.
  it('sends exactly once under StrictMode (updater must stay pure)', () => {
    const send = vi.fn()
    const { result } = renderHook(() => useSosCountdown(send), { wrapper: StrictMode })

    act(() => result.current.press())
    act(() => vi.advanceTimersByTime(5000))

    expect(send).toHaveBeenCalledTimes(1)
    expect(result.current.countdown).toBe(null)
  })

  it('cleans up its timer on unmount so no send fires later', () => {
    const send = vi.fn()
    const { result, unmount } = renderHook(() => useSosCountdown(send))

    act(() => result.current.press())
    unmount()
    act(() => vi.advanceTimersByTime(10000))

    expect(send).not.toHaveBeenCalled()
  })
})
