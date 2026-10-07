import { describe, it, expect } from 'vitest'
import { mutualFriendsText } from './mutualFriends'

describe('mutualFriendsText', () => {
  it('says nothing when there is no link', () => {
    expect(mutualFriendsText([], 0)).toBe('')
    expect(mutualFriendsText(undefined)).toBe('')
  })

  it('names family with its own word, then friends', () => {
    expect(mutualFriendsText([
      { name: 'Sarah', relation: 'FAMILY', relationship: 'daughter' },
      { name: 'Grace', relation: 'FRIEND' },
    ], 2)).toBe('You both know Sarah (your daughter) and Grace')
  })

  it('counts the people it could not fit', () => {
    expect(mutualFriendsText([
      { name: 'Grace', relation: 'FRIEND' },
      { name: 'Rose', relation: 'FRIEND' },
      { name: 'Ann', relation: 'FRIEND' },
    ], 5)).toBe('You both know Grace, Rose, Ann and 2 more')
  })

  it('shows a friend of a friend as a link through your friend', () => {
    expect(mutualFriendsText([{ name: 'Tom', relation: 'THROUGH' }], 0)).toBe('Known through Tom')
  })

  it('puts both kinds together', () => {
    expect(mutualFriendsText([
      { name: 'Grace', relation: 'FRIEND' },
      { name: 'Tom', relation: 'THROUGH' },
    ], 1)).toBe('You both know Grace. Also known through Tom')
  })

  it('says the family word in lower case, as in a sentence', () => {
    expect(mutualFriendsText([{ name: 'Sarah', relation: 'FAMILY', relationship: 'Daughter' }], 1))
      .toBe('You both know Sarah (your daughter)')
  })

  it('falls back to "family" when the link has no word', () => {
    expect(mutualFriendsText([{ name: 'Sam', relation: 'FAMILY' }], 1)).toBe('You both know Sam (your family)')
  })
})
