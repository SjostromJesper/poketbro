import { describe, expect, it } from 'vitest'
import { accuracyStageMultiplier, calcDamage, calcStat, calcStats, critChance, levelForXp, natureMultiplier, stageMultiplier, typeEffectiveness, xpForLevel, xpYield } from '../engine/formulas'
import { BALANCE, data, speciesId } from './helpers'

describe('stats', () => {
  it('uses the standard Gen 3+ formula', () => {
    const bulbasaur = data.species[1]
    // Level 5, IV 0, neutral: HP = floor((2*45)*5/100) + 5 + 10 = 19, Attack = floor(2*49*5/100) + 5 = 9
    expect(calcStat(bulbasaur.baseStats.hp, 0, 5, 'hp', undefined)).toBe(19)
    expect(calcStat(bulbasaur.baseStats.attack, 0, 5, 'attack', undefined)).toBe(9)
    // Level 100, IV 31: Charizard HP 297, Attack 204, Speed floor((2*100+31)) + 5 = 236
    const charizard = data.species[speciesId('charizard')]
    expect(calcStat(charizard.baseStats.hp, 31, 100, 'hp', undefined)).toBe(297)
    expect(calcStat(charizard.baseStats.attack, 31, 100, 'attack', undefined)).toBe(204)
    expect(calcStat(charizard.baseStats.speed, 31, 100, 'speed', undefined)).toBe(236)
  })

  it('applies natures as +-10 % on non-HP stats only', () => {
    const adamant = data.natures.adamant
    expect(natureMultiplier(adamant, 'attack')).toBe(1.1)
    expect(natureMultiplier(adamant, 'spAttack')).toBe(0.9)
    expect(natureMultiplier(adamant, 'speed')).toBe(1)
    expect(natureMultiplier(adamant, 'hp')).toBe(1)
    expect(natureMultiplier(data.natures.hardy, 'attack')).toBe(1)
    const charizard = data.species[speciesId('charizard')]
    const neutral = calcStats(charizard, { hp: 31, attack: 31, defense: 31, spAttack: 31, spDefense: 31, speed: 31 }, 100, data.natures.hardy)
    const boosted = calcStats(charizard, { hp: 31, attack: 31, defense: 31, spAttack: 31, spDefense: 31, speed: 31 }, 100, adamant)
    expect(boosted.attack).toBe(Math.floor(neutral.attack * 1.1))
    expect(boosted.spAttack).toBe(Math.floor(neutral.spAttack * 0.9))
    expect(boosted.hp).toBe(neutral.hp)
  })

  it('converts stages to multipliers', () => {
    expect(stageMultiplier(0)).toBe(1)
    expect(stageMultiplier(1)).toBe(1.5)
    expect(stageMultiplier(2)).toBe(2)
    expect(stageMultiplier(6)).toBe(4)
    expect(stageMultiplier(-1)).toBeCloseTo(2 / 3)
    expect(stageMultiplier(-6)).toBe(0.25)
    expect(stageMultiplier(9)).toBe(4)
    expect(accuracyStageMultiplier(1)).toBeCloseTo(4 / 3)
    expect(accuracyStageMultiplier(-1)).toBeCloseTo(3 / 4)
  })
})

