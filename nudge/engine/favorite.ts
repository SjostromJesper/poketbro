// Favorite move (PLAN-2 1B): when the bonus applies, how fast it forms and the helpers the engine and the game layer share.
import type { GameData } from '../data/types'
import type { Balance, TraitId } from './balance'
import { typeEffectiveness } from './formulas'
import type { Battler } from './types'

/** Habit points a move needs before it can become this Pokémon's favorite. */
export function favoriteThreshold(trait: TraitId, balance: Balance): number {
  return balance.FAVORITE_THRESHOLD * balance.TRAITS[trait].favoriteThresholdMult
}

/** Habit points by which another move must beat the current favorite to take over. */
export function favoriteSwitchMargin(trait: TraitId, balance: Balance): number {
  return balance.FAVORITE_THRESHOLD * balance.FAVORITE_SWITCH_FACTOR * balance.TRAITS[trait].favoriteSwitchMult
}

export function favoriteWeightMultiplier(trait: TraitId, balance: Balance): number {
  return balance.FAVORITE_WEIGHT_MULT * balance.TRAITS[trait].favoriteWeightMult
}

export function nudgeAwayMultiplier(trait: TraitId, balance: Balance): number {
  return balance.NUDGE_AWAY_FROM_FAVORITE_MULT * balance.TRAITS[trait].favoriteAwayMult
}

/**
 * Does the favorite bonus (weight, headstart, power) apply for this move against this foe? A favorite that cannot hurt the
 * target at all (immunity) loses its bonus once the Pokémon trusts the player enough to know better.
 * "Not very effective" keeps the bonus: that is where the player gets to nudge it away.
 */
export function favoriteApplies(self: Battler, moveName: string, foe: Battler | null, data: GameData, balance: Balance): boolean {
  if (!self.favoriteMove || self.favoriteMove !== moveName) return false
  const move = data.moves[moveName]
  if (!move || !foe) return true
  if (move.damageClass !== 'status' && self.trust >= balance.FAVORITE_SMART_TRUST) {
    if (typeEffectiveness(move.type, foe.types, data.typeChart) === 0) return false
  }
  return true
}
