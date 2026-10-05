import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createRng } from '../engine/rng'
import { Bot } from './bot'

beforeEach(() => {
  vi.useFakeTimers()
  setActivePinia(createPinia())
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function playthrough(seed: number, starter: number, gymLevel = 14, extra: Partial<ConstructorParameters<typeof Bot>[0]> = {}) {
  const rng = createRng(seed)
  vi.spyOn(Math, 'random').mockImplementation(() => rng.next())
  const bot = new Bot({ starter, gymLevel, advanceTimers: ms => vi.advanceTimersByTime(ms), maxActions: 4000, ...extra })
  return bot.run()
}

describe('automatic playthrough (start to badge 1)', () => {
  it.each([[1, 4], [2, 7], [3, 1]])('seed %i, starter %i: reaches Grusstad and wins the Granit badge without crashing', (seed, starter) => {
    const report = playthrough(seed, starter)
    console.log(`seed ${seed} starter ${starter}:`, JSON.stringify({ ...report, log: undefined }))
    expect(report.gotBadge, `bot got stuck: ${report.log.slice(-5).join(' | ')}`).toBe(true)
    expect(report.wildBattles).toBeGreaterThan(3)
    expect(report.trainerBattles).toBeGreaterThanOrEqual(3)
    expect(report.steps).toBeGreaterThan(300)
    expect(report.leadLevel).toBeGreaterThanOrEqual(12)
  }, 120000)
})

describe('automatic playthrough of the whole world (all four gyms and the Wilderness)', () => {
  // The bot walks with the real controller through every town, fights what it meets, buys potions, wins the four badges in order and ends up at the lake in
  // the Wilderness where Lapras is given. Before gym 2-4 its party is swapped for the expected team (a debug shortcut, see expectedTeams.ts).
  it.each([[1, 4], [2, 7], [3, 1]])('seed %i, starter %i: wins all four badges and gets Lapras without crashing or getting stuck', (seed, starter) => {
    const report = playthrough(seed, starter, 15, { goal: 'all', maxActions: 12000 })
    console.log(`full run, seed ${seed} starter ${starter}:`, JSON.stringify({ ...report, log: undefined }))
    expect(report.done, `bot got stuck: ${report.log.slice(-6).join(' | ')}`).toBe(true)
    expect(report.badges).toEqual(['granit', 'kajsa', 'ture', 'lilja'])
    expect(report.gotLapras).toBe(true)
    expect(report.steps).toBeGreaterThan(3000)
    expect(report.levelsAtGym).toHaveLength(4)
  }, 300000)
})
