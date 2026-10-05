import type { EquipmentSlot, ItemQuality, WeaponType } from '#shared/game/items'
import type { StatBlock } from '#shared/game/races'

export interface InventoryItem {
  id: string
  user_id: string
  slot: EquipmentSlot
  name: string
  quality: ItemQuality
  enchant_level: number
  stat_bonuses: Partial<StatBlock>
  equipped: boolean
  created_at: string
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

export function useInventory() {
  const items = useState<InventoryItem[]>('inventoryItems', () => [])
  const loaded = useState('inventoryLoaded', () => false)

  async function load(force = false) {
    if (loaded.value && !force) return
    try {
      items.value = await $fetch('/api/inventory/list')
    } catch {
      items.value = []
    }
    loaded.value = true
  }

  async function equip(itemId: string) {
    items.value = await $fetch('/api/inventory/equip', { method: 'POST', body: { itemId } })
  }

  async function unequip(itemId: string) {
    items.value = await $fetch('/api/inventory/unequip', { method: 'POST', body: { itemId } })
  }

  async function discard(itemId: string) {
    items.value = await $fetch('/api/inventory/discard', { method: 'POST', body: { itemId } })
  }

  async function sell(itemId: string) {
    const response = await $fetch('/api/shop/sell', { method: 'POST', body: { itemId } })
    items.value = items.value.filter(i => i.id !== itemId)
    return response
  }

  function reset() {
    items.value = []
    loaded.value = false
  }

  return { items, load, equip, unequip, discard, sell, reset }
}
