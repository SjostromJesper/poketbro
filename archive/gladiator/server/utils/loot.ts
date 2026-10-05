import { LOOT_DROP_CHANCE, generateLootItem } from '#shared/game/items'

export async function maybeGrantLoot(admin: any, userId: string, level: number) {
  if (Math.random() >= LOOT_DROP_CHANCE) return null

  const loot = generateLootItem(level)
  const { data: inserted } = await admin
    .from('items')
    .insert({
      user_id: userId,
      slot: loot.slot,
      name: loot.name,
      quality: loot.quality,
      enchant_level: loot.enchantLevel,
      stat_bonuses: loot.statBonuses,
      weapon_type: loot.weaponType,
      extra_attack_chance: loot.extraAttackChance,
      max_blocks_per_round: loot.maxBlocksPerRound ?? 1,
      min_damage: loot.minDamage,
      max_damage: loot.maxDamage,
      recommended_skill: loot.recommendedSkill,
      absorption: loot.absorption,
      min_absorption: loot.minAbsorption,
      break_threshold: loot.breakThreshold,
    })
    .select()
    .single()

  return inserted ?? null
}
