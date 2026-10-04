<script setup lang="ts">
import { computed } from 'vue'
import { gameData } from '~~/nudge/data'
import { displayNameOf } from '~~/nudge/engine/pokemon'
import { usePlayerStore } from '~/stores/nudge/player'

const props = defineProps<{ uid: string, to: number }>()
const emit = defineEmits<{ (e: 'resolve', accept: boolean): void }>()

const player = usePlayerStore()
const pokemon = computed(() => player.findPokemon(props.uid))
const from = computed(() => (pokemon.value ? gameData.species[pokemon.value.speciesId] : null))
const to = computed(() => gameData.species[props.to])
const name = computed(() => (pokemon.value ? displayNameOf(gameData, pokemon.value) : '?'))

function onKey(event: KeyboardEvent) {
  if (event.key === 'x' || event.key === 'X' || event.key === 'Escape') emit('resolve', false)
}
</script>

<template>
  <div class="modal" tabindex="-1" @keydown="onKey">
    <div class="px-panel box">
      <h2 class="px-title">Vad? {{ name }} håller på att utvecklas!</h2>
      <div class="sprites">
        <img v-if="from" :src="from.sprites.front" :alt="from.displayName" draggable="false">
        <span class="arrow">&rarr;</span>
        <img v-if="to" class="to" :src="to.sprites.front" :alt="to.displayName" draggable="false">
      </div>
      <p>{{ name }} kan utvecklas till {{ to?.displayName }}.</p>
      <div class="actions">
        <button type="button" class="px-btn primary" @click="emit('resolve', true)">Utveckla</button>
        <button type="button" class="px-btn" @click="emit('resolve', false)">Avbryt (X)</button>
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
  background: rgba(0, 0, 0, 0.78);
  z-index: 30;
}

.box {
  padding: 16px;
  width: min(520px, 94%);
  text-align: center;
}

h2 {
  font-size: 11px;
  line-height: 1.6;
  margin: 0 0 8px;
}

.sprites {
  display: flex;
  justify-content: center;
  align-items: flex-end;
  gap: 24px;
  height: 140px;
  padding-bottom: 12px;
}

.sprites img {
  image-rendering: pixelated;
  max-height: 110px;
  transform: scale(1.4);
  transform-origin: bottom center;
}

.to {
  filter: drop-shadow(0 0 10px #ffd840);
  animation: pulse 1s ease-in-out infinite alternate;
}

.arrow {
  font-size: 28px;
  color: #ffd840;
  align-self: center;
}

.actions {
  display: flex;
  gap: 10px;
  justify-content: center;
}

@keyframes pulse {
  from { filter: drop-shadow(0 0 4px #ffd840); }
  to { filter: drop-shadow(0 0 16px #ffd840) brightness(1.2); }
}
</style>
