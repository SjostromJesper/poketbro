import { describe, expect, it } from 'vitest'
import { executeMove, type ExecContext } from '../engine/moveExec'
import { createBattler } from '../engine/pokemon'
import { statusDamagePerSecond } from '../engine/status'
import type { BattleEvent } from '../engine/types'
import { advance, BALANCE, constRng, data, engineFor, mon, ofType, scriptedRng, withBalance } from './helpers'

function setup(playerName: string, enemyName: string, rngValue = 0.99, playerMoves?: string[]) {
  const user = createBattler(data, BALANCE, mon(playerName, 30, { moves: playerMoves }), 'player', 0)
  const target = createBattler(data, BALANCE, mon(enemyName, 30), 'enemy', 0)
  const events: BattleEvent[] = []
  const ctx: ExecContext = { rng: constRng(rngValue), balance: BALANCE, data, events }
  return { user, target, ctx, events }
}

describe('move execution', () => {
  it('deals damage with type effectiveness and emits a damage event', () => {
    const { user, target, ctx, events } = setup('charmander', 'bulbasaur')
    executeMove(ctx, user, target, 'ember')
    const damage = ofType(events, 'damage')[0]
    expect(damage.effectiveness).toBe(2)
    expect(target.hp).toBe(target.stats.hp - damage.amount)
    expect(damage.amount).toBeGreaterThan(0)
  })

  it('reports immunity instead of damage', () => {
    const { user, target, ctx, events } = setup('rattata', 'gastly')
    executeMove(ctx, user, target, 'tackle')
    expect(ofType(events, 'no-effect')[0].reason).toBe('immune')
    expect(target.hp).toBe(target.stats.hp)
  })

  it('misses according to accuracy (and evasion stages)', () => {
    const { user, target, ctx, events } = setup('rattata', 'pidgey', 0.97)
    executeMove(ctx, user, target, 'thunder') // 70 % accuracy
    expect(ofType(events, 'miss')).toHaveLength(1)
    const hit = setup('rattata', 'pidgey', 0.5)
    executeMove(hit.ctx, hit.user, hit.target, 'thunder')
    expect(ofType(hit.events, 'miss')).toHaveLength(0)
    const evasive = setup('rattata', 'pidgey', 0.6)
    evasive.target.stages.evasion = 3 // 70 % * 3/6 = 35 %
    executeMove(evasive.ctx, evasive.user, evasive.target, 'thunder')
    expect(ofType(evasive.events, 'miss')).toHaveLength(1)
  })

  it('hits multiple times for multi-hit moves', () => {
    const { user, target, ctx, events } = setup('rattata', 'chansey', 0.5, ['double-slap'])
    executeMove(ctx, user, target, 'double-slap')
    const hits = ofType(events, 'damage').length
    expect(hits).toBeGreaterThanOrEqual(2)
    expect(ofType(events, 'multi-hit')[0].hits).toBe(hits)
    const two = setup('rattata', 'chansey', 0.5, ['double-kick'])
    executeMove(two.ctx, two.user, two.target, 'double-kick')
    expect(ofType(two.events, 'damage')).toHaveLength(2)
  })

  it('heals the user from drain moves and hurts it with recoil', () => {
    const drain = setup('bulbasaur', 'squirtle', 0.99, ['mega-drain'])
    drain.user.hp = 5
    executeMove(drain.ctx, drain.user, drain.target, 'mega-drain')
    const dealt = ofType(drain.events, 'damage')[0].amount
    expect(drain.user.hp).toBe(5 + Math.max(1, Math.floor(dealt / 2)))
    expect(ofType(drain.events, 'heal')[0].source).toBe('drain')

    const recoil = setup('tauros', 'chansey', 0.5, ['take-down'])
    executeMove(recoil.ctx, recoil.user, recoil.target, 'take-down')
    const hit = ofType(recoil.events, 'damage')[0].amount
    expect(recoil.user.hp).toBe(recoil.user.stats.hp - Math.max(1, Math.floor((hit * 25) / 100)))
  })

  it('changes stat stages with limits and reports when they cannot go further', () => {
    const { user, target, ctx, events } = setup('rattata', 'pidgey', 0.99, ['swords-dance'])
    executeMove(ctx, user, target, 'swords-dance')
    expect(user.stages.attack).toBe(2)
    executeMove(ctx, user, target, 'swords-dance')
    executeMove(ctx, user, target, 'swords-dance')
    executeMove(ctx, user, target, 'swords-dance')
    expect(user.stages.attack).toBe(6)
    const last = ofType(events, 'stat-change').at(-1)!
    expect(last.delta).toBe(0)
    const growl = setup('rattata', 'pidgey', 0.99, ['growl'])
    executeMove(growl.ctx, growl.user, growl.target, 'growl')
    expect(growl.target.stages.attack).toBe(-1)
    expect(growl.user.stages.attack).toBe(0)
  })

  it('applies secondary stat changes to the user for moves like Overheat', () => {
    const { user, target, ctx } = setup('charizard', 'chansey', 0.5, ['overheat'])
    executeMove(ctx, user, target, 'overheat')
    expect(user.stages.spAttack).toBe(-2)
    expect(target.stages.spAttack).toBe(0)
  })

  it('heals with recovery moves, but not above max HP', () => {
    const { user, target, ctx, events } = setup('chansey', 'rattata', 0.99, ['recover'])
    user.hp = 1
    executeMove(ctx, user, target, 'recover')
    expect(user.hp).toBe(1 + Math.floor(user.stats.hp / 2))
    user.hp = user.stats.hp
    executeMove(ctx, user, target, 'recover')
    expect(ofType(events, 'no-effect').at(-1)!.reason).toBe('failed')
  })

  it('lets inert moves be used without effect', () => {
    const { user, target, ctx, events } = setup('magikarp', 'rattata', 0.99, ['splash'])
    executeMove(ctx, user, target, 'splash')
    expect(events.some(e => e.type === 'unsupported')).toBe(true)
  })

  it('flinch cuts the target bar in half', () => {
    const { user, target, ctx, events } = setup('rattata', 'chansey', 0, ['fake-out'])
    target.atb = 800
    executeMove(ctx, user, target, 'fake-out')
    expect(events.some(e => e.type === 'flinch')).toBe(true)
    expect(target.atb).toBe(400)
  })
})

