import { describe, expect, it } from 'vitest'
import { cuesForEvent } from '../game/audioCues'
import type { BattleEvent } from '../engine/types'

const damage = (patch: Partial<Extract<BattleEvent, { type: 'damage' }>>): BattleEvent => ({
  type: 'damage', side: 'enemy', name: 'X', amount: 5, hp: 10, maxHp: 20, effectiveness: 1, crit: false, source: 'move', ...patch,
})
const ids = (event: BattleEvent) => cuesForEvent(event).map(c => (c.type === 'sfx' ? c.id : c.type))

describe('audio cues for battle events', () => {
  it('picks the hit sound from effectiveness and crits', () => {
    expect(ids(damage({}))).toEqual(['hitNormal'])
    expect(ids(damage({ effectiveness: 2 }))).toEqual(['hitSuper'])
    expect(ids(damage({ effectiveness: 0.5 }))).toEqual(['hitWeak'])
    expect(ids(damage({ crit: true, effectiveness: 2 }))).toEqual(['hitCrit'])
    expect(ids(damage({ source: 'status' }))).toEqual([])
    expect(ids(damage({ amount: 0 }))).toEqual([])
  })

  it('plays a cry on send-out and a lower pitched one on faint', () => {
    expect(cuesForEvent({ type: 'send-out', side: 'enemy', name: 'X', teamIndex: 0, speciesId: 74, forced: false })).toEqual([{ type: 'cry', side: 'enemy', speciesId: 74 }])
    const faint = cuesForEvent({ type: 'faint', side: 'player', name: 'X', speciesId: 4 })
    expect(faint[0]).toMatchObject({ type: 'sfx', id: 'faint' })
    expect(faint[1]).toMatchObject({ type: 'cry', rate: 0.7, speciesId: 4 })
  })

  it('has sounds for misses, stat changes, nudges and following or ignoring them', () => {
    expect(ids({ type: 'miss', side: 'player', name: 'X', moveName: 'Y' })).toEqual(['miss'])
    expect(ids({ type: 'stat-change', side: 'player', name: 'X', stat: 'attack', delta: 1, stage: 1 })).toEqual(['statUp'])
    expect(ids({ type: 'stat-change', side: 'player', name: 'X', stat: 'attack', delta: -1, stage: -1 })).toEqual(['statDown'])
    expect(ids({ type: 'nudge', result: 'accepted', moveIndex: 0, remaining: 2 })).toEqual(['nudgeClick'])
    expect(ids({ type: 'nudge', result: 'exhausted', moveIndex: 0, remaining: 0 })).toEqual(['nudgeIgnored'])
    const chosen = (followedNudge: boolean | null): BattleEvent => ({ type: 'move-chosen', side: 'player', name: 'X', move: 'm', moveName: 'M', followedNudge, favorite: false })
    expect(ids(chosen(true))).toEqual(['nudgeFollowed'])
    expect(ids(chosen(false))).toEqual(['nudgeIgnored'])
    expect(ids(chosen(null))).toEqual([])
  })
})
