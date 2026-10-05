import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BALANCE } from '../engine/balance'
import { createRng } from '../engine/rng'
import { ELO, eloUpdate, expectedScore, kFactor, scoreOf } from '../server/elo'
import { respondChallenge, sendChallenge, submitBracket, type Context } from '../server/handlers'
import { snapshotOf, type PokemonSnapshot } from '../server/snapshot'
import { LADDER_PAGE_SIZE, describeMine, pageOfPosition, rankLabel, rankLadder, type RawRow } from '../game/standings'
import { MemoryDb } from './memoryDb'
import { data, mon } from './helpers'

describe('ELO', () => {
  it('uses the standard expected score', () => {
    expect(expectedScore(1000, 1000)).toBeCloseTo(0.5, 10)
    expect(expectedScore(1400, 1000)).toBeCloseTo(1 / (1 + 10 ** (-1)), 10)
    expect(expectedScore(1000, 1400)).toBeCloseTo(1 / (1 + 10), 10)
    expect(expectedScore(1200, 1000) + expectedScore(1000, 1200)).toBeCloseTo(1, 10)
  })

  it('changes the rating up for a win, down for a loss and by the expected difference for a draw', () => {
    // Two new players on 1000: K 32 for the sender, half K (16) for the opponent.
    const win = eloUpdate({ rating: 1000, games: 0 }, { rating: 1000, games: 0 }, scoreOf('a'))
    expect(win).toMatchObject({ changeA: 16, changeB: -8, ratingA: 1016, ratingB: 992 })
    const loss = eloUpdate({ rating: 1000, games: 0 }, { rating: 1000, games: 0 }, scoreOf('b'))
    expect(loss).toMatchObject({ changeA: -16, changeB: 8 })
    const draw = eloUpdate({ rating: 1000, games: 0 }, { rating: 1000, games: 0 }, scoreOf('draw'))
    expect(draw).toMatchObject({ changeA: 0, changeB: 0 })
    // A draw against a stronger player gains, against a weaker one loses.
    expect(eloUpdate({ rating: 1000, games: 0 }, { rating: 1400, games: 0 }, 0.5).changeA).toBeGreaterThan(0)
    expect(eloUpdate({ rating: 1400, games: 0 }, { rating: 1000, games: 0 }, 0.5).changeA).toBeLessThan(0)
  })

  it('gives the player whose team was used only half K', () => {
    const r = eloUpdate({ rating: 1000, games: 20 }, { rating: 1000, games: 20 }, 1)
    expect(r.changeA).toBe(10) // K 20 * 0.5
    expect(r.changeB).toBe(-5) // K 20 * 0.5 * half
    expect(ELO.OPPONENT_K_SHARE).toBe(0.5)
  })

  it('switches from K 32 to K 20 after the first 10 matches in a bracket', () => {
    expect(kFactor(0)).toBe(32)
    expect(kFactor(9)).toBe(32)
    expect(kFactor(10)).toBe(20)
    const young = eloUpdate({ rating: 1000, games: 9 }, { rating: 1000, games: 50 }, 1)
    const old = eloUpdate({ rating: 1000, games: 10 }, { rating: 1000, games: 50 }, 1)
    expect(young.changeA).toBe(16)
    expect(old.changeA).toBe(10)
  })

  it('gains more for beating a stronger player than a weaker one (zero-sum before the half K)', () => {
    const up = eloUpdate({ rating: 1000, games: 20 }, { rating: 1300, games: 20 }, 1).changeA
    const down = eloUpdate({ rating: 1300, games: 20 }, { rating: 1000, games: 20 }, 1).changeA
    expect(up).toBeGreaterThan(down)
  })
})

