// ATB timer: how fast a Pokémon's action bar fills.
import type { Balance } from './balance'
import { stageMultiplier } from './formulas'
import type { Battler } from './types'

export function effectiveSpeed(battler: Battler, balance: Balance): number {
  return battler.stats.speed * stageMultiplier(battler.stages.speed)
}

/** ATB points gained per second at 1x game speed. */
export function atbFillPerSecond(battler: Battler, balance: Balance): number {
  let rate = balance.ATB_K * (effectiveSpeed(battler, balance) + balance.ATB_SPEED_OFFSET)
  rate *= balance.TRAITS[battler.trait].atbMult
  if (battler.heldItem === 'quick-claw' && !battler.heldItemUsed) rate *= balance.QUICK_CLAW_ATB_MULT
  rate *= battler.fillMult
  if (battler.status === 'paralysis') rate *= balance.PARALYSIS_FILL_MULT
  return Math.max(0, rate)
}

/** Seconds a full bar takes at the current speed (for UI and tests). */
export function secondsPerBar(battler: Battler, balance: Balance): number {
  const rate = atbFillPerSecond(battler, balance)
  return rate > 0 ? balance.ATB_MAX / rate : Infinity
}

/** True when the bar is allowed to fill right now. */
export function barCanFill(battler: Battler): boolean {
  return !battler.fainted && battler.action === null && battler.status !== 'sleep' && battler.status !== 'freeze'
}

/** Starting ATB of the next bar after using a move with the given priority. */
export function priorityHeadstart(priority: number, balance: Balance): number {
  const clamped = Math.max(-balance.PRIORITY_CLAMP, Math.min(balance.PRIORITY_CLAMP, priority))
  return clamped * balance.PRIORITY_HEADSTART
}
