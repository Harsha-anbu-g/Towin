// Neither upload path checked the file size, so an oversized photo travelled all
// the way to the server and came back as a raw 500 the user could not read.
import { describe, it, expect } from 'vitest'
import { MAX_UPLOAD_BYTES, TOO_BIG_MESSAGE, isTooBig } from './uploads'

const fileOf = (bytes) => ({ name: 'photo.jpg', size: bytes })

describe('isTooBig', () => {
  it('accepts a file under the limit', () => {
    expect(isTooBig(fileOf(MAX_UPLOAD_BYTES - 1))).toBe(false)
  })

  it('accepts a file exactly on the limit', () => {
    expect(isTooBig(fileOf(MAX_UPLOAD_BYTES))).toBe(false)
  })

  it('rejects a file over the limit', () => {
    expect(isTooBig(fileOf(MAX_UPLOAD_BYTES + 1))).toBe(true)
  })

  it('treats a missing file as nothing to reject', () => {
    expect(isTooBig(null)).toBe(false)
    expect(isTooBig(undefined)).toBe(false)
  })
})

describe('the limit itself', () => {
  it('matches the server limit of 5MB in application.yml', () => {
    expect(MAX_UPLOAD_BYTES).toBe(5 * 1024 * 1024)
  })

  it('says the size in plain words', () => {
    expect(TOO_BIG_MESSAGE).toMatch(/5 MB/)
  })
})