describe('ratings in the matches', () => {
  const team = (tag: string, level = 25): PokemonSnapshot[] => ['charizard', 'blastoise', 'venusaur'].map((n, i) => ({ ...snapshotOf(mon(n, level)), uid: `${tag}-${i}` }))
  const ctx = (db: MemoryDb, userId: string, seed: number): Context => ({ userId, now: db.now, data, balance: BALANCE, rng: createRng(seed) })

  it('updates both players in the bracket, the sender with full K and the other with half, and counts the games', async () => {
    const db = new MemoryDb()
    db.addPlayer('u1', 'Anna', 1452)
    db.addPlayer('u2', 'Bo', 2210)
    await submitBracket(db, ctx(db, 'u1', 1), { bracket: '20-29', team: team('a') })
    const played = await submitBracket(db, ctx(db, 'u2', 2), { bracket: '20-29', team: team('b') })
    expect(played).toMatchObject({ ok: true, status: 'played' })
    const m = db.matches[0]
    expect(m.ratingChangeA).not.toBeNull()
    expect(m.ratingChangeB).not.toBeNull()
    expect(db.ratings.get('u2:20-29')).toBe(1000 + (m.ratingChangeA as number))
    expect(db.ratings.get('u1:20-29')).toBe(1000 + (m.ratingChangeB as number))
    expect(db.games.get('u1:20-29')).toBe(1)
    expect(db.games.get('u2:20-29')).toBe(1)
    if (m.result === 'a') expect([m.ratingChangeA, m.ratingChangeB]).toEqual([16, -8])
    else if (m.result === 'b') expect([m.ratingChangeA, m.ratingChangeB]).toEqual([-16, 8])
    else expect([m.ratingChangeA, m.ratingChangeB]).toEqual([0, 0])
    if ('ratingChange' in played) expect(played.ratingChange).toBe(m.ratingChangeA)
  })

  it('never changes a rating for challenges', async () => {
    const db = new MemoryDb()
    db.addPlayer('u1', 'Anna', 1452)
    db.addPlayer('u2', 'Bo', 2210)
    await sendChallenge(db, ctx(db, 'u1', 1), { toTag: 2210, bracket: 'free', team: team('a') })
    await respondChallenge(db, ctx(db, 'u2', 2), { challengeId: db.challenges[0].id, accept: true, team: team('b') })
    expect(db.matches[0].ratingChangeA).toBeNull()
    expect(db.ratings.size).toBe(0)
    expect(db.games.size).toBe(0)
  })
})

describe('the ladder', () => {
  const row = (userId: string, rating: number, games: number): RawRow => ({ userId, displayName: userId, tag: 1000, rating, games, wins: 0, losses: 0, draws: 0 })

  it('places players with at least 3 matches by rating, ties share a place, the others come after as not placed', () => {
    const ladder = rankLadder([row('a', 1100, 5), row('b', 1200, 3), row('c', 1100, 9), row('d', 1500, 2), row('e', 900, 1), row('f', 1300, 12)])
    expect(ladder.map(r => [r.userId, r.rank, r.position])).toEqual([
      ['f', 1, 1], ['b', 2, 2], ['c', 3, 3], ['a', 3, 4], // equal ratings (a, c) share place 3
      ['d', null, 5], ['e', null, 6],
    ])
    expect(rankLabel(ladder[0])).toBe('#1')
    expect(rankLabel(ladder[4])).toBe('Ej placerad')
  })

  it('finds the page of a position, 50 per page', () => {
    expect(LADDER_PAGE_SIZE).toBe(50)
    expect([1, 50, 51, 100, 101].map(p => pageOfPosition(p))).toEqual([0, 0, 1, 1, 2])
  })

  it('describes the player\'s own standing or that they have no matches', () => {
    const ladder = rankLadder([row('me', 1234, 5), row('x', 1100, 4)])
    expect(describeMine(null)).toEqual(['Inga matcher än.'])
    expect(describeMine(ladder[0], 2)).toEqual(['Din placering: 1 av 2', 'Rating 1234 · 0 vinster, 0 förluster, 0 oavgjorda'])
    const fresh = rankLadder([row('new', 1016, 1)])[0]
    expect(describeMine(fresh)[0]).toBe('Ej placerad (2 matcher till)')
  })

  it('has server functions that count the places over the whole ladder for the caller only', () => {
    const sql = readFileSync(new URL('../../supabase/migrations/0017_nudge_standings.sql', import.meta.url), 'utf8')
    expect(sql).toContain('create or replace function public.nudge_standings')
    expect(sql).toContain('create or replace function public.nudge_my_standing')
    expect(sql).toContain('security invoker')
    expect(sql).toContain('r.games >= 3')
    expect(sql).toContain('rank() over')
    expect(sql).toContain('auth.uid()')
    expect(sql).not.toMatch(/create table|alter table|drop /i)
    expect(sql).toContain('grant execute on function public.nudge_standings')
  })
})
