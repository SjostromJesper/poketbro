import { UNARMED_DAMAGE_PROFILE, type EquippedItemBonuses, type WeaponType } from '#shared/game/items'

export interface EquippedItemRow extends EquippedItemBonuses {
  slot: string
  weapon_type: WeaponType | null
  extra_attack_chance: number
  max_blocks_per_round: number
  min_damage: number | null
  max_damage: number | null
  recommended_skill: number | null
  absorption: number | null
  min_absorption: number | null
  break_threshold: number | null
}

export async function fetchEquippedItems(admin: any, userId: string): Promise<EquippedItemRow[]> {
  const { data } = await admin
    .from('items')
    .select('slot, stat_bonuses, weapon_type, extra_attack_chance, max_blocks_per_round, min_damage, max_damage, recommended_skill, absorption, min_absorption, break_threshold')
    .eq('user_id', userId)
    .eq('equipped', true)

  return (data ?? []) as EquippedItemRow[]
}

export interface EquippedGear {
  weaponType: WeaponType | null
  weaponExtraAttackChance: number
  weaponMinDamage: number
  weaponMaxDamage: number
  weaponRecommendedSkill: number
  /** The weapon's own brytvärde - how much cumulative damage it can deal/take before breaking. Independent of weaponRecommendedSkill. */
  weaponBreakThreshold: number
  hasShield: boolean
  shieldMaxBlocksPerRound: number
  /** The max of the shield's absorption roll range - each block rolls between shieldMinAbsorption and this, scaled by skill. */
  shieldAbsorption: number
  shieldMinAbsorption: number
  /** The skill needed to use the shield effectively (gates block chance/absorption) - not a durability stat. */
  shieldRecommendedSkill: number
  /** The shield's own brytvärde - how much cumulative damage it can take before breaking. Independent of shieldRecommendedSkill. */
  shieldBreakThreshold: number
  /** Dual-wielding: a second weapon in the shield-arm slot instead of a shield. */
  offWeaponType: WeaponType | null
  offWeaponExtraAttackChance: number
  offWeaponMinDamage: number
  offWeaponMaxDamage: number
  offWeaponRecommendedSkill: number
  offWeaponBreakThreshold: number
}

export function resolveEquippedGear(equippedItems: EquippedItemRow[]): EquippedGear {
  const weapon = equippedItems.find(i => i.slot === 'weapon')
  const offHand = equippedItems.find(i => i.slot === 'shield')
  const offHandIsWeapon = Boolean(offHand?.weapon_type)
  return {
    weaponType: weapon?.weapon_type ?? null,
    weaponExtraAttackChance: weapon?.extra_attack_chance ?? 0,
    weaponMinDamage: weapon?.min_damage ?? UNARMED_DAMAGE_PROFILE.minDamage,
    weaponMaxDamage: weapon?.max_damage ?? UNARMED_DAMAGE_PROFILE.maxDamage,
    weaponRecommendedSkill: weapon?.recommended_skill ?? UNARMED_DAMAGE_PROFILE.recommendedSkill,
    weaponBreakThreshold: (weapon?.weapon_type && weapon?.break_threshold != null) ? weapon.break_threshold : Infinity,
    hasShield: Boolean(offHand) && !offHandIsWeapon,
    shieldMaxBlocksPerRound: offHand?.max_blocks_per_round ?? 1,
    shieldAbsorption: offHand?.absorption ?? 0,
    shieldMinAbsorption: offHand?.min_absorption ?? 0,
    shieldRecommendedSkill: (!offHandIsWeapon && offHand?.recommended_skill != null) ? offHand.recommended_skill : 0,
    shieldBreakThreshold: (!offHandIsWeapon && offHand?.break_threshold != null) ? offHand.break_threshold : Infinity,
    offWeaponType: offHandIsWeapon ? (offHand!.weapon_type) : null,
    offWeaponExtraAttackChance: offHandIsWeapon ? (offHand?.extra_attack_chance ?? 0) : 0,
    offWeaponMinDamage: offHandIsWeapon ? (offHand?.min_damage ?? UNARMED_DAMAGE_PROFILE.minDamage) : 0,
    offWeaponMaxDamage: offHandIsWeapon ? (offHand?.max_damage ?? UNARMED_DAMAGE_PROFILE.maxDamage) : 0,
    offWeaponRecommendedSkill: offHandIsWeapon ? (offHand?.recommended_skill ?? UNARMED_DAMAGE_PROFILE.recommendedSkill) : 0,
    offWeaponBreakThreshold: (offHandIsWeapon && offHand?.break_threshold != null) ? offHand.break_threshold : Infinity,
  }
}
