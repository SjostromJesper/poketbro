<script setup lang="ts">
// The Pokédex: every species with its number; seen ones show sprite and types, owned ones a ball. "Where to find it" only for seen ones.
import { computed, ref } from 'vue'
import { gameData } from '~~/nudge/data'
import { describeSources, obtainable } from '~~/nudge/game/pokedex'
import { usePlayerStore } from '~/stores/nudge/player'
import { TYPE_COLORS, TYPE_LABELS } from '../ui'

defineEmits<{ (e: 'back'): void }>()

const player = usePlayerStore()
const entries = Object.values(gameData.species).sort((a, b) => a.id - b.id)
const sources = obtainable(gameData)
const selected = ref<number | null>(null)

const seen = computed(() => new Set(player.pokedexSeen))
const owned = computed(() => new Set(player.pokedex))
const detail = computed(() => {
  const species = selected.value ? gameData.species[selected.value] : null
  if (!species || !seen.value.has(species.id)) return null
  return { species, owned: owned.value.has(species.id), where: describeSources(gameData, sources.get(species.id) ?? []) }
})
</script>

<template>
  <div class="screen">
    <h2 class="px-title">Pokédex</h2>
    <p class="count">Sedda {{ seen.size }} &middot; Fångade {{ owned.size }} &middot; av {{ entries.length }}</p>
    <div class="cols">
      <div class="grid">
        <button
          v-for="s in entries" :key="s.id" type="button" class="cell" :class="{ unknown: !seen.has(s.id), picked: selected === s.id }"
          @click="selected = s.id"
        >
          <span class="no">{{ String(s.id).padStart(3, '0') }}</span>
          <img v-if="seen.has(s.id)" :src="s.sprites.icon" :alt="s.displayName" draggable="false">
          <span v-else class="q">?</span>
          <i v-if="owned.has(s.id)" class="ball" title="Fångad" />
        </button>
      </div>
      <div class="detail px-panel">
        <template v-if="detail">
          <img :src="detail.species.sprites.front" :alt="detail.species.displayName" draggable="false">
          <h3>#{{ String(detail.species.id).padStart(3, '0') }} {{ detail.species.displayName }}</h3>
          <div class="types">
            <i v-for="t in detail.species.types" :key="t" :style="{ background: TYPE_COLORS[t] }">{{ TYPE_LABELS[t] }}</i>
          </div>
          <p>{{ detail.owned ? 'Du har fångat den.' : 'Sedd, men inte fångad än.' }}</p>
          <p class="where-title">Var hittar man den?</p>
          <ul v-if="detail.where.length">
            <li v-for="line in detail.where" :key="line">{{ line }}</li>
          </ul>
          <p v-else class="hint">Ingen vet än (kanske finns den inte i den här världen).</p>
        </template>
        <p v-else class="hint">{{ selected ? 'Du har inte sett den här Pokémonen än.' : 'Välj en ruta.' }}</p>
      </div>
    </div>
    <button type="button" class="px-btn" @click="$emit('back')">Tillbaka</button>
  </div>
</template>

<style scoped>
.screen {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
}

h2 {
  margin: 0;
  font-size: 12px;
}

.count {
  margin: 0;
  color: #eadcb8;
}

.cols {
  display: flex;
  gap: 10px;
  min-height: 0;
  flex: 1;
}

.grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(54px, 1fr));
  gap: 4px;
  overflow: auto;
  align-content: start;
}

.cell {
  position: relative;
  display: grid;
  place-items: center;
  height: 54px;
  padding: 0;
  color: #fff4dc;
  font-family: inherit;
  background: #5a4330;
  border: 2px solid #2a1c12;
  cursor: pointer;
}

.cell.unknown {
  background: #3a2a1c;
  color: #8a6a44;
}

.cell.picked {
  outline: 3px solid #ffd840;
  outline-offset: -3px;
}

.no {
  position: absolute;
  top: 1px;
  left: 3px;
  font-size: 10px;
  color: #dcc8a0;
}

.cell img {
  image-rendering: pixelated;
  max-height: 38px;
}

.q {
  font-size: 22px;
}

.ball {
  position: absolute;
  right: 3px;
  bottom: 3px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: linear-gradient(#e04040 50%, #f4f4f4 50%);
  border: 2px solid #2a1c12;
}

.detail {
  width: 240px;
  padding: 10px;
  overflow: auto;
}

.detail img {
  display: block;
  margin: 0 auto;
  image-rendering: pixelated;
  max-height: 96px;
}

h3 {
  margin: 6px 0;
  font-size: 11px;
  font-family: 'Press Start 2P', monospace;
  color: #ffd840;
}

.types {
  display: flex;
  gap: 4px;
}

.types i {
  font-style: normal;
  font-size: 12px;
  padding: 1px 6px;
  color: #2a1c12;
}

.detail p {
  margin: 6px 0;
}

.where-title {
  color: #ffd070;
}

ul {
  margin: 0;
  padding-left: 18px;
}

.hint {
  color: #dcc8a0;
}
</style>
