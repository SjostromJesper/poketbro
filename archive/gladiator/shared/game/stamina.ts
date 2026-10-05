/**
 * "Tid" is a shared stamina pool spent on both adventure movement (worldmap.ts's
 * TERRAIN_MOVE_COST) and on fighting - training, challenges, and random duels all
 * cost time too now, not just steps on the map. It regenerates exactly like HP
 * (same applyPassiveRegen tick mechanism), just tracked on its own timestamp.
 */
export const MAX_ADVENTURE_TIME = 125

const MIN_BATTLE_TIME_COST = 5
const MAX_BATTLE_TIME_COST = 10

/**
 * Longer fights cost more time - guessed at roughly 5-10 depending on how many
 * rounds the fight lasted, same as every other unvalidated formula this session.
 * A short 1-2 round fight still costs the 5-point floor; anything past ~20 rounds
 * caps at 10.
 */
export function timeCostForBattle(rounds: number): number {
  return Math.min(MAX_BATTLE_TIME_COST, Math.max(MIN_BATTLE_TIME_COST, Math.round(rounds / 2)))
}
