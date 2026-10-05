import type { StatBlock } from './races'
import { GENERAL_STAT_KEYS, STAT_KEYS, STAT_LABELS } from './races'

export type EquipmentSlot = 'weapon' | 'shield' | 'helmet' | 'chest' | 'legs' | 'boots' | 'amulet'

export const EQUIPMENT_SLOTS: EquipmentSlot[] = ['weapon', 'shield', 'helmet', 'chest', 'legs', 'boots', 'amulet']

export const SLOT_LABELS: Record<EquipmentSlot, string> = {
  weapon: 'Vapen',
  shield: 'Sköldarm',
  helmet: 'Hjälm',
  chest: 'Bröstrustning',
  legs: 'Benskydd',
  boots: 'Skor',
  amulet: 'Amulett',
}

export type WeaponType = 'sword' | 'axe' | 'thrust' | 'hammer' | 'chain'

export const WEAPON_TYPES: WeaponType[] = ['sword', 'axe', 'thrust', 'hammer', 'chain']

export const WEAPON_TYPE_LABELS: Record<WeaponType, string> = {
  sword: 'Svärd',
  axe: 'Yxa',
  thrust: 'Stick',
  hammer: 'Hammare',
  chain: 'Kätting',
}

export const WEAPON_TYPE_SKILL_KEY: Record<WeaponType, keyof StatBlock> = {
  sword: 'swordSkill',
  axe: 'axeSkill',
  thrust: 'thrustSkill',
  hammer: 'hammerSkill',
  chain: 'chainSkill',
}

interface WeaponDamageProfile {
  minBase: number
  maxBase: number
  recommendedSkill: number
  /** Base "brytvärde" - how much cumulative damage a fresh copy of this weapon can take before it breaks. Independent of recommendedSkill. */
  durabilityBase: number
}

/**
 * Each weapon type has its own damage identity: thrust weapons are low-ceiling but easy
 * to use well, hammers hit hardest but demand the most skill to unlock, etc. A weapon's
 * "recommended skill" is how high the matching weapon skill needs to be to reach its
 * true max damage - below that, the reachable ceiling scales down proportionally.
 * "durabilityBase" is a genuinely separate stat (a real weapon's brytvärde in the stat
 * sheet, per the real game): it only governs how much punishment the weapon can take
 * before it breaks, and has no bearing on accuracy or damage - a real weapon's brytvärde
 * is a durability number, not a skill requirement, confirmed against real play.
 *
 * Scaled to match maxHealth() tracking Hälsa roughly 1:1 (Lanista's real ratio) instead
 * of the old 40 + Hälsa*2 - HP pools are now much smaller, so damage had to come down
 * by the same ~2.5x to keep fights feeling the same relative length.
 */
const WEAPON_DAMAGE_PROFILES: Record<WeaponType, WeaponDamageProfile> = {
  sword: { minBase: 2, maxBase: 4, recommendedSkill: 30, durabilityBase: 50 },
  axe: { minBase: 2, maxBase: 5, recommendedSkill: 45, durabilityBase: 55 },
  thrust: { minBase: 1, maxBase: 3, recommendedSkill: 20, durabilityBase: 40 },
  hammer: { minBase: 2, maxBase: 6, recommendedSkill: 55, durabilityBase: 65 },
  chain: { minBase: 1, maxBase: 5, recommendedSkill: 35, durabilityBase: 50 },
}

/** Used whenever a fighter has no weapon equipped - fists can't break. */
export const UNARMED_DAMAGE_PROFILE = { minDamage: 1, maxDamage: 2, recommendedSkill: 25 }

export interface WeaponDamageRange {
  minDamage: number
  maxDamage: number
  recommendedSkill: number
  breakThreshold: number
}

function rollWeaponDamageRange(weaponType: WeaponType, level: number, enchantLevel: number): WeaponDamageRange {
  const profile = WEAPON_DAMAGE_PROFILES[weaponType]
  const levelMult = 1 + level * 0.12
  const enchantMult = 1 + enchantLevel * 0.1
  const variance = 0.9 + Math.random() * 0.2
  const minDamage = Math.max(1, Math.round(profile.minBase * levelMult * variance))
  const maxDamage = Math.max(minDamage + 1, Math.round(profile.maxBase * levelMult * enchantMult * variance))
  const breakThreshold = Math.max(10, Math.round(profile.durabilityBase * levelMult * enchantMult * variance))
  return { minDamage, maxDamage, recommendedSkill: profile.recommendedSkill, breakThreshold }
}

