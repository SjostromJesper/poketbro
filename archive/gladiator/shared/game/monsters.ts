import type { Combatant } from './battle'
import { RACES, finalStats, randomAllocation } from './races'
import { tacticById } from './tactics'

const MONSTER_NAMES = ['Vildsvin', 'Varg', 'Rövare', 'Skogstroll', 'Giftorm', 'Plundrare', 'Björn', 'Stråtrövare']

/**
 * Adventure encounters, same generation pattern as the training-dummy/bot
 * opponents (races.ts's randomAllocation + finalStats) - unarmed brutes scaled by
 * the party's average level. No weapon/shield fields set, so they fall back to
 * the unarmed damage profile and their best-trained weapon skill for accuracy.
 */
export function generateMonsterEncounter(partyLevel: number, count: number): Combatant[] {
  const tactic = tacticById('normal')
  const pool = 80 + partyLevel * 25
  const result: Combatant[] = []
  for (let i = 0; i < count; i++) {
    const race = RACES[Math.floor(Math.random() * RACES.length)]
    const allocation = randomAllocation(pool)
    const stats = finalStats(race, allocation)
    const name = MONSTER_NAMES[Math.floor(Math.random() * MONSTER_NAMES.length)]
    result.push({ name: count > 1 ? `${name} ${i + 1}` : name, stats, tactic, giveUpPercent: 0 })
  }
  return result
}
