<script setup lang="ts">
import { QUALITY_LABELS, SLOT_LABELS, WEAPON_TYPE_LABELS } from '#shared/game/items'
import { STAT_LABELS } from '#shared/game/races'
import { sellPriceFor } from '#shared/game/shop'
import type { InventoryItem } from '~/composables/useInventory'

interface ShopOffer {
  id: string
  slot: string
  name: string
  quality: 'common' | 'uncommon' | 'rare'
  enchant_level: number
  stat_bonuses: Record<string, number>
  weapon_type: keyof typeof WEAPON_TYPE_LABELS | null
  extra_attack_chance: number
  max_blocks_per_round: number
  min_damage: number | null
  max_damage: number | null
  recommended_skill: number | null
  price: number
}

const { character, load: loadCharacter, setCharacter } = useCharacter()
const { items, load: loadItems, sell } = useInventory()

const offers = ref<ShopOffer[]>([])
const loadingStock = ref(false)
const busyOfferId = ref<string | null>(null)
const busyItemId = ref<string | null>(null)
const errorMessage = ref('')

onMounted(async () => {
  await Promise.all([loadCharacter(), loadItems()])
  if (!character.value) {
    navigateTo('/')
    return
  }
  await fetchStock()
})

async function fetchStock() {
  loadingStock.value = true
  try {
    offers.value = await $fetch('/api/shop/stock')
  } finally {
    loadingStock.value = false
  }
}

function bonusText(bonuses: Record<string, number>) {
  return Object.entries(bonuses)
    .map(([key, value]) => `${STAT_LABELS[key as keyof typeof STAT_LABELS]} ${value > 0 ? '+' : ''}${value}`)
    .join(' · ')
}

function specialText(item: { weapon_type: string | null, min_damage: number | null, max_damage: number | null, recommended_skill: number | null, extra_attack_chance: number, slot: string, max_blocks_per_round: number }) {
  const parts: string[] = []
  if (item.weapon_type) parts.push(WEAPON_TYPE_LABELS[item.weapon_type as keyof typeof WEAPON_TYPE_LABELS])
  if (item.min_damage != null && item.max_damage != null) parts.push(`Skada ${item.min_damage}-${item.max_damage}`)
  if (item.recommended_skill != null && item.weapon_type) {
    parts.push(`rek. ${WEAPON_TYPE_LABELS[item.weapon_type as keyof typeof WEAPON_TYPE_LABELS]} ${item.recommended_skill}`)
  }
  if (item.extra_attack_chance > 0) parts.push(`${Math.round(item.extra_attack_chance * 100)}% chans att slå igen`)
  if (item.slot === 'shield' && item.max_blocks_per_round > 1) parts.push(`kan blockera ${item.max_blocks_per_round} slag/runda`)
  return parts.join(' · ')
}

function itemSellPrice(item: InventoryItem) {
  return sellPriceFor({
    quality: item.quality,
    enchantLevel: item.enchant_level,
    statBonuses: item.stat_bonuses,
    extraAttackChance: item.extra_attack_chance,
    maxBlocksPerRound: item.max_blocks_per_round,
    minDamage: item.min_damage,
    maxDamage: item.max_damage,
  })
}

async function buy(offer: ShopOffer) {
  if (!character.value || character.value.gold < offer.price) return
  busyOfferId.value = offer.id
  errorMessage.value = ''
  try {
    const response = await $fetch('/api/shop/buy', { method: 'POST', body: { offerId: offer.id } })
    setCharacter(response.character as any)
    items.value = [...items.value, response.item as InventoryItem]
    offers.value = offers.value.filter(o => o.id !== offer.id)
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage ?? 'Kunde inte köpa föremålet'
  } finally {
    busyOfferId.value = null
  }
}

async function sellItem(item: InventoryItem) {
  busyItemId.value = item.id
  errorMessage.value = ''
  try {
    const response = await sell(item.id)
    setCharacter(response.character as any)
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage ?? 'Kunde inte sälja föremålet'
  } finally {
    busyItemId.value = null
  }
}
</script>

