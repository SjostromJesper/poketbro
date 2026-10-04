import { describe, expect, it } from 'vitest'
import { captureChance, captureShakeThreshold, captureValue, rollCapture, type CaptureParams } from '../engine/formulas'
import { createRng } from '../engine/rng'
import { BALANCE, data, engineFor, mon } from './helpers'
import { BattleEngine } from '../engine/battle'

const base: CaptureParams = { maxHp: 100, hp: 100, captureRate: 45, ballBonus: 1, status: null, level: 30 }

describe('capture formula', () => {
  it('catches automatically when a >= 255, still showing three shakes', () => {
    const easy: CaptureParams = { ...base, captureRate: 255, hp: 1, ballBonus: 2 }
    expect(captureValue(easy, BALANCE)).toBeGreaterThanOrEqual(255)
    expect(captureChance(easy, BALANCE)).toBe(1)
    for (let seed = 1; seed <= 50; seed++) {
      expect(rollCapture(createRng(seed), easy, BALANCE)).toEqual({ caught: true, shakes: 3, chance: 1 })
    }
  })

  it('computes a = ((3 maxHP - 2 HP) * rate * ball) / (3 maxHP) with status and level bonuses', () => {
    expect(captureValue(base, BALANCE)).toBeCloseTo((100 * 45) / 300) // full HP: (300 - 200) * 45 / 300 = 15
    expect(captureValue({ ...base, hp: 1 }, BALANCE)).toBeCloseTo(((300 - 2) * 45) / 300)
    expect(captureValue({ ...base, ballBonus: 2 }, BALANCE)).toBeCloseTo(15 * 2)
    expect(captureValue({ ...base, status: 'sleep' }, BALANCE)).toBeCloseTo(15 * 2)
    expect(captureValue({ ...base, status: 'burn' }, BALANCE)).toBeCloseTo(15 * 1.5)
    expect(captureValue({ ...base, status: 'poison' }, BALANCE)).toBeCloseTo(15 * 1.5)
    // level bonus: max(1, (30 - level) / 10), capped at 2
    expect(captureValue({ ...base, level: 25 }, BALANCE)).toBeCloseTo(15 * 1) // (30-25)/10 = 0.5 -> 1
    expect(captureValue({ ...base, level: 10 }, BALANCE)).toBeCloseTo(15 * 2)
    expect(captureValue({ ...base, level: 5 }, BALANCE)).toBeCloseTo(15 * 2) // capped
    expect(captureValue({ ...base, level: 50 }, BALANCE)).toBeCloseTo(15)
    expect(captureValue({ ...base, level: 20 }, { ...BALANCE, CAPTURE_LEVEL_REF: 40 })).toBeCloseTo(15 * 2)
  })

  it('makes a nearly dead Pokémon much easier to catch than a healthy one', () => {
    const full = captureChance(base, BALANCE)
    const low = captureChance({ ...base, hp: 1 }, BALANCE)
    expect(low).toBeGreaterThan(full * 2.5)
    expect(full).toBeGreaterThan(0)
    expect(low).toBeLessThan(1)
  })

  it('raises the chance with status and better balls, and with a low level', () => {
    const plain = captureChance(base, BALANCE)
    expect(captureChance({ ...base, status: 'sleep' }, BALANCE)).toBeGreaterThan(captureChance({ ...base, status: 'burn' }, BALANCE))
    expect(captureChance({ ...base, status: 'burn' }, BALANCE)).toBeGreaterThan(plain)
    expect(captureChance({ ...base, ballBonus: BALANCE.BALL_BONUS['great-ball'] }, BALANCE)).toBeGreaterThan(plain)
    expect(captureChance({ ...base, ballBonus: BALANCE.BALL_BONUS['ultra-ball'] }, BALANCE)).toBeGreaterThan(captureChance({ ...base, ballBonus: 1.5 }, BALANCE))
    expect(captureChance({ ...base, level: 5 }, BALANCE)).toBeGreaterThan(captureChance({ ...base, level: 40 }, BALANCE))
  })

  it('has shake threshold b = 1048560 / sqrt(sqrt(16711680 / a))', () => {
    expect(captureShakeThreshold(255)).toBeCloseTo(65535, -1)
    expect(captureShakeThreshold(16)).toBeCloseTo(1048560 / Math.sqrt(Math.sqrt(16711680 / 16)))
  })

  it('shows 0-3 shakes whose distribution matches the theory over 10 000 seeded throws', () => {
    const p: CaptureParams = { ...base, captureRate: 120, hp: 40 }
    const a = captureValue(p, BALANCE)
    expect(a).toBeLessThan(255)
    const b = captureShakeThreshold(a) / 65536
    const rng = createRng(2024)
    const n = 10000
    const counts = { 0: 0, 1: 0, 2: 0, 3: 0 }
    let caught = 0
    for (let i = 0; i < n; i++) {
      const r = rollCapture(rng, p, BALANCE)
      counts[r.shakes]++
      if (r.caught) caught++
    }
    // P(0 shakes) = 1 - b, P(1) = b(1-b), P(2) = b^2(1-b), P(3 shakes and failed) = b^3 (1-b), P(caught) = b^4
    const expected = [1 - b, b * (1 - b), b * b * (1 - b), b ** 3 * (1 - b)]
    for (let shakes = 0; shakes < 3; shakes++) expect(Math.abs(counts[shakes as 0 | 1 | 2] / n - expected[shakes])).toBeLessThan(0.02)
    expect(Math.abs(caught / n - b ** 4)).toBeLessThan(0.015)
    expect(rollCapture(createRng(1), p, BALANCE).chance).toBeCloseTo(b ** 4)
    // a caught Pokémon always shows three shakes, a failed one at most three
    for (let i = 0; i < 500; i++) {
      const r = rollCapture(rng, p, BALANCE)
      if (r.caught) expect(r.shakes).toBe(3)
      expect(r.shakes).toBeLessThanOrEqual(3)
    }
  })
})

describe('capture in the engine', () => {
  const wild = (hp: number, status: 'sleep' | null = null): BattleEngine => {
    const engine = engineFor([mon('charmander', 20)], [mon('pidgey', 5)])
    engine.active('enemy').hp = hp
    engine.active('enemy').status = status
    return engine
  }

  it('reports the live catch chance per ball (debug overlay)', () => {
    const healthy = wild(20)
    const weak = wild(1, 'sleep')
    expect(weak.captureChance('poke-ball')).toBeGreaterThan(healthy.captureChance('poke-ball'))
    expect(healthy.captureChance('ultra-ball')).toBeGreaterThan(healthy.captureChance('great-ball'))
    expect(healthy.captureChance('great-ball')).toBeGreaterThan(healthy.captureChance('poke-ball'))
    const trainer = engineFor([mon('charmander', 20)], [mon('pidgey', 5)], { kind: 'trainer' })
    expect(trainer.captureChance()).toBe(0)
    expect(data.species[16].captureRate).toBe(255)
  })

  it('does not always succeed: a healthy high-level Pokémon is usually not caught in one throw', () => {
    let caught = 0
    for (let seed = 1; seed <= 300; seed++) {
      const engine = engineFor([mon('charmander', 20)], [mon('rhydon', 40)], { seed })
      engine.playerAction({ type: 'ball' })
      if (engine.state.capture?.caught) caught++
    }
    expect(caught).toBeLessThan(30)
  })
})
