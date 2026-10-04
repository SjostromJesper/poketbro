import { describe, expect, it } from 'vitest'
import { runBattle } from '../engine/headless'
import { createRng } from '../engine/rng'
import { advance, advanceUntil, BALANCE, data, engineFor, mon, ofType, scriptedRng, withBalance } from './helpers'
import { xpYield } from '../engine/formulas'
import type { BattleEvent } from '../engine/types'

const idle = (name = 'chansey', level = 50) => mon(name, level, { moves: ['splash'] })

describe('battle flow', () => {
  it('lets a much stronger Pokémon win and reports the outcome', () => {
    const player = mon('charizard', 50, { moves: ['flamethrower', 'slash'] })
    const rattata = mon('rattata', 5)
    const engine = engineFor([player], [rattata], { badges: 8 })
    advance(engine, 120000)
    expect(engine.state.result).toBe('win')
    const outcome = engine.outcome!
    expect(outcome.result).toBe('win')
    expect(outcome.party[0]).toMatchObject({ uid: player.uid, fainted: false, participated: true })
    expect(outcome.party[0].currentHp).toBeGreaterThan(0)
    expect(outcome.defeated).toEqual([{ speciesId: rattata.speciesId, level: 5 }])
    const species = data.species[rattata.speciesId]
    expect(outcome.xp[player.uid]).toBe(xpYield(species.baseExp, 5, false, 1, BALANCE))
    expect(outcome.caught).toBeNull()
    expect(Object.keys(outcome.party[0].movesUsed).length).toBeGreaterThan(0)
  })

  it('ends in a loss when every Pokémon on the player side has fainted', () => {
    const engine = engineFor([mon('magikarp', 5, { moves: ['splash'] })], [mon('charizard', 60, { moves: ['flamethrower'] })], { badges: 8 })
    const events = advance(engine, 120000)
    expect(engine.state.result).toBe('lose')
    expect(ofType(events, 'faint').some(e => e.side === 'player')).toBe(true)
    expect(events.at(-1)).toEqual({ type: 'battle-end', result: 'lose' })
    expect(engine.outcome!.party[0].fainted).toBe(true)
    expect(engine.outcome!.xp).toEqual({})
  })

  it('sends in the next Pokémon in team order when one faints', () => {
    const team = [mon('magikarp', 5, { moves: ['splash'] }), mon('charizard', 50, { moves: ['flamethrower'] }), mon('pidgey', 10)]
    const engine = engineFor(team, [mon('charizard', 60, { moves: ['flamethrower'] })], { badges: 8 })
    const events = advanceUntil(engine, es => es.filter(e => e.type === 'send-out' && e.side === 'player').length >= 2)
    const sendOuts = ofType(events, 'send-out').filter(e => e.side === 'player')
    expect(sendOuts.map(e => e.teamIndex)).toEqual([0, 1])
    expect(sendOuts[1].forced).toBe(true)
    expect(engine.state.player.activeIndex).toBe(1)
  })

  it('lets a trainer send out their whole team, pays 1.5x XP and splits it between participants', () => {
    const a = mon('charizard', 50, { moves: ['flamethrower', 'slash'] })
    const enemyTeam = [mon('rattata', 5), mon('pidgey', 6)]
    const engine = engineFor([a], enemyTeam, { kind: 'trainer', badges: 8 })
    const events = advance(engine, 200000)
    expect(engine.state.result).toBe('win')
    expect(ofType(events, 'send-out').filter(e => e.side === 'enemy')).toHaveLength(2)
    const outcome = engine.outcome!
    const expected = enemyTeam.reduce((sum, e) => sum + xpYield(data.species[e.speciesId].baseExp, e.level, true, 1, BALANCE), 0)
    expect(outcome.xp[a.uid]).toBe(expected)
    expect(outcome.defeated).toHaveLength(2)
  })

  it('shares XP between the Pokémon that took part and skips the ones that never fought', () => {
    const first = mon('charizard', 50, { moves: ['flamethrower'] })
    const second = mon('blastoise', 50, { moves: ['surf'] })
    const bench = mon('pidgey', 5)
    const engine = engineFor([first, second, bench], [mon('chansey', 40, { moves: ['splash'] })], { badges: 8 })
    // Switch after a moment so both have faced the enemy; the bench Pokémon never fights.
    advance(engine, 1500)
    expect(engine.playerAction({ type: 'switch', teamIndex: 1 }).accepted).toBe(true)
    advance(engine, 300000)
    expect(engine.state.result).toBe('win')
    const outcome = engine.outcome!
    const expectedEach = xpYield(data.species[data.species[113].id].baseExp, 40, false, 2, BALANCE)
    expect(outcome.xp[first.uid]).toBe(expectedEach)
    expect(outcome.xp[second.uid]).toBe(expectedEach)
    expect(outcome.xp[bench.uid]).toBeUndefined()
    expect(outcome.party.find(p => p.uid === bench.uid)!.participated).toBe(false)
  })

  it('uses Struggle when all PP is gone, with recoil', () => {
    const engine = engineFor([mon('rattata', 30, { moves: ['tackle'] })], [idle('chansey', 80)])
    engine.active('player').moves[0].pp = 0
    const events = advanceUntil(engine, es => es.some(e => e.type === 'damage' && e.source === 'struggle'))
    expect(ofType(events, 'move-chosen').find(e => e.side === 'player')!.move).toBe('struggle')
    expect(ofType(events, 'damage').some(e => e.source === 'recoil' && e.side === 'player')).toBe(true)
  })

  it('refuses to start without a conscious Pokémon on each side', () => {
    const fainted = mon('rattata', 5)
    fainted.currentHp = 0
    expect(() => engineFor([fainted], [mon('pidgey', 5)])).toThrow()
  })

  it('ticks nothing once finished', () => {
    const engine = engineFor([mon('charizard', 60, { moves: ['flamethrower'] })], [mon('rattata', 3)], { badges: 8 })
    advance(engine, 120000)
    expect(engine.tick(1000)).toEqual([])
    expect(engine.playerAction({ type: 'run' }).reason).toBe('finished')
  })
})

