<script setup lang="ts">
import { computed, ref } from 'vue'
import { gameData } from '~~/nudge/data'
import { usePlayerStore } from '~/stores/nudge/player'

const props = defineProps<{ uid: string }>()
const emit = defineEmits<{ (e: 'resolve', nickname: string | null): void }>()

const player = usePlayerStore()
const pokemon = computed(() => player.findPokemon(props.uid))
const species = computed(() => (pokemon.value ? gameData.species[pokemon.value.speciesId] : null))
const text = ref('')
</script>

<template>
  <div class="modal">
    <form class="px-panel box" @submit.prevent="emit('resolve', text.trim() || null)">
      <img v-if="species" :src="species.sprites.front" :alt="species.displayName" draggable="false">
      <h2 class="px-title">Vill du ge {{ species?.displayName }} ett smeknamn?</h2>
      <input v-model="text" type="text" maxlength="12" :placeholder="species?.displayName" autofocus>
      <div class="actions">
        <button type="submit" class="px-btn primary" :disabled="!text.trim()">Spara namn</button>
        <button type="button" class="px-btn" @click="emit('resolve', null)">Hoppa över</button>
      </div>
    </form>
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
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  width: min(420px, 94%);
}

img {
  height: 80px;
  image-rendering: pixelated;
  transform: scale(1.3);
}

h2 {
  font-size: 11px;
  line-height: 1.5;
  text-align: center;
  margin: 6px 0 0;
}

input {
  width: 100%;
  background: #0a0f16;
  color: #eef2f7;
  border: 2px solid #35496a;
  font-family: inherit;
  font-size: 18px;
  padding: 6px 8px;
  text-align: center;
}

.actions {
  display: flex;
  gap: 8px;
}
</style>
