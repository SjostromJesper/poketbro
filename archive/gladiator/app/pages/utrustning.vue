<script setup lang="ts">
import { EQUIPMENT_SLOTS, QUALITY_LABELS, SLOT_LABELS, WEAPON_TYPE_LABELS } from '#shared/game/items'
import { STAT_LABELS } from '#shared/game/races'
import type { InventoryItem } from '~/composables/useInventory'

const { character, load: loadCharacter } = useCharacter()
const { items, load: loadItems, equip, unequip, discard } = useInventory()

const busyId = ref<string | null>(null)
const errorMessage = ref('')

onMounted(async () => {
  await Promise.all([loadCharacter(), loadItems()])
  if (!character.value) {
    navigateTo('/')
  }
})

const slotRows = computed(() => {
  const map: Partial<Record<string, InventoryItem>> = {}
  for (const item of items.value) {
    if (item.equipped) map[item.slot] = item
  }
  return EQUIPMENT_SLOTS.map(slot => ({ slot, item: map[slot] ?? null }))
})

const unequippedItems = computed(() => items.value.filter(i => !i.equipped))

function bonusText(item: InventoryItem) {
  return Object.entries(item.stat_bonuses)
    .map(([key, value]) => `${STAT_LABELS[key as keyof typeof STAT_LABELS]} ${value! > 0 ? '+' : ''}${value}`)
    .join(' · ')
}

function specialText(item: InventoryItem) {
  const parts: string[] = []
  if (item.weapon_type) parts.push(WEAPON_TYPE_LABELS[item.weapon_type])
  if (item.min_damage != null && item.max_damage != null) parts.push(`Skada ${item.min_damage}-${item.max_damage}`)
  if (item.recommended_skill != null && item.weapon_type) {
    parts.push(`rek. ${WEAPON_TYPE_LABELS[item.weapon_type]} ${item.recommended_skill}`)
  }
  if (item.extra_attack_chance > 0) parts.push(`${Math.round(item.extra_attack_chance * 100)}% chans att slå igen`)
  if (item.slot === 'shield' && item.absorption != null) {
    parts.push(`absorberar ${item.min_absorption ?? '?'}-${item.absorption} skada/block`)
  }
  if (item.slot === 'shield' && item.absorption != null && item.recommended_skill != null) parts.push(`rek. Sköld ${item.recommended_skill}`)
  if (item.slot === 'shield' && item.absorption != null && item.max_blocks_per_round > 1) parts.push(`kan blockera ${item.max_blocks_per_round} slag/runda`)
  if (item.break_threshold != null && (item.weapon_type || item.absorption != null)) parts.push(`brytvärde ${item.break_threshold}`)
  return parts.join(' · ')
}

async function doEquip(itemId: string) {
  busyId.value = itemId
  errorMessage.value = ''
  try {
    await equip(itemId)
    await loadCharacter(true)
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage ?? 'Kunde inte utrusta föremålet'
  } finally {
    busyId.value = null
  }
}

async function doUnequip(itemId: string) {
  busyId.value = itemId
  errorMessage.value = ''
  try {
    await unequip(itemId)
    await loadCharacter(true)
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage ?? 'Kunde inte ta av föremålet'
  } finally {
    busyId.value = null
  }
}

async function doDiscard(itemId: string, wasEquipped: boolean) {
  if (!confirm('Släng föremålet? Detta går inte att ångra.')) return
  busyId.value = itemId
  errorMessage.value = ''
  try {
    await discard(itemId)
    if (wasEquipped) await loadCharacter(true)
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage ?? 'Kunde inte slänga föremålet'
  } finally {
    busyId.value = null
  }
}
</script>

<template>
  <div v-if="character" class="card">
    <h1>Utrustning</h1>
    <p class="hint">Utrustning du hittar i strid kan ge bonusar - eller förbannade minus - till dina egenskaper.</p>

    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

    <h2>Utrustade föremål</h2>
    <div class="slot-grid">
      <div v-for="row in slotRows" :key="row.slot" class="slot-box" :class="{ filled: row.item }">
        <span class="slot-label">{{ SLOT_LABELS[row.slot] }}</span>
        <template v-if="row.item">
          <strong class="item-name" :class="[row.item.quality, { cursed: row.item.enchant_level < 0 }]">{{ row.item.name }}</strong>
          <span class="item-bonus hint">{{ bonusText(row.item) }}</span>
          <span v-if="specialText(row.item)" class="item-special hint">{{ specialText(row.item) }}</span>
          <div class="slot-actions">
            <button type="button" class="small-btn" :disabled="busyId === row.item.id" @click="doUnequip(row.item.id)">
              Ta av
            </button>
            <button type="button" class="small-btn danger" :disabled="busyId === row.item.id" @click="doDiscard(row.item.id, true)">
              Släng
            </button>
          </div>
        </template>
        <span v-else class="hint empty-slot">Tomt</span>
      </div>
    </div>

    <h2>Inventarie</h2>
    <p v-if="unequippedItems.length === 0" class="hint">Inga föremål på lager. Vinn strider för en chans att hitta utrustning.</p>
    <ul v-else class="item-list">
      <li v-for="item in unequippedItems" :key="item.id" class="item-row">
        <div class="item-info">
          <strong class="item-name" :class="[item.quality, { cursed: item.enchant_level < 0 }]">{{ item.name }}</strong>
          <span class="hint">{{ QUALITY_LABELS[item.quality] }} · {{ SLOT_LABELS[item.slot] }} · {{ bonusText(item) }}</span>
          <span v-if="specialText(item)" class="hint item-special">{{ specialText(item) }}</span>
        </div>
        <div class="item-actions">
          <button type="button" :disabled="busyId === item.id" @click="doEquip(item.id)">Utrusta</button>
          <button type="button" class="danger" :disabled="busyId === item.id" @click="doDiscard(item.id, false)">Släng</button>
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

.error {
  color: var(--orange);
  font-size: 0.9rem;
}

.slot-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 0.75rem;
}

.slot-box {
  background: var(--bg);
  border: 1px dashed var(--border-soft);
  border-radius: 6px;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-height: 100px;
}

.slot-box.filled {
  border-style: solid;
  border-color: var(--border);
}

.slot-label {
  color: var(--text-muted);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.empty-slot {
  font-style: italic;
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

.item-bonus {
  font-size: 0.75rem;
}

.item-special {
  font-size: 0.75rem;
  color: var(--accent-strong);
}

.slot-actions {
  display: flex;
  gap: 0.4rem;
}

.small-btn {
  align-self: flex-start;
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text);
  padding: 0.25rem 0.6rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.75rem;
}

.small-btn:hover:not(:disabled) {
  border-color: var(--border-strong);
  color: var(--accent-strong);
}

.small-btn.danger:hover:not(:disabled) {
  border-color: var(--red-light);
  color: var(--red-light);
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

.item-actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
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

.item-row button.danger {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text);
}

.item-row button.danger:hover:not(:disabled) {
  background: transparent;
  border-color: var(--red-light);
  color: var(--red-light);
}

.item-row button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
