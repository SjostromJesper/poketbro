export const TICK_MINUTES = 3
export const REGEN_PERCENT = 0.32
const TICK_MS = TICK_MINUTES * 60 * 1000

/** Snaps a timestamp down to the most recent 3-minute clock boundary (xx:00, xx:03, xx:06, ...). */
export function mostRecentTickBoundary(timestamp: number): number {
  const d = new Date(timestamp)
  d.setSeconds(0, 0)
  d.setMinutes(d.getMinutes() - (d.getMinutes() % TICK_MINUTES))
  return d.getTime()
}

export function nextTickBoundary(timestamp: number): number {
  return mostRecentTickBoundary(timestamp) + TICK_MS
}

export interface RegenResult {
  hp: number
  lastRegenAt: number
}

/**
 * Applies passive health regeneration: +32% (rounded down) of max HP per elapsed
 * 3-minute clock tick since lastRegenAt. lastRegenAt is expected to already be a
 * tick boundary and is advanced by exactly the number of ticks applied, so alignment
 * to real clock boundaries never drifts.
 */
export function applyPassiveRegen(currentHp: number, maxHp: number, lastRegenAt: number, now: number = Date.now()): RegenResult {
  if (currentHp >= maxHp) {
    return { hp: currentHp, lastRegenAt: mostRecentTickBoundary(now) }
  }

  const nowBoundary = mostRecentTickBoundary(now)
  const ticks = Math.max(0, Math.floor((nowBoundary - lastRegenAt) / TICK_MS))
  if (ticks <= 0) {
    return { hp: currentHp, lastRegenAt }
  }

  const regenPerTick = Math.floor(maxHp * REGEN_PERCENT)
  const hp = Math.min(maxHp, currentHp + regenPerTick * ticks)
  const lastRegenAtNext = lastRegenAt + ticks * TICK_MS

  return { hp, lastRegenAt: lastRegenAtNext }
}
