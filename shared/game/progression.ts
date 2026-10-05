export const MAX_LEVEL = 4

/** Stat points granted to distribute freely every time a character levels up. */
export const POINTS_PER_LEVEL = 20

// Total XP needed to advance FROM this level to the next.
export const XP_TO_LEVEL: Record<number, number> = { 1: 100, 2: 250, 3: 450 }

export function levelForXp(level: number, xp: number): number {
  let result = level
  while (result < MAX_LEVEL && xp >= XP_TO_LEVEL[result]) {
    result += 1
  }
  return result
}
