// The "reasonable team" a player is expected to bring to each gym (PLAN-3 4.6). The gym simulator (`npm run sim-gyms`) uses it to check the
// leaders' difficulty, and the automatic playthrough uses it as a debug shortcut so the bot does not have to train a whole party.
import type { GameData } from '../data/types'

export type TeamSlot = number | 'starter' | 'starter2'

export interface ExpectedTeam {
  /** Badges the player has when they enter the gym. */
  badges: number
  /** `starter` is the first form (the second from level 16), `starter2` the second form. */
  slots: [TeamSlot, number][]
}

const PIDGEY = 16
const PIDGEOTTO = 17
const NIDORAN_M = 32
const MANKEY = 56
const WEEPINBELL = 70
const SANDSLASH = 28
const GROWLITHE = 58
const GRAVELER = 75

/** Expected teams for gym 1-4 (lead level, then pals a few levels below). `offset` shifts every level (the simulator's sweep). */
export function expectedTeam(gym: 1 | 2 | 3 | 4, offset = 0): ExpectedTeam {
  const l = (n: number) => n + offset
  switch (gym) {
    case 1: return { badges: 0, slots: [['starter', l(16)], [PIDGEY, l(14)], [NIDORAN_M, l(13)]] }
    case 2: return { badges: 1, slots: [['starter2', l(21)], [PIDGEOTTO, l(19)], [WEEPINBELL, l(19)], [MANKEY, l(17)]] }
    case 3: return { badges: 2, slots: [['starter2', l(24)], [SANDSLASH, l(23)], [GROWLITHE, l(23)], [MANKEY, l(22)]] }
    case 4: return { badges: 3, slots: [['starter2', l(28)], [PIDGEOTTO, l(27)], [GROWLITHE, l(26)], [GRAVELER, l(26)]] }
  }
}

export function speciesOfSlot(slot: TeamSlot, starter: number, level: number): number {
  if (slot === 'starter') return level >= 16 ? starter + 1 : starter
  return slot === 'starter2' ? starter + 1 : slot
}

/** A player who keeps their best attacks: the four strongest moves learnt by `level` (STAB counts extra), instead of the last four learnt. */
export function smartMoves(data: GameData, speciesId: number, level: number): string[] {
  const species = data.species[speciesId]
  const learnt = [...new Set(species.levelUpMoves.filter(m => m.level <= level).map(m => m.move))]
  const score = (move: string) => {
    const info = data.moves[move]
    if (!info?.power) return 0
    return info.power * (species.types.includes(info.type) ? 1.5 : 1) * (info.accuracy ? Math.min(1, info.accuracy / 100) : 1)
  }
  return learnt.sort((a, b) => score(b) - score(a)).slice(0, 4)
}