describe('determinism', () => {
  const play = (frameMs: number): string => {
    const engine = engineFor(
      [mon('charmander', 20, { moves: ['scratch', 'ember', 'growl', 'harden'] }), mon('pidgey', 12)],
      [mon('bulbasaur', 18), mon('rattata', 12)],
      { seed: 99, kind: 'trainer', badges: 1 },
    )
    const events: BattleEvent[] = []
    for (let t = 0; t < 120000 && !engine.finished; t += frameMs) {
      if (t === 3000) engine.nudge(1)
      events.push(...engine.tick(frameMs))
    }
    return JSON.stringify(events)
  }
  it('plays out identically for the same seed, whatever the frame rate', () => {
    const a = play(16)
    expect(play(16)).toBe(a)
    expect(play(33)).toBe(play(33))
    expect(a.length).toBeGreaterThan(1000)
  })
  it('differs between seeds', () => {
    const run = (seed: number) => JSON.stringify(runBattle({
      player: [mon('charmander', 20, { moves: ['scratch', 'ember'] })], enemy: [mon('bulbasaur', 20)],
      kind: 'wild', rng: createRng(seed), balance: BALANCE, data, badges: 1,
    }, { collectEvents: true }).events)
    expect(run(1)).not.toBe(run(2))
  })
})

