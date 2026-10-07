import { describe, it, expect, beforeEach } from 'vitest'
import {
  attachIdempotencyKey,
  settleIdempotencyKey,
  resetIdempotencyKeys,
  IDEMPOTENCY_HEADER,
} from './idempotency'

const send = (content, extra = {}) => ({
  method: 'post',
  url: '/messages/c1/send',
  data: { content },
  headers: {},
  ...extra,
})

describe('idempotency keys', () => {
  beforeEach(() => resetIdempotencyKeys())

  it('puts a key on every write', () => {
    const config = attachIdempotencyKey(send('Hello'))
    expect(config.headers[IDEMPOTENCY_HEADER]).toMatch(/.{8,}/)
  })

  it('leaves reads alone', () => {
    const config = attachIdempotencyKey({ method: 'get', url: '/messages/c1', headers: {} })
    expect(config.headers[IDEMPOTENCY_HEADER]).toBeUndefined()
  })

  it('reuses the key when the same write is retried after no answer', () => {
    const first = attachIdempotencyKey(send('Thank you'))
    settleIdempotencyKey(first, false) // the reply was lost
    const retry = attachIdempotencyKey(send('Thank you'))
    expect(retry.headers[IDEMPOTENCY_HEADER]).toBe(first.headers[IDEMPOTENCY_HEADER])
  })

  it('gives a new key once the write succeeded, so "ok" twice is two messages', () => {
    const first = attachIdempotencyKey(send('ok'))
    settleIdempotencyKey(first, true)
    const second = attachIdempotencyKey(send('ok'))
    expect(second.headers[IDEMPOTENCY_HEADER]).not.toBe(first.headers[IDEMPOTENCY_HEADER])
  })

  it('gives a different write its own key', () => {
    const a = attachIdempotencyKey(send('one'))
    settleIdempotencyKey(a, false)
    const b = attachIdempotencyKey(send('two'))
    expect(b.headers[IDEMPOTENCY_HEADER]).not.toBe(a.headers[IDEMPOTENCY_HEADER])
  })

  it('treats a retry after ten minutes as a new action', () => {
    const t0 = 1_000_000
    const first = attachIdempotencyKey(send('late'), t0)
    settleIdempotencyKey(first, false)
    const later = attachIdempotencyKey(send('late'), t0 + 11 * 60 * 1000)
    expect(later.headers[IDEMPOTENCY_HEADER]).not.toBe(first.headers[IDEMPOTENCY_HEADER])
  })

  it('skips file uploads, which the server skips too', () => {
    const form = new FormData()
    form.append('file', 'x')
    const config = attachIdempotencyKey({ method: 'put', url: '/profile/photo', data: form, headers: {} })
    expect(config.headers[IDEMPOTENCY_HEADER]).toBeUndefined()
  })
})
