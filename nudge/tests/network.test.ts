import { describe, expect, it } from 'vitest'
import { describeInboxChallenge, describeInboxMatch, eligibility, eligibleCount, errorLines, matchHeadline, moveInSelection, outcomeFor, ratingText, submitLines, toggleSelection, unseenCount, challengeSentLines, respondLines } from '../game/network'

describe('the network menu logic', () => {
  it('says which Pokémon fit a bracket and why not', () => {
    expect(eligibility({ level: 25 }, '20-29')).toEqual({ ok: true })
    expect(eligibility({ level: 19 }, '20-29')).toMatchObject({ ok: false, reason: expect.stringContaining('För låg nivå') })
    expect(eligibility({ level: 30 }, '20-29')).toMatchObject({ ok: false, reason: expect.stringContaining('För hög nivå') })
    expect(eligibility({ level: 100 }, '100').ok).toBe(true)
    expect(eligibility({ level: 100 }, 'free').ok).toBe(true)
    expect(eligibility({ level: 5 }, 'nope').ok).toBe(false)
    expect(eligibleCount([{ level: 5 }, { level: 25 }, { level: 28 }], '20-29')).toBe(2)
  })

  it('builds the line-up in the order Pokémon are picked, with at most three and a way to reorder', () => {
    let sel: string[] = []
    sel = toggleSelection(sel, 'a')
    sel = toggleSelection(sel, 'b')
    sel = toggleSelection(sel, 'c')
    expect(sel).toEqual(['a', 'b', 'c'])
    expect(toggleSelection(sel, 'd')).toEqual(['a', 'b', 'c'])
    expect(toggleSelection(sel, 'b')).toEqual(['a', 'c'])
    expect(moveInSelection(sel, 2, -1)).toEqual(['a', 'c', 'b'])
    expect(moveInSelection(sel, 0, -1)).toEqual(sel)
    expect(moveInSelection(sel, 2, 1)).toEqual(sel)
  })

  it('reads the result of a match from the player\'s point of view', () => {
    expect(outcomeFor('a', 'me', 'me')).toBe('win')
    expect(outcomeFor('b', 'me', 'me')).toBe('loss')
    expect(outcomeFor('a', 'other', 'me')).toBe('loss')
    expect(outcomeFor('b', 'other', 'me')).toBe('win')
    expect(outcomeFor('draw', 'me', 'me')).toBe('draw')
  })

  it('writes the results in Swedish with the opponent as Name #id', () => {
    const opponent = { userId: 'x', displayName: 'Anna', tag: 1452 }
    expect(matchHeadline({ winner: 'you', opponent, reason: 'faint' })).toBe('Du vann mot Anna #1452!')
    expect(matchHeadline({ winner: 'opponent', opponent, reason: 'faint' })).toBe('Du förlorade mot Anna #1452.')
    expect(matchHeadline({ winner: 'draw', opponent, reason: 'timeout' })).toBe('Oavgjort mot Anna #1452.')
    expect(ratingText(12)).toBe('Rating +12')
    expect(ratingText(-7)).toBe('Rating -7')
    expect(ratingText(null)).toBe('')
    expect(submitLines({ ok: true, status: 'waiting', message: 'Ingen motståndare än' })).toEqual(['Ingen motståndare än'])
    expect(submitLines({ ok: true, status: 'played', matchId: 'm', winner: 'you', opponent, reason: 'timeout', ratingChange: 9 })).toEqual(['Du vann mot Anna #1452!', 'Tiden tog slut: den med mest HP kvar vann.', 'Rating +9'])
    expect(challengeSentLines({ ok: true, challengeId: 'c', opponent })[0]).toBe('Utmaningen skickades till Anna #1452.')
    expect(respondLines({ ok: true, status: 'declined' })).toEqual(['Du avböjde utmaningen.'])
  })

  it('shows every reason the server gave when a team is refused, and the plain error for a wrong id', () => {
    const refused = { ok: false as const, status: 400, code: 'invalid-team', message: 'Laget är inte giltigt.', errors: ['Pokémon 1: nivå 35'] }
    expect(submitLines(refused)).toEqual(['Laget är inte giltigt.', 'Pokémon 1: nivå 35'])
    expect(errorLines({ ok: false, message: 'Ingen spelare har ID #9999.' })).toEqual(['Ingen spelare har ID #9999.'])
  })

  it('describes the inbox and counts what is new', () => {
    const from = { displayName: 'Bo', tag: 2210 }
    expect(describeInboxChallenge({ id: 'c', from, bracket: '20-29', createdAt: 1, expiresAt: 2 })).toBe('Bo #2210 utmanar dig (Nivå 20-29)')
    expect(describeInboxMatch({ id: 'm', kind: 'bracket', bracket: '100', createdAt: 5, opponent: from, outcome: 'win', ratingChange: 14 })).toBe('Bracket Nivå 100: Vinst mot Bo #2210 (Rating +14)')
    expect(describeInboxMatch({ id: 'm', kind: 'challenge', bracket: 'free', createdAt: 5, opponent: from, outcome: 'loss', ratingChange: null })).toBe('Utmaning Fri (ingen nivågräns): Förlust mot Bo #2210')
    expect(unseenCount([{ createdAt: 1 }], [{ createdAt: 5 }, { createdAt: 9 }], 6)).toBe(2)
    expect(unseenCount([], [{ createdAt: 5 }], 6)).toBe(0)
  })
})

import { MAPS } from '../game/maps'

describe('the computer in the Pokémon Centers', () => {
  it('stands in every Pokémon Center, in every town', () => {
    const centers = Object.values(MAPS).filter(m => m.name === 'Pokémon Center')
    expect(centers.length).toBeGreaterThanOrEqual(4)
    for (const center of centers) expect(center.npcs.some(n => n.action === 'pc'), `${center.id} has no computer`).toBe(true)
  })
})