describe('status ailments', () => {
  it('inflicts burn, paralysis, poison, sleep and freeze from moves', () => {
    for (const [move, status] of [['will-o-wisp', 'burn'], ['thunder-wave', 'paralysis'], ['poison-powder', 'poison'], ['sleep-powder', 'sleep'], ['ice-beam', 'freeze']] as const) {
      const { user, target, ctx } = setup('bulbasaur', 'rattata', 0, [move])
      if (!data.moves[move]) continue
      executeMove(ctx, user, target, move)
      expect(target.status, move).toBe(status)
    }
  })

  it('respects type immunities (Fire cannot burn, Electric cannot be paralysed, Poison cannot be poisoned)', () => {
    const fire = setup('bulbasaur', 'charmander', 0, ['will-o-wisp'])
    executeMove(fire.ctx, fire.user, fire.target, 'will-o-wisp')
    expect(fire.target.status).toBeNull()
    const electric = setup('bulbasaur', 'pikachu', 0, ['stun-spore'])
    executeMove(electric.ctx, electric.user, electric.target, 'stun-spore')
    expect(electric.target.status).toBeNull()
    const poison = setup('bulbasaur', 'ekans', 0, ['poison-powder'])
    executeMove(poison.ctx, poison.user, poison.target, 'poison-powder')
    expect(poison.target.status).toBeNull()
    const ground = setup('pikachu', 'geodude', 0, ['thunder-wave'])
    executeMove(ground.ctx, ground.user, ground.target, 'thunder-wave')
    expect(ground.target.status).toBeNull()
    expect(ofType(ground.events, 'no-effect')[0].reason).toBe('immune')
  })

  it('does not stack statuses', () => {
    const { user, target, ctx } = setup('bulbasaur', 'rattata', 0, ['sleep-powder', 'poison-powder'])
    executeMove(ctx, user, target, 'sleep-powder')
    executeMove(ctx, user, target, 'poison-powder')
    expect(target.status).toBe('sleep')
  })

  it('confuses and seeds', () => {
    const confuse = setup('rattata', 'pidgey', 0, ['supersonic'])
    executeMove(confuse.ctx, confuse.user, confuse.target, 'supersonic')
    expect(confuse.target.confusionMs).toBeGreaterThanOrEqual(BALANCE.CONFUSION_MS_RANGE[0])
    const seed = setup('bulbasaur', 'rattata', 0, ['leech-seed'])
    executeMove(seed.ctx, seed.user, seed.target, 'leech-seed')
    expect(seed.target.seeded).toBe(true)
    const grass = setup('bulbasaur', 'oddish', 0, ['leech-seed'])
    executeMove(grass.ctx, grass.user, grass.target, 'leech-seed')
    expect(grass.target.seeded).toBe(false)
  })

  it('thaws a frozen target hit by a Fire move', () => {
    const { user, target, ctx, events } = setup('charmander', 'bulbasaur', 0.5, ['ember'])
    target.status = 'freeze'
    executeMove(ctx, user, target, 'ember')
    expect(target.status).toBeNull()
    expect(ofType(events, 'status-cured')[0].reason).toBe('thaw')
  })
})