/**
 * A shield's block ALWAYS succeeds when the shield-arm has an action available - two
 * real battle reports (same shield, skill exactly at krav and then doubled to 2x krav)
 * both showed a 100% block rate (5/5, then 4/4), never a miss. What varies is how much
 * gets absorbed: the same shield in the same match absorbed 4 one hit (full negation)
 * and only 2 on three other hits (partial) - so absorption is a rolled min-max range,
 * like a weapon's damage roll, not the single flat number we originally assumed from
 * "absorbering: 7". recommendedSkill/durabilityBase stay separate stats as before -
 * recommendedSkill only affects how close to the max of this range you can roll.
 */
const SHIELD_ABSORPTION_PROFILE = { minBase: 2, maxBase: 7, recommendedSkill: 25, durabilityBase: 45 }

export interface ShieldStats {
  minAbsorption: number
  maxAbsorption: number
  recommendedSkill: number
  breakThreshold: number
}

function rollShieldAbsorption(level: number, enchantLevel: number): ShieldStats {
  const levelMult = 1 + level * 0.12
  const enchantMult = 1 + enchantLevel * 0.1
  const variance = 0.9 + Math.random() * 0.2
  const minAbsorption = Math.max(1, Math.round(SHIELD_ABSORPTION_PROFILE.minBase * levelMult * variance))
  const maxAbsorption = Math.max(minAbsorption + 1, Math.round(SHIELD_ABSORPTION_PROFILE.maxBase * levelMult * enchantMult * variance))
  // Better shields (higher absorption/enchant) demand more skill to use well, matching
  // "ju bättre sköld ju svårare/högre skill ska man behöva" - recommendedSkill scales
  // with the same level/enchant multipliers as the shield's own power.
  const recommendedSkill = Math.max(5, Math.round(SHIELD_ABSORPTION_PROFILE.recommendedSkill * levelMult * enchantMult * variance))
  const breakThreshold = Math.max(10, Math.round(SHIELD_ABSORPTION_PROFILE.durabilityBase * levelMult * enchantMult * variance))
  return { minAbsorption, maxAbsorption, recommendedSkill, breakThreshold }
}

export type ItemQuality = 'common' | 'uncommon' | 'rare'

export const QUALITY_LABELS: Record<ItemQuality, string> = {
  common: 'Vanlig',
  uncommon: 'Ovanlig',
  rare: 'Sällsynt',
}

/** Chance that a won battle drops an item. */
export const LOOT_DROP_CHANCE = 0.35

/** Chance a generated weapon is special enough to grant a chance at a second swing each round. */
const SPECIAL_WEAPON_CHANCE = 0.12

/**
 * Chance a shield-slot drop is a second weapon instead of a shield - dual-wielding.
 * The shield arm's own action can then parry independently of the main hand, but loses
 * a shield's flat block absorption in exchange for a real offhand weapon's swing.
 */
const OFF_HAND_WEAPON_CHANCE = 0.4

/**
 * Prefix/suffix affix pools, Path of Exile-style: an enchanted item's extra mods are
 * drawn from two separate stat pools so a +2/-2 item always mixes one "prefix" stat
 * with one "suffix" stat rather than doubling up on the same one. Kept to the general
 * stats - weapon skills only ever come from a weapon's own base property.
 */
const PREFIX_POOL: (keyof StatBlock)[] = ['strength', 'health', 'endurance']
const SUFFIX_POOL: (keyof StatBlock)[] = ['evasion', 'initiative']
const AFFIX_POOLS = [PREFIX_POOL, SUFFIX_POOL]

export type AffixKind = 'prefix' | 'suffix'

export interface Affix {
  key: keyof StatBlock
  value: number
  kind: AffixKind
}

export function qualityForEnchantLevel(enchantLevel: number): ItemQuality {
  const magnitude = Math.abs(enchantLevel)
  if (magnitude >= 2) return 'rare'
  if (magnitude === 1) return 'uncommon'
  return 'common'
}

