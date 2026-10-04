<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { gameData } from '~~/nudge/data'
import { displayNameOf } from '~~/nudge/engine/pokemon'
import { usePlayerStore } from '~/stores/nudge/player'

const props = defineProps<{ uid: string, move: string, previous?: string }>()
const emit = defineEmits<{ (e: 'resolve'): void }>()

const player = usePlayerStore()
const pokemon = computed(() => player.findPokemon(props.uid))
const species = computed(() => (pokemon.value ? gameData.species[pokemon.value.speciesId] : null))
const name = computed(() => (pokemon.value ? displayNameOf(gameData, pokemon.value) : 'Pokémonen'))
const moveName = (id: string) => gameData.moves[id]?.displayName ?? id
const text = computed(() => (props.previous
  ? `${moveName(props.previous)} verkar inte vara ${name.value}s favorit längre... nu älskar den ${moveName(props.move)}!`
  : `${name.value} verkar verkligen gilla ${moveName(props.move)}!`))

function onKey(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ' ' || event.key === 'z' || event.key === 'Z' || event.key === 'Escape') {
    event.preventDefault()
    emit('resolve')
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="modal" @click="emit('resolve')">
    <div class="px-panel box">
      <div class="stage">
        <img v-if="species" :src="species.sprites.front" :alt="species.displayName" draggable="false">
        <span v-for="n in 5" :key="n" class="heart" :style="{ '--i': n }">♥</span>
      </div>
      <p>{{ text }}</p>
      <button type="button" class="px-btn primary" @click.stop="emit('resolve')">Fortsätt</button>
    </div>
  </div>
</template>

<style scoped>
.modal {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.6);
  z-index: 30;
}

.box {
  padding: 16px;
  width: min(480px, 94%);
  text-align: center;
}

.stage {
  position: relative;
  height: 130px;
  display: flex;
  justify-content: center;
  align-items: flex-end;
}

.stage img {
  image-rendering: pixelated;
  max-height: 100px;
  transform: scale(1.3);
  transform-origin: bottom center;
  animation: hop 0.8s ease-in-out infinite alternate;
}

.heart {
  position: absolute;
  bottom: 70px;
  left: calc(50% + (var(--i) - 3) * 22px);
  color: #ff5a7a;
  font-size: 22px;
  opacity: 0;
  text-shadow: 0 0 6px #ff9ab0;
  animation: float 1.8s ease-out infinite;
  animation-delay: calc(var(--i) * 0.25s);
}

p {
  margin: 8px 0 12px;
  font-size: 16px;
}

@keyframes hop {
  from { transform: scale(1.3) translateY(0); }
  to { transform: scale(1.3) translateY(-6px); }
}

@keyframes float {
  0% { opacity: 0; transform: translateY(0) scale(0.6); }
  20% { opacity: 1; }
  100% { opacity: 0; transform: translateY(-50px) scale(1.2); }
}
</style>
