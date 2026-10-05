import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BALANCE } from '../engine/balance'
import { BattleEngine } from '../engine/battle'
import { createRng } from '../engine/rng'
import { ENGINE_VERSION } from '../engine/version'
import { simulatePvp } from '../server/autopilot'
import { bracketLabel, bracketOfLevel, bracketRange, BRACKET_IDS, fitsBracket, isBracket } from '../server/brackets'
import { pickOpponent, MATCH_POOL_SIZE } from '../server/matchmaking'
import { buildTeam, legalMoves, snapshotOf, validateTeam, type PokemonSnapshot } from '../server/snapshot'
import { data, mon } from './helpers'

const snap = (name: string, level: number, over: Partial<PokemonSnapshot> = {}): PokemonSnapshot => ({ ...snapshotOf(mon(name, level)), ...over })
const team = (level: number, names = ['charizard', 'blastoise', 'venusaur']) => names.map((n, i) => snap(n, level, { uid: `${n}-${i}` }))
const check = (input: unknown, bracket = '20-29') => validateTeam(data, BALANCE, input, bracket)

describe('brackets', () => {
  it('has the eleven brackets and knows their level ranges', () => {
    expect(BRACKET_IDS).toEqual(['1-9', '10-19', '20-29', '30-39', '40-49', '50-59', '60-69', '70-79', '80-89', '90-99', '100'])
    expect(bracketRange('20-29')).toEqual({ min: 20, max: 29 })
    expect(bracketRange('100')).toEqual({ min: 100, max: 100 })
    expect(bracketRange('free')).toEqual({ min: 1, max: 100 })
    expect(bracketRange('nonsense')).toBeNull()
    expect(isBracket('free')).toBe(true)
    expect(fitsBracket(29, '20-29')).toBe(true)
    expect(fitsBracket(30, '20-29')).toBe(false)
    expect(fitsBracket(99, '100')).toBe(false)
    expect([1, 9, 10, 19, 20, 55, 99, 100].map(bracketOfLevel)).toEqual(['1-9', '1-9', '10-19', '10-19', '20-29', '50-59', '90-99', '100'])
    expect(bracketLabel('100')).toBe('Nivå 100')
  })
})

describe('validating a submitted team', () => {
  it('accepts a good team of three inside the bracket', () => {
    const result = check(team(25))
    expect(result.ok).toBe(true)
  })

  it('rejects the wrong number of Pokémon', () => {
    for (const t of [team(25).slice(0, 2), [...team(25), snap('pidgey', 25, { uid: 'x' })], [], 'hej', null]) {
      const result = check(t)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.errors[0]).toContain('exakt 3')
    }
  })

  it('rejects levels outside the bracket', () => {
    const t = team(25)
    t[1].level = 35
    const result = check(t)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join(' ')).toMatch(/nivå 35.*20-29/)
    expect(check(team(100), '100').ok).toBe(true)
    expect(check(team(99), '100').ok).toBe(false)
    expect(check(team(5), 'free').ok).toBe(true)
  })

  it('rejects moves the species cannot know', () => {
    const t = team(25)
    t[0].moves = ['hydro-pump', 'psychic', 'splash']
    const result = check(t)
    expect(result.ok).toBe(false)
    expect(legalMoves(data, 4, 25).has('ember')).toBe(true)
    expect(legalMoves(data, 6, 40).has('ember')).toBe(true) // Charizard still knows what Charmander learned
    expect(legalMoves(data, 4, 5).has('hydro-pump')).toBe(false)
  })

  it('rejects IVs outside 0-31 and made-up stats', () => {
    const iv = team(25)
    iv[0].ivs = { ...iv[0].ivs, attack: 32 }
    expect(check(iv).ok).toBe(false)
    const negative = team(25)
    negative[2].ivs = { ...negative[2].ivs, speed: -1 }
    expect(check(negative).ok).toBe(false)
    const stats = team(25).map(p => ({ ...p }))
    ;(stats[0] as Record<string, unknown>).stats = { hp: 9999, attack: 9999 }
    const result = check(stats)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join(' ')).toContain('okända fält')
  })

  it('rejects bad nature, trait, trust, held item, species and duplicate instances', () => {
    const base = () => team(25)
    const bad = (mutate: (t: PokemonSnapshot[]) => void) => {
      const t = base()
      mutate(t)
      return check(t).ok
    }
    expect(bad(t => { t[0].nature = 'grumpy' })).toBe(false)
    expect(bad(t => { t[0].trait = 'evil' })).toBe(false)
    expect(bad(t => { t[0].trust = 256 })).toBe(false)
    expect(bad(t => { t[0].trust = -1 })).toBe(false)
    expect(bad(t => { t[0].heldItem = 'master-ball' })).toBe(false)
    expect(bad(t => { t[0].heldItem = 'poke-ball' })).toBe(false)
    expect(bad(t => { t[0].speciesId = 999 })).toBe(false)
    expect(bad(t => { t[1].uid = t[0].uid })).toBe(false)
    expect(bad(t => { t[0].favoriteMove = 'surf' })).toBe(false)
    expect(bad(t => { t[0].heldItem = 'leftovers' })).toBe(true)
  })

  it('computes stats on the server: a snapshot has none, and the built Pokémon come from the species data', () => {
    const t = team(25)
    const built = buildTeam(data, BALANCE, t)
    expect(built).toHaveLength(3)
    expect(built.every(p => p.currentHp > 0 && p.moves.every(m => m.pp === m.maxPp) && !p.status)).toBe(true)
    expect(built[0].uid).toBe('charizard-0')
    expect(Object.keys(t[0])).not.toContain('stats')
  })
})