export interface GeneratedItem {
  slot: EquipmentSlot
  name: string
  quality: ItemQuality
  enchantLevel: number
  baseStat: keyof StatBlock
  affixes: Affix[]
  statBonuses: Partial<StatBlock>
  /** Set for weapon-slot items AND for shield-slot items that rolled as a dual-wield offhand weapon. */
  weaponType: WeaponType | null
  /** 0-1. Weapon-only: chance to swing a second time in the same round. */
  extraAttackChance: number
  /** Shield-only (and only when weaponType is null): how many hits it can block in one round. Always 2. */
  maxBlocksPerRound: number | null
  /** Weapon-only: this weapon's own damage range and the skill needed to reach its max. */
  minDamage: number | null
  maxDamage: number | null
  /** The skill needed to use the item effectively (weapon max damage, or a shield's full block/absorption potential). */
  recommendedSkill: number | null
  /** Shield-only: this shield's own absorption range - each block rolls between minAbsorption and this max, scaled by skill. */
  absorption: number | null
  minAbsorption: number | null
  /** "Brytvärde" - cumulative damage this item can deal/absorb before it breaks. Fully independent of recommendedSkill. */
  breakThreshold: number | null
}

function rollSlot(): EquipmentSlot {
  return EQUIPMENT_SLOTS[Math.floor(Math.random() * EQUIPMENT_SLOTS.length)]
}

function rollFromPool(pool: (keyof StatBlock)[]): keyof StatBlock {
  return pool[Math.floor(Math.random() * pool.length)]
}

function rollBaseValue(level: number): number {
  const base = 2 + level
  const variance = 0.8 + Math.random() * 0.4
  return Math.max(1, Math.round(base * variance))
}

function rollAffixValue(level: number): number {
  const base = 2 + level * 0.6
  const variance = 0.8 + Math.random() * 0.4
  return Math.max(1, Math.round(base * variance))
}

/**
 * -2/-1 = cursed (1-2 negative affixes), 0 = plain item, +1/+2 = enchanted
 * (1-2 positive affixes). 0 is the most common roll by far.
 */
function rollEnchantLevel(): number {
  const roll = Math.random()
  if (roll < 0.5) return 0
  if (roll < 0.68) return 1
  if (roll < 0.86) return -1
  if (roll < 0.93) return 2
  return -2
}

function signSuffix(enchantLevel: number): string {
  if (enchantLevel === 0) return ''
  return enchantLevel > 0 ? ` +${enchantLevel}` : ` ${enchantLevel}`
}

export function generateLootItem(level: number, forcedEnchantLevel?: number): GeneratedItem {
  const slot = rollSlot()
  const enchantLevel = forcedEnchantLevel ?? rollEnchantLevel()
  const magnitude = Math.abs(enchantLevel)
  const sign = Math.sign(enchantLevel)

  const isOffHandWeapon = slot === 'shield' && Math.random() < OFF_HAND_WEAPON_CHANCE
  const weaponType = (slot === 'weapon' || isOffHandWeapon) ? WEAPON_TYPES[Math.floor(Math.random() * WEAPON_TYPES.length)] : null
  const extraAttackChance = weaponType && Math.random() < SPECIAL_WEAPON_CHANCE ? 0.1 + Math.random() * 0.15 : 0
  // Every shield always has two defensive actions per round.
  const maxBlocksPerRound = slot === 'shield' && !isOffHandWeapon ? 2 : null
  const damageRange = weaponType ? rollWeaponDamageRange(weaponType, level, enchantLevel) : null
  const shieldStats = slot === 'shield' && !isOffHandWeapon ? rollShieldAbsorption(level, enchantLevel) : null

  const baseStat = weaponType ? WEAPON_TYPE_SKILL_KEY[weaponType] : slot === 'shield' ? 'shieldSkill' : rollFromPool(GENERAL_STAT_KEYS)
  const baseValue = rollBaseValue(level)
  const statBonuses: Partial<StatBlock> = { [baseStat]: baseValue }

  const affixes: Affix[] = []
  for (let i = 0; i < magnitude; i++) {
    const kind: AffixKind = i === 0 ? 'prefix' : 'suffix'
    const key = rollFromPool(AFFIX_POOLS[i % AFFIX_POOLS.length])
    const value = rollAffixValue(level) * sign
    affixes.push({ key, value, kind })
    statBonuses[key] = (statBonuses[key] ?? 0) + value
  }

  const quality = qualityForEnchantLevel(enchantLevel)
  const namePrefix = weaponType ? WEAPON_TYPE_LABELS[weaponType] : SLOT_LABELS[slot]
  const specialSuffix = extraAttackChance > 0 ? ' (dubbelhugg)' : ''
  const name = `${namePrefix} av ${STAT_LABELS[baseStat]}${signSuffix(enchantLevel)}${specialSuffix}`

  return {
    slot,
    name,
    quality,
    enchantLevel,
    baseStat,
    affixes,
    statBonuses,
    weaponType,
    extraAttackChance,
    maxBlocksPerRound,
    minDamage: damageRange?.minDamage ?? null,
    maxDamage: damageRange?.maxDamage ?? null,
    recommendedSkill: damageRange?.recommendedSkill ?? shieldStats?.recommendedSkill ?? null,
    absorption: shieldStats?.maxAbsorption ?? null,
    minAbsorption: shieldStats?.minAbsorption ?? null,
    breakThreshold: damageRange?.breakThreshold ?? shieldStats?.breakThreshold ?? null,
  }
}

