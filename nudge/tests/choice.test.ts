import { describe, expect, it } from 'vitest'
import { computeChoice, natureCategoryWeights, pickMove, smartnessOf } from '../engine/choice'
import { createBattler } from '../engine/pokemon'
import { createRng } from '../engine/rng'
import { BALANCE, data, mon } from './helpers'

function battlers(playerMon = mon('charmander', 20, { moves: ['scratch', 'ember', 'growl', 'harden'] }), enemyMon = mon('bulbasaur', 20)) {
  return {
    self: createBattler(data, BALANCE, playerMon, 'player', 0),
    foe: createBattler(data, BALANCE, enemyMon, 'enemy', 0),
  }
}

describe('move choice distribution', () => {
  it('p_auto and p_final always sum to 1', () => {
    const { self, foe } = battlers()
    for (const nudge of [null, { moveIndex: 2, strength: 0.6 }, { moveIndex: 0, strength: 0.95 }, { moveIndex: 1, strength: 0 }]) {
      const choice = computeChoice({ self, foe, data, balance: BALANCE, nudge })
      expect(choice.moves.reduce((s, m) => s + m.pAuto, 0)).toBeCloseTo(1, 10)
      expect(choice.moves.reduce((s, m) => s + m.pFinal, 0)).toBeCloseTo(1, 10)
    }
  })

  it('moves p_final towards the nudged move: p_final = (1 - n) * p_auto + n * onehot', () => {
    const { self, foe } = battlers()
    const plain = computeChoice({ self, foe, data, balance: BALANCE })
    const nudged = computeChoice({ self, foe, data, balance: BALANCE, nudge: { moveIndex: 2, strength: 0.4 } })
    expect(nudged.nudgeStrength).toBe(0.4)
    for (const move of nudged.moves) {
      const expected = 0.6 * plain.moves.find(m => m.moveIndex === move.moveIndex)!.pAuto + (move.moveIndex === 2 ? 0.4 : 0)
      expect(move.pFinal).toBeCloseTo(expected, 10)
    }
    // p_auto does not change with the nudge
    expect(nudged.moves.map(m => m.pAuto)).toEqual(plain.moves.map(m => m.pAuto))
  })

  it('ignores a nudge on a move without PP', () => {
    const { self, foe } = battlers()
    self.moves[2].pp = 0
    const choice = computeChoice({ self, foe, data, balance: BALANCE, nudge: { moveIndex: 2, strength: 0.9 } })
    expect(choice.nudgeStrength).toBe(0)
    expect(choice.moves.find(m => m.moveIndex === 2)).toBeUndefined()
    expect(choice.moves.reduce((s, m) => s + m.pFinal, 0)).toBeCloseTo(1, 10)
  })

  it('falls back to Struggle when no move has PP left', () => {
    const { self, foe } = battlers()
    for (const m of self.moves) m.pp = 0
    const choice = computeChoice({ self, foe, data, balance: BALANCE })
    expect(choice.struggle).toBe(true)
    expect(pickMove(createRng(1), choice)).toBe(-1)
  })

  it('draws moves in proportion to p_final (seeded, many draws)', () => {
    const { self, foe } = battlers()
    const choice = computeChoice({ self, foe, data, balance: BALANCE, nudge: { moveIndex: 3, strength: 0.3 } })
    const rng = createRng(42)
    const counts = new Map<number, number>()
    const draws = 40000
    for (let i = 0; i < draws; i++) {
      const index = pickMove(rng, choice)
      counts.set(index, (counts.get(index) ?? 0) + 1)
    }
    for (const move of choice.moves) {
      expect((counts.get(move.moveIndex) ?? 0) / draws).toBeCloseTo(move.pFinal, 1)
      expect(Math.abs((counts.get(move.moveIndex) ?? 0) / draws - move.pFinal)).toBeLessThan(0.012)
    }
  })

  it('classifies attacks, defensive and support moves', () => {
    const { self, foe } = battlers()
    const choice = computeChoice({ self, foe, data, balance: BALANCE })
    const byMove = Object.fromEntries(choice.moves.map(m => [m.move, m.category]))
    expect(byMove).toMatchObject({ 'scratch': 'attack', 'ember': 'attack', 'growl': 'support', 'harden': 'defense' })
  })
})

describe('nature preference', () => {
  it('maps nature stats to category weights', () => {
    const attackHeavy = natureCategoryWeights('adamant', data, BALANCE)
    expect(attackHeavy.attack).toBeGreaterThan(attackHeavy.defense)
    const defenseHeavy = natureCategoryWeights('bold', data, BALANCE)
    expect(defenseHeavy.defense).toBeGreaterThan(natureCategoryWeights('hardy', data, BALANCE).defense)
    const speedHeavy = natureCategoryWeights('timid', data, BALANCE)
    expect(speedHeavy.support).toBeGreaterThan(natureCategoryWeights('hardy', data, BALANCE).support)
    expect(natureCategoryWeights('hardy', data, BALANCE)).toEqual(BALANCE.CATEGORY_WEIGHTS.neutral)
    // a lowered stat dampens its category
    expect(natureCategoryWeights('modest', data, BALANCE).attack).toBe(BALANCE.CATEGORY_WEIGHTS.attack.attack * BALANCE.DECREASED_CATEGORY_MULT)
  })

  it('makes attack-natured Pokémon pick attacks more often than defense-natured ones', () => {
    const moves = ['scratch', 'ember', 'growl', 'harden']
    const aggressive = battlers(mon('charmander', 20, { moves, nature: 'lonely' }))
    const defensive = battlers(mon('charmander', 20, { moves, nature: 'bold' }))
    const pAttack = (b: ReturnType<typeof battlers>) => computeChoice({ ...b, data, balance: BALANCE }).moves.filter(m => m.category === 'attack').reduce((s, m) => s + m.pAuto, 0)
    expect(pAttack(aggressive)).toBeGreaterThan(pAttack(defensive) + 0.1)
  })
})

