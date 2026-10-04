import { describe, expect, it } from 'vitest'
import { nudgeStrengthFor } from '../engine/nudge'
import { pickMove } from '../engine/choice'
import { nudgeBudgetFor } from '../engine/pokemon'
import { advance, advanceUntil, BALANCE, engineFor, mon, ofType, withBalance } from './helpers'
import type { TraitId } from '../engine/balance'

const MOVES = ['scratch', 'ember', 'growl', 'harden']
const dummy = () => mon('chansey', 80, { moves: ['splash'] })

describe('nudge budget per trait', () => {
  it.each<[TraitId, number]>([
    ['loyal', 5], ['stubborn', 1], ['shy', 3], ['hasty', 3], ['calm', 3], ['playful', 4], ['proud', 2],
  ])('%s Pokémon get %i nudges', (trait, expected) => {
    expect(nudgeBudgetFor(trait, BALANCE)).toBe(expected)
    const engine = engineFor([mon('charmander', 20, { moves: MOVES, trait })], [dummy()])
    expect(engine.active('player').nudgeBudget).toBe(expected)
  })
})

describe('nudge strength curve', () => {
  it('decays per nudge and scales with trust', () => {
    const at = (i: number, trust: number) => nudgeStrengthFor(i, trust, BALANCE)
    // Trust 0 => x0.5, trust 255 => x1.2
    expect(at(0, 0)).toBeCloseTo(0.6 * 0.5)
    expect(at(0, 255)).toBeCloseTo(0.6 * 1.2)
    expect(at(1, 255)).toBeCloseTo(0.4 * 1.2)
    expect(at(2, 255)).toBeCloseTo(0.25 * 1.2)
    expect(at(4, 255)).toBeCloseTo(0.1 * 1.2)
    expect(at(0, 255)).toBeGreaterThan(at(1, 255))
    expect(at(1, 255)).toBeGreaterThan(at(2, 255))
    // The curve's last value repeats for budgets longer than the curve, and strength is capped.
    expect(at(9, 255)).toBeCloseTo(0.1 * 1.2)
    const boosted = withBalance({ NUDGE_CURVE: [2] })
    expect(nudgeStrengthFor(0, 255, boosted)).toBe(boosted.NUDGE_MAX_STRENGTH)
    expect(at(0, 127.5)).toBeCloseTo(0.6 * (0.5 + 0.7 * 0.5))
  })
})

