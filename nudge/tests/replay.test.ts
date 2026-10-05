import { describe, expect, it } from 'vitest'
import { describeEvent } from '../engine/messages'
import { BALANCE } from '../engine/balance'
import { ReplayPlayer, eventDelay } from '../game/replay'
import { simulatePvp } from '../server/autopilot'
import { snapshotOf } from '../server/snapshot'
import { data, mon } from './helpers'

const team = (names: string[], lv: number) => names.map((n, i) => ({ ...snapshotOf(mon(n, lv)), uid: `${n}${i}` }))
const a = team(['charizard', 'blastoise', 'venusaur'], 30)
const b = team(['gengar', 'alakazam', 'machamp'], 30)
const match = simulatePvp({ data, balance: BALANCE, teamA: a, teamB: b, seed: 77 })

describe('replays', () => {
  it('play the saved log step by step and end in the same picture as the match', () => {
    const player = new ReplayPlayer(match.events, a, b, data, BALANCE, match.winner)
    expect(player.done).toBe(false)
    expect(player.state.index).toBe(0)
    const first = player.next()
    expect(first?.type).toBe('send-out')
    expect(player.state.index).toBe(1)
    player.skipToEnd()
    expect(player.done).toBe(true)
    expect(player.next()).toBeNull()
    expect(player.state.index).toBe(match.events.length)
    expect(player.state.winner).toBe(match.winner)
    // The HP of every Pokémon at the end equals the match's own final result.
    match.teamA.forEach((f, i) => expect(player.state.player.team[i].hp).toBe(f.finalHp))
    match.teamB.forEach((f, i) => expect(player.state.enemy.team[i].hp).toBe(f.finalHp))
    const fainted = (side: 'player' | 'enemy') => player.state[side].team.filter(m => m.fainted).length
    expect(fainted(match.winner === 'a' ? 'enemy' : 'player')).toBe(3)
  })

  it('reads the log, it does not simulate again: a log from another version of the engine still plays', () => {
    // Pretend the engine changed: a made-up log with HP numbers the current engine would never produce.
    const log = [
      { type: 'send-out', side: 'player', name: 'Charizard', teamIndex: 0, speciesId: 6, forced: false },
      { type: 'send-out', side: 'enemy', name: 'Gengar', teamIndex: 0, speciesId: 94, forced: false },
      { type: 'damage', side: 'enemy', name: 'Gengar', amount: 5, hp: 3, maxHp: 8, effectiveness: 1, crit: false, source: 'move' },
      { type: 'faint', side: 'enemy', name: 'Gengar', speciesId: 94 },
    ] as never[]
    const player = new ReplayPlayer(log, a, b, data, BALANCE, 'a')
    player.next()
    player.next()
    player.next()
    expect(player.state.enemy.team[0]).toMatchObject({ hp: 3, maxHp: 8 })
    player.next()
    expect(player.state.enemy.team[0]).toMatchObject({ hp: 0, fainted: true })
    expect(player.state.winner).toBe('a')
  })

  it('tracks who is out and the status along the way', () => {
    const player = new ReplayPlayer(match.events, a, b, data, BALANCE, match.winner)
    const seen = new Set<string>()
    for (let e = player.next(); e; e = player.next()) {
      seen.add(`${player.state.player.active}-${player.state.enemy.active}`)
      for (const side of ['player', 'enemy'] as const) for (const m of player.state[side].team) expect(m.hp).toBeGreaterThanOrEqual(0)
    }
    expect(seen.size).toBeGreaterThan(1)
  })

  it('gives every event a time on screen, and the log says whose Pokémon it is with the players\' names', () => {
    for (const e of match.events) expect(eventDelay(e)).toBeGreaterThan(0)
    const lines = match.events.map(e => describeEvent(e, { kind: 'pvp', data, names: { player: 'Anna #1452', enemy: 'Bo #2210' } })).filter(Boolean) as string[]
    expect(lines[0]).toMatch(/^(Anna #1452|Bo #2210) skickade ut/)
    expect(lines.some(l => l.includes('Anna #1452s '))).toBe(true)
    expect(lines.some(l => l.includes('Bo #2210s '))).toBe(true)
    expect(lines.some(l => l.includes('Motståndarens'))).toBe(false)
  })
})