describe('type effectiveness', () => {
  const chart = data.typeChart
  it('handles single and dual types', () => {
    expect(typeEffectiveness('fire', ['grass'], chart)).toBe(2)
    expect(typeEffectiveness('fire', ['water'], chart)).toBe(0.5)
    expect(typeEffectiveness('fire', ['grass', 'poison'], chart)).toBe(2) // Bulbasaur
    expect(typeEffectiveness('electric', ['water', 'flying'], chart)).toBe(4) // Gyarados
    expect(typeEffectiveness('grass', ['water', 'ground'], chart)).toBe(4)
    expect(typeEffectiveness('ice', ['grass', 'ground'], chart)).toBe(4)
    expect(typeEffectiveness('fire', ['water', 'rock'], chart)).toBe(0.25)
    expect(typeEffectiveness('normal', ['normal'], chart)).toBe(1)
  })
  it('handles immunities, also on dual types', () => {
    expect(typeEffectiveness('normal', ['ghost'], chart)).toBe(0)
    expect(typeEffectiveness('ghost', ['normal'], chart)).toBe(0)
    expect(typeEffectiveness('electric', ['ground'], chart)).toBe(0)
    expect(typeEffectiveness('ground', ['flying'], chart)).toBe(0)
    expect(typeEffectiveness('ground', ['water', 'flying'], chart)).toBe(0)
    expect(typeEffectiveness('electric', ['water', 'ground'], chart)).toBe(0)
    expect(typeEffectiveness('psychic', ['dark'], chart)).toBe(0)
  })
})

describe('damage', () => {
  const base = { level: 50, power: 80, attack: 100, defense: 100, stab: false, effectiveness: 1, crit: false, burned: false, random: 1, other: 1 }
  it('matches the Gen 5 formula', () => {
    // floor(floor(22 * 80 * 100 / 100) / 50) + 2 = 37
    expect(calcDamage(base, BALANCE)).toBe(37)
    expect(calcDamage({ ...base, stab: true }, BALANCE)).toBe(55) // 37 * 1.5 = 55.5
    expect(calcDamage({ ...base, effectiveness: 2 }, BALANCE)).toBe(74)
    expect(calcDamage({ ...base, effectiveness: 0.5 }, BALANCE)).toBe(18)
    expect(calcDamage({ ...base, crit: true }, BALANCE)).toBe(55)
    expect(calcDamage({ ...base, burned: true }, BALANCE)).toBe(18)
    expect(calcDamage({ ...base, random: 0.85 }, BALANCE)).toBe(31)
  })
  it('never deals 0 unless the target is immune', () => {
    expect(calcDamage({ ...base, level: 1, power: 1, attack: 1, defense: 500 }, BALANCE)).toBeGreaterThanOrEqual(1)
    expect(calcDamage({ ...base, effectiveness: 0 }, BALANCE)).toBe(0)
  })
  it('has crit chances per stage', () => {
    expect(critChance(0, 0, BALANCE)).toBeCloseTo(1 / 16)
    expect(critChance(1, 0, BALANCE)).toBeCloseTo(1 / 8)
    expect(critChance(9, 0, BALANCE)).toBeCloseTo(1 / 2)
    expect(critChance(0, 0.04, BALANCE)).toBeCloseTo(1 / 16 + 0.04)
  })
})

describe('xp', () => {
  it('reads level thresholds from the growth tables', () => {
    const rate = data.species[1].growthRate
    expect(xpForLevel(data.growthRates, rate, 1)).toBe(0)
    expect(xpForLevel(data.growthRates, rate, 5)).toBe(135)
    expect(levelForXp(data.growthRates, rate, 135, 100)).toBe(5)
    expect(levelForXp(data.growthRates, rate, 134, 100)).toBe(4)
    expect(levelForXp(data.growthRates, rate, 99999999, 100)).toBe(100)
    expect(levelForXp(data.growthRates, rate, 99999999, 50)).toBe(50)
  })
  it('splits XP between participants and pays trainers 1.5x (and scales with the global XP multiplier)', () => {
    const m = BALANCE.XP_MULTIPLIER
    expect(xpYield(64, 10, false, 1, BALANCE)).toBe(Math.floor((64 * 10 * m) / 7))
    expect(xpYield(64, 10, true, 1, BALANCE)).toBe(Math.floor((1.5 * 64 * 10 * m) / 7))
    expect(xpYield(64, 10, false, 2, BALANCE)).toBe(Math.floor((64 * 10 * m) / 14))
    expect(xpYield(64, 10, false, 1, { ...BALANCE, XP_MULTIPLIER: 1 })).toBe(Math.floor((64 * 10) / 7))
  })
})
