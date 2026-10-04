import { describe, expect, it } from 'vitest'
import { advance, advanceUntil, BALANCE, engineFor, mon, ofType } from './helpers'

describe('charge moves', () => {
  it('Solar Beam announces a charge, then hits after chargeMs', () => {
    const engine = engineFor([mon('bulbasaur', 30, { moves: ['solar-beam'] })], [mon('chansey', 60, { moves: ['splash'] })])
    const events = advanceUntil(engine, es => es.some(e => e.type === 'charge-start'))
    const charge = ofType(events, 'charge-start')[0]
    expect(charge.move).toBe('solar-beam')
    expect(charge.ms).toBe(BALANCE.CHARGE_MOVES['solar-beam'].chargeMs)
    expect(engine.active('player').action?.kind).toBe('charging')
    expect(ofType(events, 'damage')).toHaveLength(0)

    const before = engine.state.timeMs
    const after = advanceUntil(engine, es => es.some(e => e.type === 'damage'))
    const hit = ofType(after, 'damage')[0]
    expect(hit.side).toBe('enemy')
    // the charge itself takes chargeMs of unlocked time
    expect(engine.state.timeMs - before).toBeGreaterThanOrEqual(BALANCE.CHARGE_MOVES['solar-beam'].chargeMs - 100)
    expect(engine.active('player').action).toBeNull()
  })

  it('does not fill the bar while charging and spends the PP when the charge starts', () => {
    const engine = engineFor([mon('bulbasaur', 30, { moves: ['solar-beam'] })], [mon('chansey', 60, { moves: ['splash'] })])
    const before = engine.active('player').moves[0].pp
    advanceUntil(engine, es => es.some(e => e.type === 'charge-start'))
    expect(engine.active('player').moves[0].pp).toBe(before - 1)
    advance(engine, 600)
    expect(engine.active('player').atb).toBe(0)
  })

  it('makes a Pokémon that is flying (semi-invulnerable) untouchable by most moves', () => {
    const engine = engineFor([mon('pidgey', 30, { moves: ['fly'] })], [mon('rattata', 20, { moves: ['tackle'] })])
    const events: ReturnType<typeof engine.tick> = []
    // Run until the player starts charging, then watch the enemy's attacks during the charge.
    while (!events.some(e => e.type === 'charge-start')) events.push(...engine.tick(16))
    expect(engine.active('player').action).toMatchObject({ kind: 'charging', semiInvulnerable: true })
    const during: ReturnType<typeof engine.tick> = []
    while (engine.active('player').action?.kind === 'charging') during.push(...engine.tick(16))
    const enemyAttacks = during.filter(e => e.type === 'move-used' && e.side === 'enemy')
    // Whatever the enemy tried while Pidgey was in the air must have missed.
    expect(ofType(during, 'damage').filter(e => e.side === 'player')).toHaveLength(0)
    if (enemyAttacks.length > 0) expect(ofType(during, 'miss').length).toBeGreaterThan(0)
  })
})

describe('recharge moves', () => {
  it('slows the bar after Hyper Beam compared to a normal move', () => {
    function interval(move: string): number {
      const engine = engineFor([mon('snorlax', 50, { moves: [move] })], [mon('chansey', 90, { moves: ['splash'] })], { seed: 5 })
      const times: number[] = []
      for (let i = 0; i < 4000 && times.length < 3; i++) {
        const before = engine.state.timeMs
        const events = engine.tick(16)
        if (events.some(e => e.type === 'move-used' && e.side === 'player')) times.push(before)
      }
      return times[2] - times[1]
    }
    const normal = interval('body-slam')
    const recharge = interval('hyper-beam')
    expect(recharge).toBeGreaterThan(normal * 1.5)
  })
})