describe('autopilot matches', () => {
  it('give exactly the same result and event log for the same seed and teams, and differ for another seed', () => {
    const a = team(25)
    const b = team(25, ['gengar', 'alakazam', 'machamp'])
    const one = simulatePvp({ data, balance: BALANCE, teamA: a, teamB: b, seed: 12345 })
    const two = simulatePvp({ data, balance: BALANCE, teamA: a, teamB: b, seed: 12345 })
    expect(JSON.stringify(two)).toBe(JSON.stringify(one))
    expect(one.engineVersion).toBe(ENGINE_VERSION)
    expect(one.events.length).toBeGreaterThan(20)
    const results = new Set<string>()
    for (let seed = 1; seed <= 6; seed++) results.add(simulatePvp({ data, balance: BALANCE, teamA: a, teamB: b, seed }).winner)
    expect(results.size).toBeGreaterThanOrEqual(1)
    expect(JSON.stringify(simulatePvp({ data, balance: BALANCE, teamA: a, teamB: b, seed: 999 }).events)).not.toBe(JSON.stringify(one.events))
  })

  it('never uses nudges or player actions: the engine refuses them in an online match', () => {
    const engine = new BattleEngine({ player: buildTeam(data, BALANCE, team(25)), enemy: buildTeam(data, BALANCE, team(25)), kind: 'pvp', rng: createRng(1), balance: BALANCE, data, badges: 0 })
    expect(engine.nudge(0).result).toBe('unavailable')
    expect(engine.playerAction({ type: 'item', item: 'potion', targetIndex: 0 })).toMatchObject({ accepted: false, reason: 'autopilot' })
    expect(engine.playerAction({ type: 'switch', teamIndex: 1 })).toMatchObject({ accepted: false, reason: 'autopilot' })
    expect(engine.playerAction({ type: 'run' })).toMatchObject({ accepted: false, reason: 'autopilot' })
    const result = simulatePvp({ data, balance: BALANCE, teamA: team(25), teamB: team(25), seed: 7 })
    expect(result.events.some(e => e.type === 'nudge' || e.type === 'item-used' || e.type === 'capture')).toBe(false)
  })

  it('ignores the badge level cap but keeps low-trust slacking for both sides', () => {
    // Level 90 Pokémon would disobey constantly in the story with 0 badges; online they obey.
    const strong = simulatePvp({ data, balance: BALANCE, teamA: team(95, ['charizard', 'blastoise', 'venusaur']), teamB: team(95, ['gengar', 'alakazam', 'machamp']), seed: 3 })
    expect(strong.events.filter(e => e.type === 'disobey')).toHaveLength(0)
    const lowTrust = (names: string[]) => names.map((n, i) => snap(n, 95, { uid: `${n}-${i}`, trust: 0 }))
    const slack = simulatePvp({ data, balance: BALANCE, teamA: lowTrust(['charizard', 'blastoise', 'venusaur']), teamB: lowTrust(['gengar', 'alakazam', 'machamp']), seed: 3 })
    const sides = new Set(slack.events.filter(e => e.type === 'emote' && e.emote === '…').map(e => (e as { side: string }).side))
    expect(sides.has('player') && sides.has('enemy')).toBe(true)
  })

  it('decides by the HP share left when the time limit is reached, and calls exactly equal a draw', () => {
    // Two Pokémon that cannot hurt each other (only Splash) stall until the limit; equal teams share the same HP.
    const stall = (uid: string, level = 25): PokemonSnapshot => snap('magikarp', level, { uid, moves: ['splash'], trust: 255 })
    const short = { ...BALANCE, PVP_MAX_BATTLE_MS: 6000 }
    const same = simulatePvp({ data, balance: short, teamA: [stall('a1'), stall('a2'), stall('a3')], teamB: [stall('b1'), stall('b2'), stall('b3')], seed: 1 })
    expect(same.reason).toBe('timeout')
    expect(same.winner).toBe('draw')
    expect(same.hpShareA).toBe(1)
    expect(same.durationMs).toBeGreaterThanOrEqual(short.PVP_MAX_BATTLE_MS)
    // A side with a lone Tackle user leaves the other with less HP: with the limit short enough nobody faints but the share differs.
    const hitter = snap('machamp', 25, { uid: 'h1', moves: ['karate-chop'] })
    const result = simulatePvp({ data, balance: short, teamA: [hitter, stall('a2'), stall('a3')], teamB: [stall('b1', 50), stall('b2', 50), stall('b3', 50)], seed: 2 })
    expect(result.reason).toBe('timeout')
    expect(result.hpShareB).toBeLessThan(1)
    expect(result.winner).toBe(result.hpShareA > result.hpShareB ? 'a' : result.hpShareB > result.hpShareA ? 'b' : 'draw')
  })
})

