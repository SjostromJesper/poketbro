import { raceById, finalStats } from '#shared/game/races'
import { maxHealth, type Combatant } from '#shared/game/battle'
import { tacticById } from '#shared/game/tactics'
import { applyPassiveRegen } from '#shared/game/regen'
import { applyItemBonuses } from '#shared/game/items'
import { resolveSkills } from '#shared/game/skills'

export interface PartyCombatantResult {
  combatant: Combatant
  characterId: string
  maxHp: number
  regenHp: number
  regenLastRegenAt: number
}

/** Builds a full Combatant (gear, skills, race, HP regen applied) for one party member - same field set as the 1v1 duel routes use. */
export async function buildPartyCombatant(admin: any, characterRow: any): Promise<PartyCombatantResult> {
  const equippedItems = await fetchEquippedItems(admin, characterRow.user_id)
  const gear = resolveEquippedGear(equippedItems)
  const race = raceById(characterRow.race_id)
  const stats = applyItemBonuses(finalStats(race, characterRow.allocated), equippedItems)
  const maxHp = maxHealth(stats)
  const regen = applyPassiveRegen(characterRow.current_hp, maxHp, characterRow.last_regen_at)
  const tactic = tacticById(characterRow.default_tactic_id ?? 'normal')

  const combatant: Combatant = {
    name: characterRow.name,
    stats,
    tactic,
    giveUpPercent: characterRow.default_give_up_percent ?? 20,
    startingHp: regen.hp,
    skills: resolveSkills(characterRow.skill_ids),
    weaponType: gear.weaponType,
    weaponExtraAttackChance: gear.weaponExtraAttackChance,
    weaponMinDamage: gear.weaponMinDamage,
    weaponMaxDamage: gear.weaponMaxDamage,
    weaponRecommendedSkill: gear.weaponRecommendedSkill,
    weaponBreakThreshold: gear.weaponBreakThreshold,
    hasShield: gear.hasShield,
    shieldMaxBlocksPerRound: gear.shieldMaxBlocksPerRound,
    shieldAbsorption: gear.shieldAbsorption,
    shieldMinAbsorption: gear.shieldMinAbsorption,
    shieldRecommendedSkill: gear.shieldRecommendedSkill,
    shieldBreakThreshold: gear.shieldBreakThreshold,
    offWeaponType: gear.offWeaponType,
    offWeaponExtraAttackChance: gear.offWeaponExtraAttackChance,
    offWeaponMinDamage: gear.offWeaponMinDamage,
    offWeaponMaxDamage: gear.offWeaponMaxDamage,
    offWeaponRecommendedSkill: gear.offWeaponRecommendedSkill,
    offWeaponBreakThreshold: gear.offWeaponBreakThreshold,
  }

  return { combatant, characterId: characterRow.id, maxHp, regenHp: regen.hp, regenLastRegenAt: regen.lastRegenAt }
}
