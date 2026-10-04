<script setup lang="ts">
import { computed, ref } from 'vue'
import { gameData } from '~~/nudge/data'
import { BALANCE } from '~~/nudge/engine/balance'
import { displayNameOf, maxHpOf } from '~~/nudge/engine/pokemon'
import { itemInfo, type ItemInfo } from '~~/nudge/game/items'
import { usePlayerStore } from '~/stores/nudge/player'
import { hpColor, STATUS_LABELS, TYPE_COLORS } from '../ui'

defineEmits<{ (e: 'back'): void }>()

const player = usePlayerStore()
type Tab = 'all' | 'items' | 'balls' | 'held' | 'tm'
const tab = ref<Tab>('all')
const message = ref('')

type Mode = 'use' | 'give' | 'feed' | 'tm'
const picking = ref<{ item: ItemInfo, mode: Mode } | null>(null)
const replacing = ref<{ item: ItemInfo, uid: string } | null>(null)

const TABS: { id: Tab, label: string }[] = [
  { id: 'all', label: 'Alla' }, { id: 'items', label: 'Läkning' }, { id: 'balls', label: 'Bollar' }, { id: 'held', label: 'Hålls' }, { id: 'tm', label: 'TM' },
]

const entries = computed(() => Object.entries(player.bag)
  .filter(([, n]) => n > 0)
  .map(([id, n]) => ({ info: itemInfo(gameData, id), n }))
  .filter(({ info }) => {
    switch (tab.value) {
      case 'items': return info.kind === 'potion' || info.kind === 'cure'
      case 'balls': return info.kind === 'ball'
      case 'held': return info.kind === 'held'
      case 'tm': return info.kind === 'tm'
      default: return true
    }
  }))

function start(item: ItemInfo, mode: Mode) {
  message.value = ''
  picking.value = { item, mode }
}

function eligible(pokemon: (typeof player.party)[number]): string | null {
  const p = picking.value
  if (!p) return null
  switch (p.mode) {
    case 'use':
      if (pokemon.currentHp <= 0) return 'svimmad'
      if (p.item.id === 'potion') return pokemon.currentHp >= maxHpOf(gameData, pokemon) ? 'full HP' : null
      if (p.item.id === 'antidote') return pokemon.status === 'poison' ? null : 'inte förgiftad'
      if (p.item.id === 'paralyze-heal') return pokemon.status === 'paralysis' ? null : 'inte förlamad'
      return 'går inte'
    case 'tm': {
      const status = player.tmStatus(p.item.id, pokemon)
      return status === 'can' ? null : status === 'known' ? 'kan redan' : 'kan inte lära sig'
    }
    default:
      return null
  }
}

function pick(uid: string) {
  const p = picking.value
  const pokemon = player.party.find(x => x.uid === uid)
  if (!p || !pokemon) return
  let result: string | null = null
  if (p.mode === 'use') result = player.useHealingItem(p.item.id, uid)
  else if (p.mode === 'give') result = player.giveHeldItem(p.item.id, uid)
  else if (p.mode === 'feed') result = player.feedBerry(uid)
  else if (p.mode === 'tm') {
    if (pokemon.moves.length >= BALANCE.MAX_MOVES) {
      replacing.value = { item: p.item, uid }
      picking.value = null
      return
    }
    result = player.teachTm(p.item.id, uid, null)
  }
  message.value = result ?? 'Det hade ingen effekt.'
  picking.value = null
}

/** Index of the favorite move about to be forgotten, waiting for a second confirmation. */
const confirmingFavorite = ref<number | null>(null)

function askReplace(index: number) {
  const pokemon = replacing.value ? player.findPokemon(replacing.value.uid) : null
  if (pokemon && pokemon.moves[index]?.move === pokemon.favoriteMove) confirmingFavorite.value = index
  else replace(index)
}

function replace(index: number) {
  const r = replacing.value
  if (!r) return
  confirmingFavorite.value = null
  message.value = player.teachTm(r.item.id, r.uid, index) ?? 'Det gick inte.'
  replacing.value = null
}
</script>

