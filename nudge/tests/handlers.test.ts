import { describe, expect, it } from 'vitest'
import { BALANCE } from '../engine/balance'
import { createRng } from '../engine/rng'
import { CHALLENGE_EXPIRY_MS, MAX_BRACKET_MATCHES_PER_HOUR, MAX_CHALLENGES_PER_HOUR, MAX_PENDING_CHALLENGES, respondChallenge, sendChallenge, submitBracket, type Context } from '../server/handlers'
import { simulatePvp } from '../server/autopilot'
import { snapshotOf, type PokemonSnapshot } from '../server/snapshot'
import { MemoryDb } from './memoryDb'
import { data, mon } from './helpers'

const team = (level: number, tag = 'a', names = ['charizard', 'blastoise', 'venusaur']): PokemonSnapshot[] => names.map((n, i) => ({ ...snapshotOf(mon(n, level)), uid: `${tag}-${n}-${i}` }))
const ctx = (db: MemoryDb, userId: string, seed = 1): Context => ({ userId, now: db.now, data, balance: BALANCE, rng: createRng(seed) })

function world() {
  const db = new MemoryDb()
  db.addPlayer('u1', 'Anna', 1452)
  db.addPlayer('u2', 'Bo', 2210)
  db.addPlayer('u3', 'Cia', 3001)
  return db
}

describe('sending a team to a bracket', () => {
  it('waits when nobody else has a team there, and plays when the next player sends one in', async () => {
    const db = world()
    const first = await submitBracket(db, ctx(db, 'u1'), { bracket: '20-29', team: team(25, 'u1') })
    expect(first).toMatchObject({ ok: true, status: 'waiting' })
    expect(db.matches).toHaveLength(0)
    expect(db.entries.get('u1:20-29')!.team).toHaveLength(3)

    const second = await submitBracket(db, ctx(db, 'u2'), { bracket: '20-29', team: team(24, 'u2', ['gengar', 'alakazam', 'machamp']) })
    expect(second).toMatchObject({ ok: true, status: 'played', opponent: { displayName: 'Anna', tag: 1452 } })
    expect(db.matches).toHaveLength(1)
    const m = db.matches[0]
    expect(m).toMatchObject({ kind: 'bracket', bracket: '20-29', playerA: 'u2', playerB: 'u1', engineVersion: '1' })
    expect(Array.isArray(m.events) && (m.events as unknown[]).length).toBeGreaterThan(5)
    // The stored seed and teams reproduce the stored result exactly.
    const again = simulatePvp({ data, balance: BALANCE, teamA: m.teamA, teamB: m.teamB, seed: m.seed })
    expect(again.winner).toBe(m.result)
    expect(JSON.stringify(again.events)).toBe(JSON.stringify(m.events))
  })

  it('replaces the player\'s current team in the bracket on a new submission and never matches them against themselves', async () => {
    const db = world()
    await submitBracket(db, ctx(db, 'u1'), { bracket: '10-19', team: team(15, 'one') })
    const again = await submitBracket(db, ctx(db, 'u1', 2), { bracket: '10-19', team: team(16, 'two') })
    expect(again).toMatchObject({ ok: true, status: 'waiting' })
    expect(db.entries.size).toBe(1)
    expect(db.entries.get('u1:10-19')!.team[0].level).toBe(16)
    expect(db.matches).toHaveLength(0)
  })

  it('keeps the brackets apart and refuses invalid teams with the reasons', async () => {
    const db = world()
    await submitBracket(db, ctx(db, 'u1'), { bracket: '20-29', team: team(25) })
    const other = await submitBracket(db, ctx(db, 'u2'), { bracket: '30-39', team: team(35) })
    expect(other).toMatchObject({ status: 'waiting' })
    const bad = await submitBracket(db, ctx(db, 'u2'), { bracket: '30-39', team: team(25) })
    expect(bad).toMatchObject({ ok: false, status: 400, code: 'invalid-team' })
    expect((bad as { errors?: string[] }).errors!.join(' ')).toContain('nivågränsen är 30-39')
    expect(await submitBracket(db, ctx(db, 'u2'), { bracket: 'free', team: team(35) })).toMatchObject({ ok: false, code: 'bad-bracket' })
    expect(await submitBracket(db, ctx(db, 'u2'), { bracket: '99-100', team: team(35) })).toMatchObject({ ok: false, code: 'bad-bracket' })
    expect(await submitBracket(db, ctx(db, 'nobody'), { bracket: '20-29', team: team(25) })).toMatchObject({ ok: false, code: 'no-profile' })
  })

  it('stops at 30 bracket matches per hour', async () => {
    const db = world()
    await submitBracket(db, ctx(db, 'u1'), { bracket: '20-29', team: team(25) })
    for (let i = 0; i < MAX_BRACKET_MATCHES_PER_HOUR; i++) {
      db.now += 1000
      const r = await submitBracket(db, ctx(db, 'u2', i + 1), { bracket: '20-29', team: team(25, 'u2') })
      expect(r).toMatchObject({ ok: true })
    }
    expect(await submitBracket(db, ctx(db, 'u2', 99), { bracket: '20-29', team: team(25, 'u2') })).toMatchObject({ ok: false, status: 429, code: 'rate-limit' })
    db.now += 3600_000 + 40_000
    expect(await submitBracket(db, ctx(db, 'u2', 100), { bracket: '20-29', team: team(25, 'u2') })).toMatchObject({ ok: true })
  })
})

