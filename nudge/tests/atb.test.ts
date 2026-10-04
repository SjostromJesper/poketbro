import { describe, expect, it } from 'vitest'
import { atbFillPerSecond, effectiveSpeed, priorityHeadstart, secondsPerBar } from '../engine/atb'
import { advance, BALANCE, engineFor, mon, ofType } from './helpers'

function setSpeed(engine: ReturnType<typeof engineFor>, player: number, enemy: number) {
  engine.active('player').stats.speed = player
  engine.active('enemy').stats.speed = enemy
}

describe('ATB timer', () => {
  it('acts about every 2.5 seconds at speed 80', () => {
    const engine = engineFor([mon('magikarp', 10)], [mon('magikarp', 10)])
    setSpeed(engine, 80, 80)
    expect(secondsPerBar(engine.active('player'), BALANCE)).toBeCloseTo(2.5, 5)
  })

  it('gives speed 120 vs 45 roughly 3 actions against 2', () => {
    const engine = engineFor([mon('magikarp', 10, { moves: ['splash'] })], [mon('magikarp', 10, { moves: ['splash'] })])
    setSpeed(engine, 120, 45)
    const ratio = atbFillPerSecond(engine.active('player'), BALANCE) / atbFillPerSecond(engine.active('enemy'), BALANCE)
    expect(ratio).toBeCloseTo(220 / 145, 5)
    expect(ratio).toBeGreaterThan(1.45)
    expect(ratio).toBeLessThan(1.6)

    const events = advance(engine, 120000)
    const chosen = ofType(events, 'move-chosen')
    const player = chosen.filter(e => e.side === 'player').length
    const enemy = chosen.filter(e => e.side === 'enemy').length
    expect(player / enemy).toBeGreaterThan(1.35)
    expect(player / enemy).toBeLessThan(1.7)
  })

  it('halves speed when paralysed, scales with stages and gets the Quick Claw and trait bonuses', () => {
    const engine = engineFor([mon('magikarp', 10, { trait: 'hasty', heldItem: 'quick-claw' })], [mon('magikarp', 10)])
    const player = engine.active('player')
    player.stats.speed = 100
    expect(effectiveSpeed(player, BALANCE)).toBe(100)
    player.status = 'paralysis'
    expect(effectiveSpeed(player, BALANCE)).toBe(50)
    player.status = null
    player.stages.speed = 2
    expect(effectiveSpeed(player, BALANCE)).toBe(200)
    player.stages.speed = 0
    // hasty +5 %, quick claw +10 %
    expect(atbFillPerSecond(player, BALANCE)).toBeCloseTo(BALANCE.ATB_K * 200 * 1.05 * 1.1, 5)
    player.fillMult = 0.5
    expect(atbFillPerSecond(player, BALANCE)).toBeCloseTo(BALANCE.ATB_K * 200 * 1.05 * 1.1 * 0.5, 5)
  })

  it('turns move priority into a bar headstart', () => {
    expect(priorityHeadstart(1, BALANCE)).toBe(300)
    expect(priorityHeadstart(2, BALANCE)).toBe(600)
    expect(priorityHeadstart(-1, BALANCE)).toBe(-300)
    expect(priorityHeadstart(5, BALANCE)).toBe(900)
    expect(priorityHeadstart(-6, BALANCE)).toBe(-900)
    expect(priorityHeadstart(0, BALANCE)).toBe(0)
  })

  it('starts the next bar with the headstart of a priority move', () => {
    const engine = engineFor([mon('pidgey', 10, { moves: ['quick-attack'] })], [mon('magikarp', 40, { moves: ['splash'] })])
    const events: ReturnType<typeof engine.tick> = []
    for (let i = 0; i < 2000 && !events.some(e => e.type === 'move-used' && e.side === 'player'); i++) events.push(...engine.tick(16))
    expect(events.some(e => e.type === 'move-used' && e.side === 'player')).toBe(true)
    expect(engine.active('player').atb).toBeGreaterThanOrEqual(300)
    expect(engine.active('player').atb).toBeLessThan(330)
  })

  it('pauses both bars while an action animation plays', () => {
    const engine = engineFor([mon('pidgey', 10, { moves: ['tackle'] })], [mon('magikarp', 40, { moves: ['splash'] })])
    let acted = false
    while (!acted) acted = engine.tick(16).some(e => e.type === 'move-used')
    const enemyAtb = engine.active('enemy').atb
    const playerAtb = engine.active('player').atb
    expect(engine.state.lockMs).toBeGreaterThan(0)
    advance(engine, 300)
    expect(engine.active('enemy').atb).toBe(enemyAtb)
    expect(engine.active('player').atb).toBe(playerAtb)
  })
})
