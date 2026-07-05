import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import api from './axios'

// axios keeps registered interceptors in a public handlers array; invoking
// them directly lets us test the auth logic without real network calls.
const requestInterceptor = api.interceptors.request.handlers[0]
const responseInterceptor = api.interceptors.response.handlers[0]

function apiError(status, { withToken = true } = {}) {
  return {
    response: { status },
    config: { headers: withToken ? { Authorization: 'Bearer abc' } : {} },
  }
}

describe('request interceptor', () => {
  beforeEach(() => localStorage.clear())

  it('attaches the stored token as a Bearer header', () => {
    localStorage.setItem('token', 'abc123')
    const config = requestInterceptor.fulfilled({ headers: {} })
    expect(config.headers.Authorization).toBe('Bearer abc123')
  })

  it('sends no Authorization header when there is no token', () => {
    const config = requestInterceptor.fulfilled({ headers: {} })
    expect(config.headers.Authorization).toBeUndefined()
  })
})

describe('response interceptor (session handling)', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    localStorage.setItem('token', 'abc123')
    // jsdom starts at '/', which counts as an auth page; move off it.
    window.history.pushState({}, '', '/elder-dashboard')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    window.history.pushState({}, '', '/')
  })

  it('logs out on a 401 from an authenticated request: clears token, flags the reason', async () => {
    // jsdom can't actually navigate; swallow location.assign's side effect.
    await responseInterceptor.rejected(apiError(401)).catch(() => {})
    expect(localStorage.getItem('token')).toBeNull()
    expect(sessionStorage.getItem('sessionExpired')).toBe('1')
  })

  it('does NOT log out on 403 — user is authenticated but lacks an authority', async () => {
    const err = apiError(403)
    await expect(responseInterceptor.rejected(err)).rejects.toBe(err)
    expect(localStorage.getItem('token')).toBe('abc123')
    expect(sessionStorage.getItem('sessionExpired')).toBeNull()
  })

  it('does NOT log out on a 401 from a request that never carried a token', async () => {
    const err = apiError(401, { withToken: false })
    await expect(responseInterceptor.rejected(err)).rejects.toBe(err)
    expect(localStorage.getItem('token')).toBe('abc123')
  })

  it('does NOT redirect-logout while already on an auth page', async () => {
    window.history.pushState({}, '', '/login')
    const err = apiError(401)
    await expect(responseInterceptor.rejected(err)).rejects.toBe(err)
    expect(localStorage.getItem('token')).toBe('abc123')
  })

  it('passes successful responses straight through', () => {
    const res = { status: 200, data: { ok: true } }
    expect(responseInterceptor.fulfilled(res)).toBe(res)
  })
})