describe('picking an opponent', () => {
  const candidate = (userId: string, rating: number) => ({ userId, rating })
  it('never picks the player themself and returns null when nobody else is there', () => {
    expect(pickOpponent([candidate('me', 1000)], 'me', 1000, [], createRng(1))).toBeNull()
    expect(pickOpponent([], 'me', 1000, [], createRng(1))).toBeNull()
    for (let seed = 1; seed < 50; seed++) expect(pickOpponent([candidate('me', 1000), candidate('x', 1010)], 'me', 1000, [], createRng(seed))!.userId).toBe('x')
  })

  it('picks among the closest ratings (top 5 within ±150)', () => {
    const pool = [...Array.from({ length: 8 }, (_, i) => candidate(`near${i}`, 1000 + i * 15)), candidate('far', 1700), candidate('far2', 400)]
    const picked = new Set<string>()
    for (let seed = 1; seed < 200; seed++) picked.add(pickOpponent(pool, 'me', 1000, [], createRng(seed))!.userId)
    expect(picked.size).toBeGreaterThan(1)
    expect([...picked].every(id => ['near0', 'near1', 'near2', 'near3', 'near4'].includes(id))).toBe(true)
    expect(picked.size).toBeLessThanOrEqual(MATCH_POOL_SIZE)
  })

  it('falls back to the closest ones when nobody is within the window, and avoids the latest opponents', () => {
    const far = [candidate('a', 1600), candidate('b', 1700)]
    expect(['a', 'b']).toContain(pickOpponent(far, 'me', 1000, [], createRng(1))!.userId)
    const two = [candidate('a', 1000), candidate('b', 1010)]
    for (let seed = 1; seed < 40; seed++) expect(pickOpponent(two, 'me', 1000, ['a'], createRng(seed))!.userId).toBe('b')
    // ...but a recent opponent is still chosen when there is nobody else.
    expect(pickOpponent([candidate('a', 1000)], 'me', 1000, ['a'], createRng(1))!.userId).toBe('a')
  })
})

describe('the matches migration', () => {
  const sql = readFileSync(new URL('../../supabase/migrations/0016_nudge_matches.sql', import.meta.url), 'utf8')

  it('only creates new tables, with row level security and no writes from the browser', () => {
    for (const table of ['bracket_ratings', 'bracket_entries', 'nudge_matches', 'nudge_challenges']) {
      expect(sql).toContain(`create table if not exists public.${table}`)
      expect(sql).toContain(`alter table public.${table} enable row level security`)
    }
    expect(sql).not.toMatch(/drop table|alter table (?!public\.(bracket_ratings|bracket_entries|nudge_matches|nudge_challenges))/i)
    expect(sql).toContain('revoke insert, update, delete on public.bracket_ratings, public.bracket_entries, public.nudge_matches, public.nudge_challenges from anon, authenticated')
    expect(sql).not.toMatch(/for (insert|update|delete)/i)
    expect(sql).toContain('grant execute on function public.nudge_record_match')
    expect(sql).toContain('to service_role')
  })

  it('has the indexes of the plan', () => {
    expect(sql).toContain('(bracket, rating desc)')
    expect(sql).toContain('public.nudge_matches (player_a, created_at desc)')
    expect(sql).toContain('public.nudge_matches (player_b, created_at desc)')
    expect(sql).toContain('public.nudge_challenges (to_user, status)')
  })
})
