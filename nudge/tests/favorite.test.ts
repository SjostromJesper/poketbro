import { describe, expect, it } from 'vitest'
import { computeChoice } from '../engine/choice'
import { favoriteSwitchMargin, favoriteThreshold } from '../engine/favorite'
import { createBattler } from '../engine/pokemon'
import { applyBattleOutcome, learnMove, updateFavorite } from '../engine/progression'
import type { BattleOutcome, OwnedPokemon, PartyUpdate } from '../engine/types'
import { advance, BALANCE, data, engineFor, mon } from './helpers'

const MOVES = ['scratch', 'ember', 'growl', 'tackle']

function won(p: OwnedPokemon, movesUsed: Record<string, number>, nudgedMoves: Record<string, number> = {}): BattleOutcome {
  const update: PartyUpdate = {
    uid: p.uid, currentHp: p.currentHp, status: null, moves: p.moves, heldItem: null, fainted: false, participated: true,
    movesUsed, nudgedMoves, followedNudge: false, trait: p.trait,
  }
  return { result: 'win', xp: {}, defeated: [], caught: null, party: [update] }
}

describe('favorite move formation', () => {
  it('needs both enough progress and enough trust', () => {
    const threshold = favoriteThreshold('calm', BALANCE)
    const low = mon('charmander', 12, { moves: MOVES, trait: 'calm', trust: BALANCE.FAVORITE_MIN_TRUST - 1 })
    low.habits.ember = threshold
    expect(updateFavorite(data, BALANCE, low)).toBeNull()
    expect(low.favoriteMove).toBeUndefined()

    const shy = mon('charmander', 12, { moves: MOVES, trait: 'calm', trust: BALANCE.FAVORITE_MIN_TRUST })
    shy.habits.ember = threshold - 1
    expect(updateFavorite(data, BALANCE, shy)).toBeNull()

    shy.habits.ember = threshold
    expect(updateFavorite(data, BALANCE, shy)).toMatchObject({ kind: 'new', move: 'ember' })
    expect(shy.favoriteMove).toBe('ember')
  })

  it('counts moves used because of a nudge double (triple for loyal Pokémon)', () => {
    const calm = mon('charmander', 12, { moves: MOVES, trait: 'calm', trust: 100 })
    applyBattleOutcome(data, BALANCE, [calm], won(calm, { ember: 3, scratch: 3 }, { ember: 3 }))
    expect(calm.habits.ember).toBe(6)
    expect(calm.habits.scratch).toBe(3)

    const loyal = mon('charmander', 12, { moves: MOVES, trait: 'loyal', trust: 100 })
    applyBattleOutcome(data, BALANCE, [loyal], won(loyal, { ember: 3, scratch: 3 }, { ember: 3 }))
    expect(loyal.habits.ember).toBe(9)
  })

  it('forms a favorite through applyBattleOutcome and reports it', () => {
    const p = mon('charmander', 12, { moves: MOVES, trait: 'loyal', trust: 160 })
    const events = []
    for (let i = 0; i < 6 && !p.favoriteMove; i++) events.push(...applyBattleOutcome(data, BALANCE, [p], won(p, { ember: 5, scratch: 1 }, { ember: 5 })).favorites)
    expect(p.favoriteMove).toBe('ember')
    expect(events).toEqual([{ uid: p.uid, kind: 'new', move: 'ember' }])
  })

  it('only one favorite at a time: a rival must beat it by the switch margin', () => {
    const p = mon('charmander', 12, { moves: MOVES, trait: 'calm', trust: 200 })
    p.favoriteMove = 'ember'
    p.habits.ember = 30
    const margin = favoriteSwitchMargin('calm', BALANCE)
    p.habits.scratch = 30 + margin - 1
    expect(updateFavorite(data, BALANCE, p)).toBeNull()
    expect(p.favoriteMove).toBe('ember')

    p.habits.scratch = 30 + margin
    expect(updateFavorite(data, BALANCE, p)).toMatchObject({ kind: 'switch', move: 'scratch', previous: 'ember' })
    expect(p.favoriteMove).toBe('scratch')
    expect(p.habits.ember).toBe(15)
  })

  it('stubborn Pokémon are much harder to switch than playful ones', () => {
    expect(favoriteSwitchMargin('stubborn', BALANCE)).toBeGreaterThan(favoriteSwitchMargin('calm', BALANCE))
    expect(favoriteSwitchMargin('playful', BALANCE)).toBeLessThan(favoriteSwitchMargin('calm', BALANCE))
    expect(favoriteThreshold('proud', BALANCE)).toBeLessThan(favoriteThreshold('calm', BALANCE))
    expect(favoriteThreshold('playful', BALANCE)).toBeGreaterThan(favoriteThreshold('calm', BALANCE))
  })
})

