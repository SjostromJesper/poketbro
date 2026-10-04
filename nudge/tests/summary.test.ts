import { describe, expect, it } from 'vitest'
import { computeChoice } from '../engine/choice'
import { createBattler } from '../engine/pokemon'
import { applyBattleOutcome } from '../engine/progression'
import { xpForLevel } from '../engine/formulas'
import type { BattleOutcome } from '../engine/types'
import { buildSummary, describeMoveEffects, trustHearts } from '../game/summary'
import { BALANCE, data, mon } from './helpers'

describe('summary data', () => {
  it('maps trust to 5 hearts', () => {
    expect([0, 1, 51, 52, 102, 153, 204, 205, 255].map(t => trustHearts(t, BALANCE))).toEqual([0, 1, 1, 2, 2, 3, 4, 5, 5])
  })

  it('shows level, HP, XP progress, stats with nature markers and the trait', () => {
    const p = mon('charmander', 12, { nature: 'adamant', trait: 'calm', trust: 200 })
    p.currentHp = 10
    const s = buildSummary(data, BALANCE, p)
    expect(s).toMatchObject({ name: 'Charmander', level: 12, hp: 10, trust: 200, hearts: 4 })
    expect(s.trait).toMatchObject({ id: 'calm', label: 'Lugn' })
    expect(s.trait.description).toContain('smart')
    const attack = s.stats.find(x => x.stat === 'attack')!
    const spAttack = s.stats.find(x => x.stat === 'spAttack')!
    expect(attack.nature).toBe(1)
    expect(spAttack.nature).toBe(-1)
    expect(s.stats.find(x => x.stat === 'speed')!.nature).toBe(0)
    const next = xpForLevel(data.growthRates, 'medium-slow', 13) - xpForLevel(data.growthRates, 'medium-slow', 12)
    expect(s.xpProgress).toEqual({ current: p.xp - xpForLevel(data.growthRates, 'medium-slow', 12), needed: next })
    expect(buildSummary(data, BALANCE, { ...p, level: 100 }).xpProgress).toBeNull()
  })

  it('explains the nature as a move preference', () => {
    const aggressive = buildSummary(data, BALANCE, mon('charmander', 12, { nature: 'adamant' }))
    expect(aggressive.nature.text).toMatch(/Föredrar attacker/)
    expect(aggressive.nature.preference.attack).toBeGreaterThan(aggressive.nature.preference.defense)
    const sum = Object.values(aggressive.nature.preference).reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(1)
    const defensive = buildSummary(data, BALANCE, mon('charmander', 12, { nature: 'bold' }))
    expect(defensive.nature.preference.defense).toBeGreaterThan(aggressive.nature.preference.defense)
    expect(buildSummary(data, BALANCE, mon('charmander', 12, { nature: 'hardy' })).nature.text).toMatch(/attacker|jämnt/)
  })

  it('describes moves in Swedish with their effects', () => {
    const effects = (name: string) => describeMoveEffects(data.moves[name], BALANCE)
    expect(effects('ember')).toContain('10 % chans: orsakar brännskada.')
    expect(effects('swords-dance')).toContain('höjer egen Attack 2 steg.')
    expect(effects('growl')).toContain('sänker motståndarens Attack 1 steg.')
    expect(effects('quick-attack').join(' ')).toContain('Snabb')
    expect(effects('solar-beam')).toContain('Laddar innan den slår till.')
    expect(effects('hyper-beam')).toContain('Kräver återhämtning efteråt.')
    expect(effects('double-slap')).toContain('Slår 2-5 gånger.')
    expect(effects('mega-drain')).toContain('Läker 50 % av skadan.')
    expect(effects('take-down')).toContain('Rekyl: 25 % av skadan.')
    expect(effects('recover')).toContain('Läker 50 % av maxlivet.')
    expect(effects('splash')).toContain('Effekten är inte implementerad ännu.')
    expect(effects('overheat')).toContain('sänker egen Spec.attack 2 steg.')
    expect(effects('sleep-powder')).toContain('orsakar sömn.')
    expect(effects('tackle')).toEqual([])
  })

  it('shows habits learned in won battles ("Föredrar: Ember") and they make that move more likely', () => {
    const p = mon('charmander', 12, { moves: ['scratch', 'ember', 'growl', 'tackle'], trust: 150 })
    expect(buildSummary(data, BALANCE, p).favourite).toBeNull()
    const before = computeChoice({ self: createBattler(data, BALANCE, p, 'player', 0), foe: createBattler(data, BALANCE, mon('rattata', 12), 'enemy', 0), data, balance: BALANCE })
    const outcome: BattleOutcome = {
      result: 'win', xp: {}, defeated: [], caught: null,
      party: [{ uid: p.uid, currentHp: p.currentHp, status: null, moves: p.moves, heldItem: null, fainted: false, participated: true, movesUsed: { ember: 4, scratch: 1 }, followedNudge: false, trait: p.trait }],
    }
    applyBattleOutcome(data, BALANCE, [p], outcome)
    applyBattleOutcome(data, BALANCE, [p], outcome)
    const s = buildSummary(data, BALANCE, p)
    expect(s.favourite).toBe('Ember')
    expect(s.habits[0]).toMatchObject({ name: 'Ember', value: 8 })
    const after = computeChoice({ self: createBattler(data, BALANCE, p, 'player', 0), foe: createBattler(data, BALANCE, mon('rattata', 12), 'enemy', 0), data, balance: BALANCE })
    const pEmber = (c: typeof before) => c.moves.find(m => m.move === 'ember')!.pAuto
    expect(pEmber(after)).toBeGreaterThan(pEmber(before))
    // trust shows up too: wins gave +2 each
    expect(s.trust).toBe(150 + 2 * BALANCE.TRUST_WIN)
  })

  it('reports who caught it', () => {
    expect(buildSummary(data, BALANCE, mon('rattata', 5)).originalTrainer).toBe('wild')
  })
})
