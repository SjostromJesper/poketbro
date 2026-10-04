<script setup lang="ts">
import { gameData } from '~~/nudge/data'
import { STARTERS, STARTER_LEVEL } from '~~/nudge/game/items'
import { TYPE_COLORS, TYPE_LABELS } from '../ui'

defineEmits<{ (e: 'choose', speciesId: number): void }>()
const options = STARTERS.map(s => ({ ...s, species: gameData.species[s.speciesId] }))
</script>

<template>
  <div class="modal">
    <div class="px-panel box">
      <h2 class="px-title">Välj din första Pokémon</h2>
      <div class="cards">
        <button v-for="o in options" :key="o.speciesId" type="button" class="card" @click="$emit('choose', o.speciesId)">
          <img :src="o.species.sprites.front" :alt="o.species.displayName" draggable="false">
          <strong class="px-title">{{ o.species.displayName }}</strong>
          <span class="lv">Nivå {{ STARTER_LEVEL }}</span>
          <span class="types">
            <i v-for="t in o.species.types" :key="t" :style="{ background: TYPE_COLORS[t] }">{{ TYPE_LABELS[t] }}</i>
          </span>
          <span class="blurb">{{ o.blurb }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.7);
  z-index: 30;
}

.box {
  padding: 16px;
  width: min(760px, 96%);
}

h2 {
  font-size: 12px;
  margin: 0 0 12px;
  text-align: center;
}

.cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px 8px;
  color: #eef2f7;
  font-family: inherit;
  background: #1f2d44;
  border: 3px solid #0a0f16;
  box-shadow: inset 0 0 0 2px #35496a;
  cursor: pointer;
}

.card:hover {
  background: #2a3d5c;
  box-shadow: inset 0 0 0 2px #ffd840;
}

.card img {
  height: 96px;
  image-rendering: pixelated;
  object-fit: contain;
  transform: scale(1.3);
  margin: 8px 0;
}

.card strong {
  font-size: 11px;
}

.lv {
  color: #ffd840;
  font-size: 14px;
}

.types {
  display: flex;
  gap: 4px;
}

.types i {
  font-style: normal;
  font-size: 12px;
  padding: 2px 6px;
  color: #0a0f16;
  border: 2px solid #0a0f16;
}

.blurb {
  font-size: 14px;
  color: #9fb2cc;
  text-align: center;
}
</style>