<template>
  <div v-if="character" class="card">
    <h1>Köpmannen</h1>
    <p class="hint">Köp utrustning för guld, eller sälj dina egna saker - köpmannen betalar betydligt mindre än de är värda.</p>
    <p class="gold-line">Guld: <strong>{{ character.gold }}</strong></p>

    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

    <h2>Till salu</h2>
    <p v-if="loadingStock" class="hint">Laddar lager...</p>
    <p v-else-if="offers.length === 0" class="hint">Köpmannen har inget kvar just nu.</p>
    <ul v-else class="item-list">
      <li v-for="offer in offers" :key="offer.id" class="item-row">
        <div class="item-info">
          <strong class="item-name" :class="[offer.quality, { cursed: offer.enchant_level < 0 }]">{{ offer.name }}</strong>
          <span class="hint">{{ QUALITY_LABELS[offer.quality] }} · {{ SLOT_LABELS[offer.slot as keyof typeof SLOT_LABELS] }} · {{ bonusText(offer.stat_bonuses) }}</span>
          <span v-if="specialText(offer)" class="hint item-special">{{ specialText(offer) }}</span>
        </div>
        <div class="item-actions">
          <span class="price">{{ offer.price }} guld</span>
          <button type="button" :disabled="busyOfferId === offer.id || character.gold < offer.price" @click="buy(offer)">
            Köp
          </button>
        </div>
      </li>
    </ul>

    <h2>Din utrustning</h2>
    <p v-if="items.length === 0" class="hint">Du har inget att sälja.</p>
    <ul v-else class="item-list">
      <li v-for="item in items" :key="item.id" class="item-row">
        <div class="item-info">
          <strong class="item-name" :class="[item.quality, { cursed: item.enchant_level < 0 }]">
            {{ item.name }}<span v-if="item.equipped" class="hint"> (utrustad)</span>
          </strong>
          <span class="hint">{{ QUALITY_LABELS[item.quality] }} · {{ SLOT_LABELS[item.slot] }} · {{ bonusText(item.stat_bonuses) }}</span>
        </div>
        <div class="item-actions">
          <span class="price">{{ itemSellPrice(item) }} guld</span>
          <button type="button" class="sell-btn" :disabled="busyItemId === item.id" @click="sellItem(item)">
            Sälj
          </button>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
h2 {
  color: var(--accent-strong);
  font-size: 1.05rem;
  margin: 1.25rem 0 0.75rem;
}

.gold-line {
  margin: 0.25rem 0 1rem;
}

.gold-line strong {
  color: var(--accent-strong);
}

.error {
  color: var(--orange);
  font-size: 0.9rem;
}

.item-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  background: var(--bg);
  border: 1px solid var(--border-soft);
  border-radius: 4px;
  padding: 0.6rem 0.85rem;
}

.item-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.item-name {
  font-size: 0.9rem;
}

.item-name.common {
  color: var(--text);
}

.item-name.uncommon {
  color: var(--green);
}

.item-name.rare {
  color: var(--blue);
}

.item-name.cursed {
  color: var(--red-light);
}

.item-special {
  color: var(--accent-strong);
}

.item-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
}

.price {
  color: var(--accent-strong);
  font-size: 0.85rem;
  white-space: nowrap;
}

.item-row button {
  background: var(--accent);
  border: none;
  border-radius: 4px;
  padding: 0.4rem 0.8rem;
  color: var(--text-inverse);
  cursor: pointer;
  flex-shrink: 0;
}

.item-row button:hover:not(:disabled) {
  background: var(--accent-hover);
}

.item-row button.sell-btn {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text);
}

.item-row button.sell-btn:hover:not(:disabled) {
  background: transparent;
  border-color: var(--accent);
  color: var(--accent-strong);
}

.item-row button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