describe('status effects over time (ATB form)', () => {
  // 8 badges: the level-50 Snorlax always obeys, so only the status effects change how often it acts.
  const idle = () => {
    const engine = engineFor([mon('snorlax', 50, { moves: ['splash'] })], [mon('snorlax', 50, { moves: ['splash'] })], { badges: 8 })
    // Endless PP so long samples never end in Struggle.
    for (const side of ['player', 'enemy'] as const) engine.active(side).moves[0].pp = 1e9
    return engine
  }

  it('burn and poison deal damage per second of unlocked time', () => {
    for (const status of ['burn', 'poison'] as const) {
      const engine = idle()
      const victim = engine.active('player')
      victim.status = status
      const start = engine.state.timeMs
      const hp = victim.hp
      advance(engine, 20000)
      const seconds = (engine.state.timeMs - start) / 1000
      const expected = victim.stats.hp * statusDamagePerSecond(victim, BALANCE) * seconds
      expect(hp - victim.hp).toBeGreaterThan(expected * 0.9 - 1)
      expect(hp - victim.hp).toBeLessThan(expected * 1.1 + 1)
    }
  })

  it('paralysis slows the bar and sometimes skips a turn', () => {
    const engine = idle()
    engine.active('player').status = 'paralysis'
    const events = advance(engine, 1500000, 50)
    const skips = ofType(events, 'status-skip').filter(e => e.reason === 'paralysis')
    const acts = ofType(events, 'move-chosen').filter(e => e.side === 'player').length
    expect(skips.length / (skips.length + acts)).toBeGreaterThan(0.18)
    expect(skips.length / (skips.length + acts)).toBeLessThan(0.32)
    const enemyActs = ofType(events, 'move-chosen').filter(e => e.side === 'enemy').length
    // Paralysis halves the effective speed (the bar speed is K * (speed + 100), so the bar is slower, but not by half).
    const speed = engine.active('player').stats.speed
    const expectedRatio = (speed * 0.5 + 100) / (speed + 100)
    expect(Math.abs((acts + skips.length) / enemyActs - expectedRatio)).toBeLessThan(0.08)
  })

  it('sleep freezes the bar for a few seconds, then wakes up', () => {
    const engine = idle()
    const sleeper = engine.active('player')
    sleeper.status = 'sleep'
    sleeper.statusMs = 4000
    const events = advance(engine, 3000)
    expect(sleeper.atb).toBe(0)
    expect(ofType(events, 'move-chosen').filter(e => e.side === 'player')).toHaveLength(0)
    const later = advance(engine, 3000)
    expect(ofType(later, 'status-cured').some(e => e.reason === 'wake')).toBe(true)
    expect(sleeper.status).toBeNull()
  })

  it('freeze lasts until it thaws (a chance each second)', () => {
    const durations: number[] = []
    for (let seed = 1; seed <= 60; seed++) {
      const engine = engineFor([mon('snorlax', 50, { moves: ['splash'] })], [mon('snorlax', 50, { moves: ['splash'] })], { seed, badges: 8 })
      const victim = engine.active('player')
      victim.status = 'freeze'
      const start = engine.state.timeMs
      for (let t = 0; t < 120000 && victim.status === 'freeze'; t += 16) {
        engine.tick(16)
        if (victim.status === 'freeze') expect(victim.atb).toBe(0)
      }
      durations.push(engine.state.timeMs - start)
    }
    const mean = durations.reduce((a, b) => a + b, 0) / durations.length / 1000
    expect(mean).toBeGreaterThan(3)
    expect(mean).toBeLessThan(8)
  })

  it('confusion makes the Pokémon hurt itself about a third of the time, then wears off', () => {
    const engine = idle()
    const victim = engine.active('player')
    victim.confusionMs = 60000
    const events = advance(engine, 50000)
    const hurt = ofType(events, 'status-skip').filter(e => e.reason === 'confusion-hurt').length
    const acts = ofType(events, 'move-chosen').filter(e => e.side === 'player').length
    expect(hurt).toBeGreaterThan(0)
    expect(hurt / (hurt + acts)).toBeGreaterThan(0.15)
    expect(hurt / (hurt + acts)).toBeLessThan(0.5)
    expect(ofType(events, 'damage').some(e => e.source === 'confusion')).toBe(true)

    const short = idle()
    short.active('player').confusionMs = 1000
    expect(ofType(advance(short, 3000), 'status-cured').some(e => e.status === 'confusion')).toBe(true)
  })

  it('leech seed drains the victim and heals the opponent', () => {
    const engine = idle()
    const victim = engine.active('player')
    const sower = engine.active('enemy')
    victim.seeded = true
    sower.hp = Math.floor(sower.stats.hp / 2)
    const before = { victim: victim.hp, sower: sower.hp }
    advance(engine, 15000)
    expect(victim.hp).toBeLessThan(before.victim)
    expect(sower.hp).toBeGreaterThan(before.sower)
  })

  it('Leftovers heal a little over time', () => {
    const engine = engineFor([mon('snorlax', 50, { moves: ['splash'], heldItem: 'leftovers' })], [mon('snorlax', 50, { moves: ['splash'] })], { badges: 8 })
    const holder = engine.active('player')
    holder.hp = Math.floor(holder.stats.hp / 2)
    const before = holder.hp
    advance(engine, 30000)
    expect(holder.hp).toBeGreaterThan(before)
    expect(engine.active('enemy').hp).toBe(engine.active('enemy').stats.hp)
  })

  it('Oran Berry heals 10 HP once when HP drops under half', () => {
    const engine = engineFor([mon('snorlax', 50, { moves: ['splash'], heldItem: 'oran-berry' })], [mon('snorlax', 50, { moves: ['splash'] })])
    const holder = engine.active('player')
    const ctx: ExecContext = { rng: constRng(0.99), balance: BALANCE, data, events: [] }
    holder.hp = Math.floor(holder.stats.hp * 0.55)
    executeMove(ctx, engine.active('enemy'), holder, 'tackle')
    expect(ctx.events.some(e => e.type === 'held-item')).toBe(true)
    expect(holder.heldItemUsed).toBe(true)
    expect(ofType(ctx.events, 'heal').some(e => e.source === 'berry' && e.amount === 10)).toBe(true)
  })

  it('type boosting items add 20 % damage', () => {
    const plain = setup('charmander', 'chansey', 0.5, ['ember'])
    executeMove(plain.ctx, plain.user, plain.target, 'ember')
    const boosted = setup('charmander', 'chansey', 0.5, ['ember'])
    boosted.user.heldItem = 'charcoal'
    executeMove(boosted.ctx, boosted.user, boosted.target, 'ember')
    const a = ofType(plain.events, 'damage')[0].amount
    const b = ofType(boosted.events, 'damage')[0].amount
    expect(b / a).toBeGreaterThan(1.1)
    expect(b / a).toBeLessThan(1.3)
    expect(scriptedRng).toBeTypeOf('function')
    expect(withBalance).toBeTypeOf('function')
  })
})
