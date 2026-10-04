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

function playthrough(seed: number, starter: number, gymLevel = 14) {
  const rng = createRng(seed)
  vi.spyOn(Math, 'random').mockImplementation(() => rng.next())
  const bot = new Bot({ starter, gymLevel, advanceTimers: ms => vi.advanceTimersByTime(ms), maxActions: 4000 })
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