describe('nudging in a battle', () => {
  it('accepts a nudge, then replaces it with another move for one more budget point', () => {
    const engine = engineFor([mon('charmander', 20, { moves: MOVES })], [dummy()])
    const first = engine.nudge(1)
    expect(first.result).toBe('accepted')
    expect(first.remaining).toBe(4)
    expect(first.events).toContainEqual({ type: 'emote', side: 'player', emote: '!' })
    expect(engine.active('player').pendingNudge).toMatchObject({ moveIndex: 1 })

    const replaced = engine.nudge(0)
    expect(replaced.result).toBe('replaced')
    expect(replaced.remaining).toBe(3)
    expect(engine.active('player').pendingNudge?.moveIndex).toBe(0)
    // The second nudge of the battle uses the second curve entry.
    expect(engine.active('player').pendingNudge?.strength).toBeCloseTo(nudgeStrengthFor(1, 120, BALANCE))
  })

  it('does nothing and costs nothing when the same move is nudged again', () => {
    const engine = engineFor([mon('charmander', 20, { moves: MOVES })], [dummy()])
    engine.nudge(1)
    const again = engine.nudge(1)
    expect(again.result).toBe('same-move')
    expect(again.remaining).toBe(4)
    expect(engine.active('player').nudgesUsed).toBe(1)
  })

  it('shows 💢 and does nothing once the budget is spent', () => {
    const engine = engineFor([mon('charmander', 20, { moves: MOVES, trait: 'stubborn' })], [dummy()])
    expect(engine.nudge(0).result).toBe('accepted')
    const spent = engine.nudge(1)
    expect(spent.result).toBe('exhausted')
    expect(spent.events).toContainEqual({ type: 'emote', side: 'player', emote: '💢' })
    expect(engine.active('player').pendingNudge?.moveIndex).toBe(0)
  })

  it('uses up the nudge when the Pokémon chooses, and reports whether it was followed', () => {
    const engine = engineFor([mon('charmander', 20, { moves: MOVES })], [dummy()], { seed: 7 })
    engine.nudge(1)
    const events = advanceUntil(engine, es => es.some(e => e.type === 'move-chosen' && e.side === 'player'))
    const chosen = ofType(events, 'move-chosen').find(e => e.side === 'player')!
    expect(chosen.followedNudge).not.toBeNull()
    expect(engine.active('player').pendingNudge).toBeNull()
    const emote = ofType(events, 'emote').find(e => e.side === 'player' && (e.emote === '♪' || e.emote === '…'))
    expect(emote?.emote).toBe(chosen.followedNudge ? '♪' : '…')
  })

  it('shows no follow/ignore emote when nothing was nudged', () => {
    const engine = engineFor([mon('charmander', 20, { moves: MOVES })], [dummy()])
    const events = advanceUntil(engine, es => es.some(e => e.type === 'move-chosen' && e.side === 'player'))
    expect(ofType(events, 'move-chosen').find(e => e.side === 'player')!.followedNudge).toBeNull()
    expect(ofType(events, 'emote')).toHaveLength(0)
  })

  it('follows a nudge at least as often as the nudge strength says (statistically)', () => {
    let followed = 0
    const runs = 400
    for (let seed = 1; seed <= runs; seed++) {
      const engine = engineFor([mon('charmander', 20, { moves: MOVES, trust: 255 })], [dummy()], { seed })
      engine.nudge(3) // Harden: unlikely on its own
      const events = advanceUntil(engine, es => es.some(e => e.type === 'move-chosen' && e.side === 'player'))
      if (ofType(events, 'move-chosen').find(e => e.side === 'player')!.followedNudge) followed++
    }
    // strength = 0.6 * 1.2 = 0.72, plus the natural chance of Harden
    expect(followed / runs).toBeGreaterThan(0.68)
    expect(followed / runs).toBeLessThan(0.9)
  })

  it('stubborn Pokémon ignore nudges on moves that deal no damage, but still pay for them', () => {
    const engine = engineFor([mon('charmander', 20, { moves: MOVES, trait: 'stubborn' })], [dummy()])
    const result = engine.nudge(3) // Harden
    expect(result.result).toBe('accepted')
    expect(engine.active('player').pendingNudge?.strength).toBe(0)
    const dmg = engineFor([mon('charmander', 20, { moves: MOVES, trait: 'stubborn' })], [dummy()])
    dmg.nudge(1)
    expect(dmg.active('player').pendingNudge!.strength).toBeGreaterThan(0)
  })

  it('respects the paused flag', () => {
    const paused = engineFor([mon('charmander', 20, { moves: MOVES })], [dummy()], { balance: withBalance({ NUDGE_ALLOWED_WHILE_PAUSED: false }) })
    paused.setPaused(true)
    expect(paused.nudge(0).result).toBe('unavailable')
    paused.setPaused(false)
    expect(paused.nudge(0).result).toBe('accepted')
    const allowed = engineFor([mon('charmander', 20, { moves: MOVES })], [dummy()])
    allowed.setPaused(true)
    expect(allowed.nudge(0).result).toBe('accepted')
  })

  it('rejects nudges on empty or missing moves', () => {
    const engine = engineFor([mon('charmander', 20, { moves: ['scratch'] })], [dummy()])
    expect(engine.nudge(3).result).toBe('unavailable')
    engine.active('player').moves[0].pp = 0
    expect(engine.nudge(0).result).toBe('unavailable')
  })

  it('can refill the budget slowly when the optional flag is on', () => {
    const engine = engineFor([mon('charmander', 20, { moves: MOVES, trait: 'stubborn' })], [dummy()], {
      balance: withBalance({ NUDGE_REFILL_ENABLED: true, NUDGE_REFILL_MS: 5000 }),
    })
    engine.nudge(0)
    expect(engine.active('player').nudgesUsed).toBe(1)
    advance(engine, 12000)
    expect(engine.active('player').nudgesUsed).toBe(0)
  })

  it('never nudges the opponent', () => {
    const engine = engineFor([mon('charmander', 20, { moves: MOVES })], [mon('rattata', 10)])
    advance(engine, 5000)
    expect(engine.active('enemy').pendingNudge).toBeNull()
    expect(engine.debugChoice('enemy').nudgeStrength).toBe(0)
    expect(pickMove).toBeTypeOf('function')
  })
})