<template>
  <div class="screen">
    <h2 class="px-title">Väska</h2>
    <div class="tabs">
      <button v-for="t in TABS" :key="t.id" type="button" class="px-btn small" :class="{ primary: tab === t.id }" @click="tab = t.id">{{ t.label }}</button>
    </div>

    <ul v-if="!picking && !replacing" class="list">
      <li v-for="e in entries" :key="e.info.id" class="item px-panel">
        <div class="text">
          <strong>{{ e.info.name }}</strong> <span class="n">x{{ e.n }}</span>
          <div class="desc">{{ e.info.description }}</div>
        </div>
        <div class="actions">
          <button v-if="e.info.kind === 'potion' || e.info.kind === 'cure'" type="button" class="px-btn small" @click="start(e.info, 'use')">Använd</button>
          <button v-if="e.info.holdable" type="button" class="px-btn small" @click="start(e.info, 'give')">Ge</button>
          <button v-if="e.info.id === 'oran-berry'" type="button" class="px-btn small" @click="start(e.info, 'feed')">Mata</button>
          <button v-if="e.info.kind === 'tm'" type="button" class="px-btn small" @click="start(e.info, 'tm')">Lär ut</button>
          <span v-if="e.info.kind === 'ball'" class="note">Används i strid</span>
        </div>
      </li>
      <li v-if="entries.length === 0" class="empty">Inget här.</li>
    </ul>

    <div v-else-if="picking" class="picker">
      <h3 class="px-title">
        <template v-if="picking.mode === 'give'">Ge {{ picking.item.name }} till...</template>
        <template v-else-if="picking.mode === 'feed'">Mata vem med {{ picking.item.name }}?</template>
        <template v-else-if="picking.mode === 'tm'">Lär ut {{ picking.item.name }} till...</template>
        <template v-else>Använd {{ picking.item.name }} på...</template>
      </h3>
      <button
        v-for="p in player.party" :key="p.uid" type="button" class="px-btn row" :disabled="!!eligible(p)" @click="pick(p.uid)"
      >
        <img :src="gameData.species[p.speciesId].sprites.icon" alt="" class="icon">
        <span class="pname">{{ displayNameOf(gameData, p) }} Lv{{ p.level }}</span>
        <span v-if="p.status" class="chip" :style="{ background: STATUS_LABELS[p.status].color }">{{ STATUS_LABELS[p.status].short }}</span>
        <span class="php">
          <i class="bar"><b :style="{ width: `${(p.currentHp / maxHpOf(gameData, p)) * 100}%`, background: hpColor((p.currentHp / maxHpOf(gameData, p)) * 100) }" /></i>
          {{ p.currentHp }}/{{ maxHpOf(gameData, p) }}
        </span>
        <span v-if="picking.mode === 'give' && p.heldItem" class="why">håller {{ itemInfo(gameData, p.heldItem).name }}</span>
        <span v-if="eligible(p)" class="why">{{ eligible(p) }}</span>
      </button>
      <button type="button" class="px-btn" @click="picking = null">Avbryt</button>
    </div>

    <div v-else-if="replacing" class="picker">
      <template v-if="confirmingFavorite !== null">
        <h3 class="px-title">
          ♥ {{ displayNameOf(gameData, player.findPokemon(replacing.uid)!) }} älskar {{ gameData.moves[player.findPokemon(replacing.uid)!.favoriteMove ?? '']?.displayName }}. Är du säker?
        </h3>
        <p class="why">Förtroendet sjunker lite och den får ingen ny favorit på ett tag.</p>
        <button type="button" class="px-btn" @click="replace(confirmingFavorite)">Ja, glöm den</button>
        <button type="button" class="px-btn primary" @click="confirmingFavorite = null">Nej, tillbaka</button>
      </template>
      <template v-else>
      <h3 class="px-title">Vilken attack ska glömmas?</h3>
      <button
        v-for="(m, i) in player.findPokemon(replacing.uid)?.moves ?? []" :key="m.move" type="button" class="px-btn row" @click="askReplace(i)"
      >
        <span class="swatch" :style="{ background: TYPE_COLORS[gameData.moves[m.move].type] }" />
        <span class="pname">Glöm {{ gameData.moves[m.move].displayName }}</span>
      </button>
      <button type="button" class="px-btn" @click="replacing = null">Avbryt</button>
      </template>
    </div>

    <p class="message">{{ message }}</p>
    <button v-if="!picking && !replacing" type="button" class="px-btn" @click="$emit('back')">Tillbaka</button>
  </div>
</template>

<style scoped>
.screen {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
}

h2 { font-size: 12px; margin: 0; }
h3 { font-size: 10px; margin: 0 0 6px; line-height: 1.5; }

.tabs {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.small { padding: 6px 8px; }

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow: auto;
  flex: 1;
}

.item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
}

.text { flex: 1; }

.n { color: #ffd840; }

.desc {
  font-size: 13px;
  color: #9fb2cc;
}

.actions {
  display: flex;
  gap: 4px;
}

.note {
  font-size: 12px;
  color: #6f86a8;
}

.empty { color: #9fb2cc; }

.picker {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  overflow: auto;
}

.row {
  display: flex;
  align-items: center;
  gap: 10px;
  text-align: left;
  text-transform: none;
}

.icon {
  width: 36px;
  height: 36px;
  image-rendering: pixelated;
}

.pname {
  font-family: 'Pixelify Sans', monospace;
  font-size: 15px;
  flex: 1;
}

.php {
  font-family: 'Pixelify Sans', monospace;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.bar {
  display: inline-block;
  width: 70px;
  height: 7px;
  background: #0a0f16;
}

.bar b {
  display: block;
  height: 100%;
}

.why {
  font-family: 'Pixelify Sans', monospace;
  font-size: 12px;
  color: #ff9a8a;
}

.chip {
  font-family: 'Pixelify Sans', monospace;
  font-size: 11px;
  padding: 1px 5px;
  color: #0a0f16;
}

.swatch {
  width: 10px;
  height: 18px;
}

.message {
  margin: 0;
  min-height: 20px;
  color: #8ef08e;
}
</style>
