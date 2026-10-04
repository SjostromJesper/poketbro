import { describe, expect, it } from 'vitest'
import { disobeyChance, obedienceCap, rollObedience } from '../engine/obedience'
import { dealDamage } from '../engine/moveExec'
import { createBattler } from '../engine/pokemon'
import { createRng } from '../engine/rng'
import { advance, BALANCE, constRng, data, engineFor, mon, ofType, withBalance } from './helpers'

function battler(level: number, trust: number) {
  return createBattler(data, BALANCE, mon('charmander', level, { trust }), 'player', 0)
}

describe('obedience', () => {
  it('caps obedience at 15 + 10 per badge', () => {
    expect(obedienceCap(0, BALANCE)).toBe(15)
    expect(obedienceCap(1, BALANCE)).toBe(25)
    expect(obedienceCap(8, BALANCE)).toBe(95)
  })

  it('has no disobedience under the cap with decent trust', () => {
    expect(disobeyChance(10, 0, 120, BALANCE)).toBe(0)
    expect(disobeyChance(15, 0, 120, BALANCE)).toBe(0)
    expect(disobeyChance(30, 2, 120, BALANCE)).toBe(0)
  })

  it('uses (level - cap) / (level + cap) above the cap', () => {
    expect(disobeyChance(30, 0, 120, BALANCE)).toBeCloseTo(15 / 45)
    expect(disobeyChance(45, 0, 120, BALANCE)).toBeCloseTo(30 / 60)
    expect(disobeyChance(45, 1, 120, BALANCE)).toBeCloseTo(20 / 70)
  })

  it('adds a small loafing chance under low trust', () => {
    expect(disobeyChance(10, 0, 59, BALANCE)).toBeCloseTo(BALANCE.LOW_TRUST_LOAF_CHANCE)
    expect(disobeyChance(10, 0, 60, BALANCE)).toBe(0)
    expect(disobeyChance(30, 0, 10, BALANCE)).toBeCloseTo(15 / 45 + BALANCE.LOW_TRUST_LOAF_CHANCE)
  })

  it('rolls loafing / random move / nap with the right frequencies (seeded)', () => {
    const rng = createRng(11)
    const counts = { obey: 0, loaf: 0, random: 0, nap: 0 }
    const n = 30000
    const b = battler(30, 120)
    for (let i = 0; i < n; i++) counts[rollObedience(b, 0, rng, BALANCE)]++
    const p = 15 / 45
    expect(counts.obey / n).toBeCloseTo(1 - p, 1)
    expect(Math.abs(counts.obey / n - (1 - p))).toBeLessThan(0.012)
    expect(Math.abs(counts.loaf / n - p * 0.5)).toBeLessThan(0.012)
    expect(Math.abs(counts.random / n - p * 0.3)).toBeLessThan(0.012)
    expect(Math.abs(counts.nap / n - p * 0.2)).toBeLessThan(0.012)
  })

  it('only loafs (never random/nap) when slacking due to low trust under the cap', () => {
    const rng = createRng(3)
    const b = battler(10, 10)
    const seen = new Set<string>()
    for (let i = 0; i < 5000; i++) seen.add(rollObedience(b, 0, rng, BALANCE))
    expect([...seen].sort()).toEqual(['loaf', 'obey'])
  })

  it('makes an over-level Pokémon skip turns in a real battle, but never the enemy', () => {
    const engine = engineFor([mon('magikarp', 60, { moves: ['splash'], trust: 120 })], [mon('magikarp', 60, { moves: ['splash'] })], { badges: 0 })
    const events = advance(engine, 200000)
    const disobeys = ofType(events, 'disobey')
    expect(disobeys.length).toBeGreaterThan(10)
    expect(disobeys.every(e => e.side === 'player')).toBe(true)
    const naps = disobeys.filter(e => e.outcome === 'nap')
    expect(naps.length).toBeGreaterThan(0)
    expect(events.some(e => e.type === 'emote' && e.emote === '💤')).toBe(true)

    const obedient = engineFor([mon('magikarp', 60, { moves: ['splash'] })], [mon('magikarp', 60, { moves: ['splash'] })], { badges: 6 })
    expect(ofType(advance(obedient, 100000), 'disobey')).toHaveLength(0)
  })

  it('keeps a pending nudge through a skipped turn but spends it on a random move', () => {
    const engine = engineFor([mon('magikarp', 60, { moves: ['splash', 'tackle'], trust: 120 })], [mon('magikarp', 60, { moves: ['splash'] })], {
      balance: withBalance({ OBEDIENCE_OUTCOME_WEIGHTS: { loaf: 1, random: 0, nap: 0 } }),
    })
    engine.nudge(1)
    const events = advance(engine, 60000)
    expect(ofType(events, 'disobey').length).toBeGreaterThan(0)
    const firstChoice = ofType(events, 'move-chosen').find(e => e.side === 'player')
    if (firstChoice) expect(firstChoice.followedNudge).not.toBeNull()
  })
})

describe('high trust', () => {
  it('lets a Pokémon survive a lethal hit with 1 HP, once per battle', () => {
    const b = createBattler(data, BALANCE, mon('charmander', 20, { trust: 220 }), 'player', 0)
    const events: Parameters<typeof dealDamage>[0]['events'] = []
    const ctx = { rng: constRng(0), balance: BALANCE, data, events }
    dealDamage(ctx, b, 9999, { source: 'move' })
    expect(b.hp).toBe(1)
    expect(b.fainted).toBe(false)
    expect(events.some(e => e.type === 'endure')).toBe(true)
    dealDamage(ctx, b, 9999, { source: 'move' })
    expect(b.fainted).toBe(true)
  })

  it('does not trigger below the trust threshold or on non-move damage', () => {
    const low = createBattler(data, BALANCE, mon('charmander', 20, { trust: 199 }), 'player', 0)
    dealDamage({ rng: constRng(0), balance: BALANCE, data, events: [] }, low, 9999, { source: 'move' })
    expect(low.fainted).toBe(true)
    const dot = createBattler(data, BALANCE, mon('charmander', 20, { trust: 255 }), 'player', 0)
    dealDamage({ rng: constRng(0), balance: BALANCE, data, events: [] }, dot, 9999, { source: 'status' })
    expect(dot.fainted).toBe(true)
  })
})
