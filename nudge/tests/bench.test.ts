// Pacing benchmark, skipped in normal runs. Run with:  BENCH=1 npx vitest run nudge/tests/bench.test.ts
import { afterEach, beforeEach, describe, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { BALANCE } from '../engine/balance'
import { createRng } from '../engine/rng'
import { Bot } from './bot'

const enabled = !!process.env.BENCH

beforeEach(() => {
  vi.useFakeTimers()
  setActivePinia(createPinia())
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe.skipIf(!enabled)('pacing benchmark', () => {
  it('reports pacing for several XP multipliers', () => {
    const multipliers = (process.env.XP_MULTS ?? '1,1.5,2').split(',').map(Number)
    const gymLevel = Number(process.env.GYM_LEVEL ?? 14)
    const strategy = (process.env.STRATEGY ?? 'best') as 'none' | 'best'
    const original = BALANCE.XP_MULTIPLIER
    for (const xp of multipliers) {
      BALANCE.XP_MULTIPLIER = xp
      const rows: Record<string, number>[] = []
      for (let seed = 1; seed <= 6; seed++) {
        for (const starter of [4, 7, 1]) {
          setActivePinia(createPinia())
          const rng = createRng(seed * 7 + starter)
          vi.spyOn(Math, 'random').mockImplementation(() => rng.next())
          const bot = new Bot({ starter, gymLevel, strategy, advanceTimers: ms => vi.advanceTimersByTime(ms), maxActions: 6000 })
          const r = bot.run()
          rows.push({
            badge: r.gotBadge ? 1 : 0, wild: r.wildBattles, trainer: r.trainerBattles, steps: r.steps, minutes: r.battleSeconds / 60,
            blackouts: r.blackouts, losses: r.losses, lead: r.leadLevel, nudges: r.nudges / Math.max(1, r.wildBattles + r.trainerBattles),
          })
        }
      }
      const avg = (k: string) => (rows.reduce((s, r) => s + r[k], 0) / rows.length).toFixed(1)
      console.log(`[${strategy}] XP x${xp}, gym at lead Lv${gymLevel}: badge ${avg('badge')}, wild ${avg('wild')}, trainer ${avg('trainer')}, steps ${avg('steps')}, battle min ${avg('minutes')}, blackouts ${avg('blackouts')}, lead lv ${avg('lead')}, nudges/battle ${avg('nudges')}`)
    }
    BALANCE.XP_MULTIPLIER = original
  }, 600000)
})