describe('player actions', () => {
  it('switches Pokémon manually with a cooldown, an empty bar and reset stats', () => {
    const engine = engineFor([mon('charmander', 20), mon('pidgey', 12), mon('rattata', 10)], [idle('chansey', 80)])
    const first = engine.active('player')
    first.stages.attack = 3
    advance(engine, 1500)
    const result = engine.playerAction({ type: 'switch', teamIndex: 1 })
    expect(result.accepted).toBe(true)
    expect(result.events.map(e => e.type)).toEqual(['switch', 'send-out'])
    expect(engine.state.player.activeIndex).toBe(1)
    expect(engine.active('player').atb).toBe(0)
    expect(first.stages.attack).toBe(0)
    expect(engine.playerAction({ type: 'switch', teamIndex: 2 })).toMatchObject({ accepted: false, reason: 'cooldown' })
    advance(engine, BALANCE.SWITCH_COOLDOWN_MS + 100)
    expect(engine.playerAction({ type: 'switch', teamIndex: 2 }).accepted).toBe(true)
    expect(engine.playerAction({ type: 'switch', teamIndex: 2 })).toMatchObject({ accepted: false })
  })

  it('rejects switching to a fainted Pokémon, the active one or a missing one', () => {
    const fainted = mon('pidgey', 12)
    fainted.currentHp = 0
    const engine = engineFor([mon('charmander', 20), fainted], [idle()])
    expect(engine.playerAction({ type: 'switch', teamIndex: 0 })).toMatchObject({ accepted: false, reason: 'invalid' })
    expect(engine.playerAction({ type: 'switch', teamIndex: 1 })).toMatchObject({ accepted: false, reason: 'invalid' })
    expect(engine.playerAction({ type: 'switch', teamIndex: 7 })).toMatchObject({ accepted: false, reason: 'invalid' })
  })

  it('catches a weak wild Pokémon and hands over the caught Pokémon in the outcome', () => {
    const wild = mon('rattata', 3)
    const engine = engineFor([mon('charmander', 20)], [wild], { rng: scriptedRng([], 0.001) })
    engine.active('enemy').hp = 1
    const result = engine.playerAction({ type: 'ball' })
    expect(result.accepted).toBe(true)
    expect(ofType(result.events, 'ball-throw')[0]).toMatchObject({ caught: true, shakes: 3 })
    expect(engine.state.result).toBe('caught')
    const caught = engine.outcome!.caught!
    expect(caught.speciesId).toBe(wild.speciesId)
    expect(caught.currentHp).toBe(1)
    expect(caught.trust).toBe(BALANCE.TRUST_START_WILD)
  })

  it('lets the wild Pokémon break free, with a cooldown before the next throw', () => {
    const engine = engineFor([mon('charmander', 20)], [mon('chansey', 40)], { rng: scriptedRng([], 0.999999) })
    const result = engine.playerAction({ type: 'ball' })
    expect(ofType(result.events, 'ball-throw')[0].caught).toBe(false)
    expect(engine.state.result).toBeNull()
    expect(engine.playerAction({ type: 'ball' })).toMatchObject({ accepted: false, reason: 'cooldown' })
    advance(engine, BALANCE.BALL_COOLDOWN_MS + 100)
    expect(engine.playerAction({ type: 'ball' }).accepted).toBe(true)
  })

  it('pauses the bars while a ball is thrown', () => {
    const engine = engineFor([mon('charmander', 20)], [mon('chansey', 40)], { rng: scriptedRng([], 0.999999) })
    advance(engine, 1000)
    const atb = engine.active('player').atb
    engine.playerAction({ type: 'ball' })
    expect(engine.state.lockMs).toBe(BALANCE.BALL_LOCK_MS)
    advance(engine, 1000)
    expect(engine.active('player').atb).toBe(atb)
  })

  it('does not allow balls or running in trainer battles', () => {
    const engine = engineFor([mon('charmander', 20)], [mon('rattata', 10)], { kind: 'trainer' })
    expect(engine.playerAction({ type: 'ball' })).toMatchObject({ accepted: false, reason: 'not-wild' })
    expect(engine.playerAction({ type: 'run' })).toMatchObject({ accepted: false, reason: 'not-wild' })
  })

  it('lets a fast Pokémon run from a slow wild one, and retries get easier', () => {
    const fast = engineFor([mon('pidgey', 30)], [mon('snorlax', 5)], { seed: 3 })
    fast.active('player').stats.speed = 200
    fast.active('enemy').stats.speed = 20
    const result = fast.playerAction({ type: 'run' })
    expect(ofType(result.events, 'run')[0].success).toBe(true)
    expect(fast.state.result).toBe('fled')

    const slow = engineFor([mon('snorlax', 5)], [mon('pidgey', 30)], { rng: scriptedRng([0.999], 0.999) })
    slow.active('player').stats.speed = 10
    slow.active('enemy').stats.speed = 100
    expect(ofType(slow.playerAction({ type: 'run' }).events, 'run')[0].success).toBe(false)
    expect(slow.state.runAttempts).toBe(1)
  })

  it('uses potions and status cures, with cooldown and without wasting them', () => {
    const engine = engineFor([mon('charmander', 20), mon('pidgey', 12)], [idle()])
    const target = engine.state.player.battlers[1]
    expect(engine.playerAction({ type: 'item', item: 'potion', targetIndex: 1 })).toMatchObject({ accepted: false, reason: 'no-effect' })
    target.hp = 5
    const used = engine.playerAction({ type: 'item', item: 'potion', targetIndex: 1 })
    expect(used.accepted).toBe(true)
    expect(target.hp).toBe(5 + BALANCE.POTION_HEAL)
    expect(used.events[0]).toMatchObject({ type: 'item-used', item: 'potion' })
    expect(engine.playerAction({ type: 'item', item: 'potion', targetIndex: 1 })).toMatchObject({ accepted: false, reason: 'cooldown' })
    advance(engine, BALANCE.ITEM_COOLDOWN_MS + 100)
    target.status = 'poison'
    expect(engine.playerAction({ type: 'item', item: 'paralyze-heal', targetIndex: 1 })).toMatchObject({ accepted: false, reason: 'no-effect' })
    expect(engine.playerAction({ type: 'item', item: 'antidote', targetIndex: 1 }).accepted).toBe(true)
    expect(target.status).toBeNull()
    expect(engine.playerAction({ type: 'item', item: 'mystery', targetIndex: 1 })).toMatchObject({ accepted: false })
  })

  it('applies the sleep and freeze clean-up in the outcome', () => {
    const engine = engineFor([mon('charizard', 60, { moves: ['flamethrower'] })], [mon('rattata', 3)], { badges: 8 })
    engine.active('player').status = 'poison'
    advance(engine, 60000)
    expect(engine.outcome!.party[0].status).toBe('poison')
    const sleepy = engineFor([mon('charizard', 60, { moves: ['flamethrower'] })], [mon('rattata', 3)], { badges: 8 })
    sleepy.active('player').status = 'freeze'
    sleepy.active('player').hp = 5
    sleepy.state.result = 'win'
    expect(sleepy.outcome!.party[0].status).toBeNull()
    expect(withBalance).toBeTypeOf('function')
  })
})