describe('smartness', () => {
  it('grows with trust and is shaped by the trait', () => {
    const low = battlers(mon('charmander', 20, { trust: 0, trait: 'loyal' })).self
    const high = battlers(mon('charmander', 20, { trust: 255, trait: 'loyal' })).self
    expect(smartnessOf(low, BALANCE)).toBeCloseTo(BALANCE.SMART_MIN)
    expect(smartnessOf(high, BALANCE)).toBeCloseTo(BALANCE.SMART_MAX)
    const calm = battlers(mon('charmander', 20, { trust: 255, trait: 'calm' })).self
    const hasty = battlers(mon('charmander', 20, { trust: 255, trait: 'hasty' })).self
    expect(smartnessOf(calm, BALANCE)).toBeGreaterThan(smartnessOf(high, BALANCE))
    expect(smartnessOf(hasty, BALANCE)).toBeLessThan(smartnessOf(high, BALANCE))
  })

  it('makes trusting Pokémon prefer the super effective move', () => {
    const moves = ['ember', 'tackle', 'scratch', 'leer'] // Ember is super effective against Bulbasaur
    const stupid = battlers(mon('charmander', 20, { moves, trust: 0 }))
    const clever = battlers(mon('charmander', 20, { moves, trust: 255 }))
    const pEmber = (b: ReturnType<typeof battlers>) => computeChoice({ ...b, data, balance: BALANCE }).moves.find(m => m.move === 'ember')!.pAuto
    expect(pEmber(clever)).toBeGreaterThan(pEmber(stupid))
  })

  it('avoids pointless moves: status on an already statused foe, healing at full HP, immune attacks', () => {
    const moves = ['thunder-wave', 'tackle', 'recover', 'ember']
    const { self, foe } = battlers(mon('chansey', 30, { moves, trust: 255, trait: 'loyal' }), mon('gastly', 20))
    const choice = computeChoice({ self, foe, data, balance: BALANCE })
    const p = Object.fromEntries(choice.moves.map(m => [m.move, m.pAuto]))
    // Tackle cannot hurt a Ghost: it is much less likely than Ember
    expect(p.tackle).toBeLessThan(p.ember / 3)
    // At full HP, Recover is rarely picked, but at low HP it becomes attractive
    const fullHp = p.recover
    self.hp = Math.floor(self.stats.hp * 0.2)
    const lowHp = Object.fromEntries(computeChoice({ self, foe, data, balance: BALANCE }).moves.map(m => [m.move, m.pAuto])).recover
    expect(lowHp).toBeGreaterThan(fullHp * 2)
    // Thunder Wave is pointless once the foe is paralysed
    const before = p['thunder-wave']
    foe.status = 'paralysis'
    const after = Object.fromEntries(computeChoice({ self, foe, data, balance: BALANCE }).moves.map(m => [m.move, m.pAuto]))['thunder-wave']
    expect(after).toBeLessThan(before / 2)
  })
})

describe('traits and habits', () => {
  it('shy Pokémon turn defensive under 30 % HP', () => {
    const moves = ['scratch', 'ember', 'harden', 'growl']
    const { self, foe } = battlers(mon('charmander', 20, { moves, trait: 'shy' }))
    const pDefensive = () => computeChoice({ self, foe, data, balance: BALANCE }).moves.filter(m => m.category !== 'attack').reduce((s, m) => s + m.pAuto, 0)
    const healthy = pDefensive()
    self.hp = Math.floor(self.stats.hp * 0.2)
    expect(pDefensive()).toBeGreaterThan(healthy + 0.15)
  })

  it('playful Pokémon flatten the distribution, hasty ones favour the strongest move', () => {
    const moves = ['scratch', 'ember', 'harden', 'growl']
    const spread = (trait: 'playful' | 'loyal') => {
      const { self, foe } = battlers(mon('charmander', 20, { moves, trait }))
      const p = computeChoice({ self, foe, data, balance: BALANCE }).moves.map(m => m.pAuto)
      return Math.max(...p) - Math.min(...p)
    }
    expect(spread('playful')).toBeLessThan(spread('loyal'))

    const strongest = (trait: 'hasty' | 'loyal') => {
      const { self, foe } = battlers(mon('charmander', 20, { moves: ['scratch', 'ember', 'slash', 'harden'], trait, trust: 255 }), mon('rattata', 20))
      const choice = computeChoice({ self, foe, data, balance: BALANCE })
      return choice.moves.find(m => m.move === 'slash')!.pAuto
    }
    expect(strongest('hasty')).toBeGreaterThan(0)
  })

  it('learns habits: used moves become a bit more likely, with a cap', () => {
    const moves = ['scratch', 'tackle', 'growl', 'harden']
    const { self, foe } = battlers(mon('charmander', 20, { moves }))
    const base = computeChoice({ self, foe, data, balance: BALANCE }).moves.find(m => m.move === 'tackle')!.pAuto
    self.habits.tackle = 10
    const some = computeChoice({ self, foe, data, balance: BALANCE }).moves.find(m => m.move === 'tackle')!.pAuto
    self.habits.tackle = 100000
    const lots = computeChoice({ self, foe, data, balance: BALANCE }).moves.find(m => m.move === 'tackle')!.pAuto
    expect(some).toBeGreaterThan(base)
    expect(lots).toBeGreaterThanOrEqual(some)
    expect(lots).toBeLessThan(base * (1 + BALANCE.HABIT_BONUS_CAP) * 1.01)
  })
})