describe('forgetting the favorite', () => {
  it('costs trust, clears the favorite and blocks a new one for a while', () => {
    const p = mon('charmander', 12, { moves: MOVES, trait: 'calm', trust: 200 })
    p.favoriteMove = 'ember'
    p.habits.ember = 40
    expect(learnMove(data, p, 'flamethrower', 1, BALANCE)).toBe(true)
    expect(p.favoriteMove).toBeUndefined()
    expect(p.trust).toBe(200 - BALANCE.FAVORITE_FORGET_TRUST_PENALTY)
    expect(p.favoriteCooldown).toBe(BALANCE.FAVORITE_COOLDOWN_BATTLES)

    // Even with a lot of progress, no new favorite during the cooldown.
    p.habits.scratch = 100
    expect(updateFavorite(data, BALANCE, p)).toBeNull()
    for (let i = 0; i < BALANCE.FAVORITE_COOLDOWN_BATTLES; i++) applyBattleOutcome(data, BALANCE, [p], won(p, {}))
    expect(p.favoriteCooldown).toBe(0)
    expect(p.favoriteMove).toBe('scratch')
  })

  it('forgetting another move has no penalty', () => {
    const p = mon('charmander', 12, { moves: MOVES, trait: 'calm', trust: 200 })
    p.favoriteMove = 'ember'
    expect(learnMove(data, p, 'flamethrower', 0, BALANCE)).toBe(false)
    expect(p.favoriteMove).toBe('ember')
    expect(p.trust).toBe(200)
  })
})

describe('favorite in battle', () => {
  const foeOf = (name: string) => createBattler(data, BALANCE, mon(name, 12), 'enemy', 0)

  it('raises the favorite move weight', () => {
    const p = mon('charmander', 12, { moves: MOVES, trait: 'calm', trust: 160 })
    const plain = computeChoice({ self: createBattler(data, BALANCE, p, 'player', 0), foe: foeOf('rattata'), data, balance: BALANCE })
    p.favoriteMove = 'ember'
    const loved = computeChoice({ self: createBattler(data, BALANCE, p, 'player', 0), foe: foeOf('rattata'), data, balance: BALANCE })
    const row = (c: typeof plain) => c.moves.find(m => m.move === 'ember')!
    expect(row(loved).favorite).toBe(true)
    expect(row(loved).favoriteMult).toBe(BALANCE.FAVORITE_WEIGHT_MULT)
    expect(row(loved).pAuto).toBeGreaterThan(row(plain).pAuto)
  })

  it('keeps the weight but gives no bonus when the move is useless and trust is high', () => {
    const make = (trust: number) => {
      const p = mon('charmander', 12, { moves: MOVES, trait: 'calm', trust })
      p.favoriteMove = 'scratch'
      return computeChoice({ self: createBattler(data, BALANCE, p, 'player', 0), foe: foeOf('gastly'), data, balance: BALANCE }).moves.find(m => m.move === 'scratch')!
    }
    expect(make(BALANCE.FAVORITE_SMART_TRUST - 1).favoriteMult).toBe(BALANCE.FAVORITE_WEIGHT_MULT)
    expect(make(BALANCE.FAVORITE_SMART_TRUST).favoriteMult).toBe(1)
  })

  it('makes nudging towards the favorite free, but not other moves', () => {
    const p = mon('charmander', 12, { moves: MOVES, trait: 'calm', trust: 160 })
    p.favoriteMove = 'ember'
    const engine = engineFor([p], [mon('rattata', 12)])
    const budget = engine.state.player.battlers[0].nudgeBudget
    for (let i = 0; i < budget + 3; i++) {
      engine.nudge(0)
      engine.nudge(1)
    }
    const b = engine.state.player.battlers[0]
    expect(b.pendingNudge?.moveIndex).toBe(1)
    // Only the nudges towards Scratch were paid for.
    expect(b.nudgesUsed).toBe(budget)
    // The strength does not drop for favorite nudges.
    const first = engineFor([p], [mon('rattata', 12)])
    first.nudge(0)
    expect(first.state.player.battlers[0].pendingNudge?.strength).toBeGreaterThan(0)
  })

  it('weakens a nudge away from the favorite while it is usable', () => {
    const p = mon('charmander', 12, { moves: MOVES, trait: 'calm', trust: 160 })
    const away = (favorite: boolean) => {
      p.favoriteMove = favorite ? 'ember' : undefined
      const c = computeChoice({ self: createBattler(data, BALANCE, p, 'player', 0), foe: foeOf('rattata'), data, balance: BALANCE, nudge: { moveIndex: 0, strength: 0.5 } })
      return c.nudgeStrength
    }
    expect(away(true)).toBeCloseTo(0.5 * BALANCE.NUDGE_AWAY_FROM_FAVORITE_MULT, 10)
    expect(away(false)).toBe(0.5)
  })

  it('gives the favorite a head start on the next ATB bar and a ♥ when used', () => {
    const p = mon('charmander', 12, { moves: ['ember'], trait: 'calm', trust: 160 })
    p.favoriteMove = 'ember'
    const engine = engineFor([p], [mon('rattata', 3)], { seed: 4 })
    const events = advance(engine, 6000)
    expect(events.some(e => e.type === 'move-chosen' && e.side === 'player' && e.favorite)).toBe(true)
    expect(events.some(e => e.type === 'emote' && e.side === 'player' && e.emote === '♥')).toBe(true)
  })

  it('reports nudged uses in the outcome so progress can count them double', () => {
    const p = mon('charmander', 20, { moves: ['ember', 'scratch'], trait: 'calm', trust: 160 })
    const engine = engineFor([p], [mon('rattata', 3)], { seed: 2 })
    engine.nudge(0)
    advance(engine, 40000)
    expect(engine.finished).toBe(true)
    const update = engine.outcome!.party[0]
    const nudged = Object.values(update.nudgedMoves).reduce((a, b) => a + b, 0)
    expect(nudged).toBeGreaterThanOrEqual(0)
    expect(nudged).toBeLessThanOrEqual(Object.values(update.movesUsed).reduce((a, b) => a + b, 0))
  })
})