describe('challenges', () => {
  it('sends a challenge by id, the other player accepts with their own team, and both can find the match', async () => {
    const db = world()
    const sent = await sendChallenge(db, ctx(db, 'u1'), { toTag: 2210, bracket: 'free', team: team(60, 'c1') })
    expect(sent).toMatchObject({ ok: true, opponent: { displayName: 'Bo' } })
    expect(db.challenges[0]).toMatchObject({ status: 'pending', fromUser: 'u1', toUser: 'u2', bracket: 'free' })
    const id = db.challenges[0].id
    const accepted = await respondChallenge(db, ctx(db, 'u2', 5), { challengeId: id, accept: true, team: team(7, 'c2', ['gengar', 'alakazam', 'machamp']) })
    expect(accepted).toMatchObject({ ok: true, status: 'accepted', opponent: { displayName: 'Anna' } })
    expect(db.matches).toHaveLength(1)
    expect(db.matches[0]).toMatchObject({ kind: 'challenge', bracket: 'free', playerA: 'u1', playerB: 'u2', ratingChangeA: null, ratingChangeB: null })
    expect(db.challenges[0]).toMatchObject({ status: 'accepted', matchId: db.matches[0].id })
    // Challenges never touch ratings.
    expect(db.ratings.size).toBe(0)
  })

  it('declines, and the answerer must be the one who was challenged', async () => {
    const db = world()
    await sendChallenge(db, ctx(db, 'u1'), { toTag: 2210, bracket: '20-29', team: team(25) })
    const id = db.challenges[0].id
    expect(await respondChallenge(db, ctx(db, 'u3'), { challengeId: id, accept: true, team: team(25) })).toMatchObject({ ok: false, code: 'unknown-challenge' })
    expect(await respondChallenge(db, ctx(db, 'u2'), { challengeId: id, accept: false })).toEqual({ ok: true, status: 'declined' })
    expect(db.challenges[0].status).toBe('declined')
    expect(await respondChallenge(db, ctx(db, 'u2'), { challengeId: id, accept: true, team: team(25) })).toMatchObject({ ok: false, code: 'already-answered' })
  })

  it('needs a team inside the challenge\'s bracket to accept', async () => {
    const db = world()
    await sendChallenge(db, ctx(db, 'u1'), { toTag: 2210, bracket: '20-29', team: team(25) })
    const result = await respondChallenge(db, ctx(db, 'u2'), { challengeId: db.challenges[0].id, accept: true, team: team(50) })
    expect(result).toMatchObject({ ok: false, code: 'invalid-team' })
    expect(db.matches).toHaveLength(0)
    expect(db.challenges[0].status).toBe('pending')
  })

  it('expires after 7 days', async () => {
    const db = world()
    await sendChallenge(db, ctx(db, 'u1'), { toTag: 2210, bracket: 'free', team: team(25) })
    db.now += CHALLENGE_EXPIRY_MS + 1
    const result = await respondChallenge(db, ctx(db, 'u2'), { challengeId: db.challenges[0].id, accept: true, team: team(25) })
    expect(result).toMatchObject({ ok: false, status: 410, code: 'expired' })
    expect(db.challenges[0].status).toBe('expired')
  })

  it('refuses unknown ids, yourself, bad brackets and invalid teams with clear messages', async () => {
    const db = world()
    expect(await sendChallenge(db, ctx(db, 'u1'), { toTag: 9999, bracket: 'free', team: team(25) })).toMatchObject({ ok: false, code: 'unknown-player', message: 'Ingen spelare har ID #9999.' })
    expect(await sendChallenge(db, ctx(db, 'u1'), { toTag: 1452, bracket: 'free', team: team(25) })).toMatchObject({ ok: false, code: 'self' })
    expect(await sendChallenge(db, ctx(db, 'u1'), { toTag: 'abc', bracket: 'free', team: team(25) })).toMatchObject({ ok: false, code: 'bad-id' })
    expect(await sendChallenge(db, ctx(db, 'u1'), { toTag: 2210, bracket: 'nope', team: team(25) })).toMatchObject({ ok: false, code: 'bad-bracket' })
    expect(await sendChallenge(db, ctx(db, 'u1'), { toTag: 2210, bracket: '20-29', team: team(25).slice(0, 2) })).toMatchObject({ ok: false, code: 'invalid-team' })
    expect(db.challenges).toHaveLength(0)
  })

  it('limits unanswered outgoing challenges to 10 and challenges per hour to 20', async () => {
    const db = world()
    for (let i = 0; i < MAX_PENDING_CHALLENGES; i++) expect(await sendChallenge(db, ctx(db, 'u1'), { toTag: 2210, bracket: 'free', team: team(25) })).toMatchObject({ ok: true })
    expect(await sendChallenge(db, ctx(db, 'u1'), { toTag: 3001, bracket: 'free', team: team(25) })).toMatchObject({ ok: false, code: 'too-many-pending' })
    // Answer them all, then the hourly limit counts what was sent.
    for (const c of db.challenges) await respondChallenge(db, ctx(db, 'u2'), { challengeId: c.id, accept: false })
    for (let i = 0; i < MAX_CHALLENGES_PER_HOUR - MAX_PENDING_CHALLENGES; i++) {
      await sendChallenge(db, ctx(db, 'u1'), { toTag: 2210, bracket: 'free', team: team(25) })
      db.challenges[db.challenges.length - 1].status = 'declined'
    }
    expect(await sendChallenge(db, ctx(db, 'u1'), { toTag: 2210, bracket: 'free', team: team(25) })).toMatchObject({ ok: false, code: 'rate-limit' })
  })
})
