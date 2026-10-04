// Obedience: badges cap the level a Pokémon listens at; low trust makes it slack off.
import type { Balance } from './balance'
import { pickWeightedIndex, type Rng } from './rng'
import type { Battler } from './types'

export type ObedienceOutcome = 'obey' | 'loaf' | 'random' | 'nap'

export function obedienceCap(badges: number, balance: Balance): number {
  return balance.OBEDIENCE_BASE_CAP + balance.OBEDIENCE_PER_BADGE * badges
}

/** Probability that a Pokémon of `level` disobeys when its bar is full (before choosing the outcome). */
export function disobeyChance(level: number, badges: number, trust: number, balance: Balance): number {
  const cap = obedienceCap(badges, balance)
  let p = 0
  if (level > cap) p = Math.min(1, ((level - cap) / (level + cap)) * balance.OBEDIENCE_CHANCE_SCALE)
  if (trust < balance.LOW_TRUST_THRESHOLD) p = Math.min(1, p + balance.LOW_TRUST_LOAF_CHANCE)
  return p
}

/** Rolls obedience for a player-side Pokémon whose bar just filled. */
export function rollObedience(battler: Battler, badges: number, rng: Rng, balance: Balance): ObedienceOutcome {
  const p = disobeyChance(battler.level, badges, battler.trust, balance)
  if (p <= 0 || rng.next() >= p) return 'obey'
  // Pure low-trust slacking (under the badge cap) is always loafing, never a random or nap outcome.
  if (battler.level <= obedienceCap(badges, balance)) return 'loaf'
  const w = balance.OBEDIENCE_OUTCOME_WEIGHTS
  const outcomes: ObedienceOutcome[] = ['loaf', 'random', 'nap']
  const index = pickWeightedIndex(rng, [w.loaf, w.random, w.nap])
  return outcomes[Math.max(0, index)]
}
