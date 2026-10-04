// Headless battle runner and a simple nudge bot, used by tests and the simulator.
import { estimateDamage } from './choice'
import { BattleEngine } from './battle'
import type { BattleConfig, BattleEvent, BattleOutcome } from './types'

export type NudgeStrategy = 'none' | 'best' | 'always-best'

export interface HeadlessOptions {
  strategy?: NudgeStrategy
  /** Safety limit on simulated battle time. */
  maxMs?: number
  stepMs?: number
  collectEvents?: boolean
}

export interface HeadlessResult {
  engine: BattleEngine
  outcome: BattleOutcome | null
  events: BattleEvent[]
  durationMs: number
  timedOut: boolean
}

/**
 * A reasonable human-ish nudge strategy: late in a bar, if the Pokémon is unlikely to pick the move with the best expected
 * damage and it still has nudges left, nudge that move. 'always-best' nudges whenever the best move differs from the pending one.
 */
export function applyNudgeStrategy(engine: BattleEngine, strategy: NudgeStrategy): void {
  if (strategy === 'none' || engine.finished) return
  const self = engine.active('player')
  const foe = engine.active('enemy')
  if (self.fainted || foe.fainted || self.pendingNudge || self.nudgesUsed >= self.nudgeBudget) return
  if (self.action || self.atb < engine.balance.ATB_MAX * 0.5) return
  let bestIndex = -1
  let bestDamage = 0
  self.moves.forEach((instance, index) => {
    if (instance.pp <= 0) return
    const damage = estimateDamage(self, foe, engine.data.moves[instance.move], engine.data, engine.balance)
    if (damage > bestDamage) {
      bestDamage = damage
      bestIndex = index
    }
  })
  if (bestIndex < 0) return
  if (strategy === 'always-best') {
    engine.nudge(bestIndex)
    return
  }
  const choice = engine.debugChoice('player')
  const pBest = choice.moves.find(m => m.moveIndex === bestIndex)?.pAuto ?? 0
  if (pBest < 0.6) engine.nudge(bestIndex)
}

export function runBattle(config: BattleConfig, options: HeadlessOptions = {}): HeadlessResult {
  const engine = new BattleEngine(config)
  const stepMs = options.stepMs ?? config.balance.STEP_MS
  const maxMs = options.maxMs ?? 10 * 60 * 1000
  const events: BattleEvent[] = []
  let elapsed = 0
  while (!engine.finished && elapsed < maxMs) {
    applyNudgeStrategy(engine, options.strategy ?? 'none')
    const produced = engine.tick(stepMs)
    if (options.collectEvents) events.push(...produced)
    elapsed += stepMs
  }
  return { engine, outcome: engine.outcome, events, durationMs: elapsed, timedOut: !engine.finished }
}