const STARTER_WEAPON_BONUS = 3
const STARTER_SHIELD_BONUS = 3

/** A deliberately weak weapon every new character starts with, matching their best-trained weapon skill. */
export function generateStarterWeapon(weaponType: WeaponType): GeneratedItem {
  const baseStat = WEAPON_TYPE_SKILL_KEY[weaponType]
  const profile = WEAPON_DAMAGE_PROFILES[weaponType]
  return {
    slot: 'weapon',
    name: `Nybörjar${WEAPON_TYPE_LABELS[weaponType].toLowerCase()}`,
    quality: 'common',
    enchantLevel: 0,
    baseStat,
    affixes: [],
    statBonuses: { [baseStat]: STARTER_WEAPON_BONUS },
    weaponType,
    extraAttackChance: 0,
    maxBlocksPerRound: null,
    minDamage: 2,
    maxDamage: Math.max(3, Math.round(profile.maxBase * 0.4)),
    recommendedSkill: Math.max(5, Math.round(profile.recommendedSkill * 0.3)),
    absorption: null,
    minAbsorption: null,
    breakThreshold: Math.max(10, Math.round(profile.durabilityBase * 0.4)),
  }
}

/** A deliberately weak shield granted only if the new character put points into Sköld. */
export function generateStarterShield(): GeneratedItem {
  return {
    slot: 'shield',
    name: 'Nybörjarsköld',
    quality: 'common',
    enchantLevel: 0,
    baseStat: 'shieldSkill',
    affixes: [],
    statBonuses: { shieldSkill: STARTER_SHIELD_BONUS },
    weaponType: null,
    extraAttackChance: 0,
    maxBlocksPerRound: 2,
    minDamage: null,
    maxDamage: null,
    recommendedSkill: Math.max(5, Math.round(SHIELD_ABSORPTION_PROFILE.recommendedSkill * 0.3)),
    absorption: Math.max(2, Math.round(SHIELD_ABSORPTION_PROFILE.maxBase * 0.4)),
    minAbsorption: Math.max(1, Math.round(SHIELD_ABSORPTION_PROFILE.minBase * 0.4)),
    breakThreshold: Math.max(10, Math.round(SHIELD_ABSORPTION_PROFILE.durabilityBase * 0.4)),
  }
}

export interface EquippedItemBonuses {
  stat_bonuses: Partial<StatBlock>
}

export function applyItemBonuses(stats: StatBlock, equippedItems: EquippedItemBonuses[]): StatBlock {
  const result = { ...stats }
  for (const item of equippedItems) {
    for (const key of STAT_KEYS) {
      const bonus = item.stat_bonuses[key]
      if (bonus) result[key] += bonus
    }
  }
  return result
}
