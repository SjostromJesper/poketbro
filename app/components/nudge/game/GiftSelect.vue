<script setup lang="ts">
import { gameData } from '~~/nudge/data'
import { TYPE_COLORS, TYPE_LABELS } from '../ui'

const props = defineProps<{ options: { speciesId: number, level: number }[] }>()
defineEmits<{ (e: 'choose', index: number): void }>()
const cards = props.options.map(o => ({ ...o, species: gameData.species[o.speciesId] }))
</script>

<template>
  <div class="modal">
    <div class="px-panel box">
      <h2 class="px-title">Vilken vill du ha?</h2>
      <div class="cards">
        <button v-for="(o, i) in cards" :key="o.speciesId" type="button" class="card" @click="$emit('choose', i)">
          <img :src="o.species.sprites.front" :alt="o.species.displayName" draggable="false">
          <strong class="px-title">{{ o.species.displayName }}</strong>
          <span class="lv">Nivå {{ o.level }}</span>
          <span class="types"><i v-for="t in o.species.types" :key="t" :style="{ background: TYPE_COLORS[t] }">{{ TYPE_LABELS[t] }}</i></span>
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
  width: min(560px, 94%);
}

h2 {
  font-size: 11px;
  margin: 0 0 10px;
}

.cards {
  display: flex;
  gap: 10px;
  justify-content: center;
  flex-wrap: wrap;
}

.card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px;
  min-width: 150px;
  color: #fff4dc;
  font-family: inherit;
  background: #5a4330;
  border: 3px solid #2a1c12;
  cursor: pointer;
}

.card:hover {
  background: #6e5238;
}

.card img {
  image-rendering: pixelated;
  height: 80px;
}

.card strong {
  font-size: 10px;
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
</style>
