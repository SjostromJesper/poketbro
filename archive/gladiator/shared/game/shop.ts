import type { StatBlock } from './races'
import { STAT_KEYS } from './races'
import { generateLootItem, type GeneratedItem, type ItemQuality } from './items'

/** What the merchant pays you, as a fraction of an item's estimated value - always well below what they'd sell it for. */
export const SELL_TO_MERCHANT_RATE = 0.3
export const STARTING_GOLD = 50
export const SHOP_STOCK_SIZE = 6
/** Gold reward for winning a battle (training or PvP). */
export const WIN_GOLD = 15

const QUALITY_VALUE_BASE: Record<ItemQuality, number> = {
  common: 10,
  uncommon: 20,
  rare: 35,
}

export interface ValuableItem {
  quality: ItemQuality
  enchantLevel: number
  statBonuses: Partial<StatBlock>
  extraAttackChance?: number
  maxBlocksPerRound?: number | null
  minDamage?: number | null
  maxDamage?: number | null
}

/** A rough power estimate used to price both what the shop sells items for and what it pays for yours. */
export function estimateItemValue(item: ValuableItem): number {
  const statSum = STAT_KEYS.reduce((sum, key) => sum + Math.abs(item.statBonuses[key] ?? 0), 0)
  let value = QUALITY_VALUE_BASE[item.quality] + statSum * 3
  value += Math.abs(item.enchantLevel) * 12
  if ((item.extraAttackChance ?? 0) > 0) value += 40
  if ((item.maxBlocksPerRound ?? 1) > 1) value += 40
  if (item.minDamage != null && item.maxDamage != null) value += (item.minDamage + item.maxDamage) * 2
  return Math.max(5, Math.round(value))
}

export function sellPriceFor(item: ValuableItem): number {
  return Math.max(1, Math.round(estimateItemValue(item) * SELL_TO_MERCHANT_RATE))
}

export interface ShopOfferSeed {
  item: GeneratedItem
  price: number
}

/** Freshly rolled, ephemeral shop stock - not the same items twice. */
export function generateShopStock(level: number, count = SHOP_STOCK_SIZE): ShopOfferSeed[] {
  const offers: ShopOfferSeed[] = []
  for (let i = 0; i < count; i++) {
    const item = generateLootItem(level)
    offers.push({ item, price: estimateItemValue(item) })
  }
  return offers
}
