<script setup lang="ts">
// The evolution scene: the sprite flickers between the old and the new form, then the evolution completes.
// X, B or Esc cancels at any time before it is done.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { gameData } from '~~/nudge/data'
import { displayNameOf } from '~~/nudge/engine/pokemon'
import { useAudioStore } from '~/stores/nudge/audio'
import { usePlayerStore } from '~/stores/nudge/player'

const props = defineProps<{ uid: string, to: number }>()
const emit = defineEmits<{ (e: 'resolve', accept: boolean): void }>()

const player = usePlayerStore()
const audio = useAudioStore()
const pokemon = computed(() => player.findPokemon(props.uid))
const from = computed(() => (pokemon.value ? gameData.species[pokemon.value.speciesId] : null))
const to = computed(() => gameData.species[props.to])
const name = computed(() => (pokemon.value ? displayNameOf(gameData, pokemon.value) : '?'))

const DURATION_MS = 5200
const showNew = ref(false)
const elapsed = ref(0)
let flicker: ReturnType<typeof setInterval> | null = null
let finish: ReturnType<typeof setTimeout> | null = null
let started = 0
let done = false

function end(accept: boolean) {
  if (done) return
  done = true
  if (flicker) clearInterval(flicker)
  if (finish) clearTimeout(finish)
  emit('resolve', accept)
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'x' || event.key === 'X' || event.key === 'b' || event.key === 'B' || event.key === 'Escape') {
    event.preventDefault()
    end(false)
  }
}

onMounted(() => {
  started = Date.now()
  window.addEventListener('keydown', onKey)
  // The flicker speeds up towards the end, like in the games.
  const step = () => {
    elapsed.value = Date.now() - started
    showNew.value = Math.floor((elapsed.value * elapsed.value) / 260000) % 2 === 1
  }
  flicker = setInterval(step, 90)
  finish = setTimeout(() => {
    audio.sfx('evolve')
    end(true)
  }, DURATION_MS)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  if (flicker) clearInterval(flicker)
  if (finish) clearTimeout(finish)
})
</script>

<template>
  <div class="modal" tabindex="-1">
    <div class="px-panel box">
      <h2 class="px-title">Vad? {{ name }} håller på att utvecklas!</h2>
      <div class="sprites">
        <img v-if="from && to" class="evo" :class="{ glow: showNew }" :src="showNew ? to.sprites.front : from.sprites.front" :alt="name" draggable="false">
      </div>
      <p>{{ name }} utvecklas till {{ to?.displayName }}...</p>
      <p class="hint">Tryck X, B eller Esc för att avbryta.</p>
      <div class="bar"><i :style="{ width: `${Math.min(100, (elapsed / 5200) * 100)}%` }" /></div>
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
.evo {
  transform: scale(1.6);
  transform-origin: bottom center;
  filter: brightness(1);
}

.evo.glow {
  filter: brightness(2.2) saturate(0.6);
}

.hint {
  margin: 0 0 8px;
  font-size: 13px;
  color: #dcc8a0;
}

.bar {
  height: 6px;
  background: #2a1c12;
}

.bar i {
  display: block;
  height: 100%;
  background: #ffd840;
}
</style>
