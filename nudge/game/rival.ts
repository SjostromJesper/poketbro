// The rival (PLAN-3 4.3): three battles. His starter is the one with the type advantage over the player's (fire beats grass, water
// beats fire, grass beats water), and the rest of his team follows the level curve. Pure.
import type { TrainerMon } from './types'

export const STARTER_IDS = [1, 4, 7] as const

/** Bulbasaur -> Charmander, Charmander -> Squirtle, Squirtle -> Bulbasaur. */
export function rivalStarter(playerStarter: number): number {
  switch (playerStarter) {
    case 1: return 4
    case 4: return 7
    case 7: return 1
    default: return 4
  }
}

/** The starter's evolution stage: 0 = first form, 1 = second form (Ivysaur/Charmeleon/Wartortle). */
const stage = (starter: number, n: 0 | 1) => starter + n

/** The rival's name in text written before the player picked one; shown as the chosen name (see names.ts). */
export const RIVAL_NAME = '{rival}'

/** The team of rival battle `round` (1: after Route 1, 2: in the harbour town, 3: before the flower town). */
export function rivalTeam(round: 1 | 2 | 3, playerStarter: number): TrainerMon[] {
  const starter = rivalStarter(playerStarter)
  switch (round) {
    case 1:
      return [{ speciesId: 16, level: 6 }, { speciesId: stage(starter, 0), level: 7 }]
    case 2:
      return [
        { speciesId: 17, level: 19 }, // Pidgeotto
        { speciesId: 63, level: 18 }, // Abra
        { speciesId: stage(starter, 1), level: 21 },
      ]
    case 3:
      return [
        { speciesId: 17, level: 25 },
        { speciesId: 64, level: 24 }, // Kadabra
        { speciesId: 58, level: 25 }, // Growlithe
        { speciesId: stage(starter, 1), level: 29 },
      ]
  }
}
