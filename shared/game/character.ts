import type { StatBlock } from './races'
import { finalStats, raceById } from './races'
import { maxHealth } from './battle'
import { applyItemBonuses, type EquippedItemBonuses } from './items'

export interface CharacterRow {
  id: string
  user_id: string
  name: string
  race_id: string
  allocated: StatBlock
  level: number
  xp: number
  current_hp: number
  last_regen_at: number
  default_tactic_id: string
  default_give_up_percent: number
  [key: string]: unknown
}

export interface CharacterWithStats extends CharacterRow {
  stats: StatBlock
  maxHp: number
}

/** Adds the computed (not stored) stats/maxHp fields every character API response must carry. */
export function withStats<T extends CharacterRow>(character: T, equippedItems: EquippedItemBonuses[] = []): T & CharacterWithStats {
  const race = raceById(character.race_id)
  const baseStats = finalStats(race, character.allocated)
  const stats = applyItemBonuses(baseStats, equippedItems)
  const maxHp = maxHealth(stats)
  return { ...character, stats, maxHp }
}
