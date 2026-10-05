<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { gameData } from '~~/nudge/data'
import { displayNameOf } from '~~/nudge/engine/pokemon'
import { usePlayerStore } from '~/stores/nudge/player'
import { TYPE_COLORS, TYPE_LABELS } from '../ui'

const props = defineProps<{ uid: string, move: string }>()
const emit = defineEmits<{ (e: 'resolve', replaceIndex: number | null): void }>()

const player = usePlayerStore()
const pokemon = computed(() => player.findPokemon(props.uid))
const newMove = computed(() => gameData.moves[props.move])
const name = computed(() => (pokemon.value ? displayNameOf(gameData, pokemon.value) : '?'))
/** Index of the favorite move the player is about to forget (needs a second confirmation). */
const confirming = ref<number | null>(null)
const favoriteName = computed(() => (pokemon.value?.favoriteMove ? gameData.moves[pokemon.value.favoriteMove]?.displayName : null))

function choose(index: number) {
  const move = pokemon.value?.moves[index]?.move
  if (move && move === pokemon.value?.favoriteMove) confirming.value = index
  else emit('resolve', index)
}
/** Highlighted choice: 0-3 are the known moves, 4 is "do not learn". Arrows and 1-4 select, Space/Enter confirm. */
const selected = ref(0)
/** Ignore presses right after the dialog opens, so the key that closed the text before it cannot choose for you. */
let openedAt = 0

function onKey(event: KeyboardEvent) {
  if (event.repeat) return
  const count = current.value.length
  if (event.key === 'ArrowDown') selected.value = (selected.value + 1) % (count + 1)
  else if (event.key === 'ArrowUp') selected.value = (selected.value + count) % (count + 1)
  else if (/^[1-9]$/.test(event.key) && Number(event.key) <= count) selected.value = Number(event.key) - 1
  else if (event.key === 'Escape' || event.key === 'x' || event.key === 'X') {
    if (confirming.value !== null) confirming.value = null
    else emit('resolve', null)
  } else if (event.key === ' ' || event.key === 'Enter' || event.key === 'z' || event.key === 'Z') {
    if (Date.now() - openedAt < 300) return
    if (confirming.value !== null) emit('resolve', confirming.value)
    else if (selected.value >= count) emit('resolve', null)
    else choose(selected.value)
  } else return
  event.preventDefault()
}

onMounted(() => {
  openedAt = Date.now()
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

const current = computed(() => (pokemon.value?.moves ?? []).map((m, index) => ({ index, id: m.move, data: gameData.moves[m.move], pp: m.pp, maxPp: m.maxPp })))
</script>

<template>
  <div class="modal">
    <div class="px-panel box">
      <h2 class="px-title">{{ name }} vill lära sig en ny attack!</h2>
      <div class="new" :style="{ '--type': TYPE_COLORS[newMove.type] }">
        <strong>{{ newMove.displayName }}</strong>
        <span>{{ TYPE_LABELS[newMove.type] }} &middot; Kraft {{ newMove.power ?? '-' }} &middot; Träff {{ newMove.accuracy ?? '-' }} &middot; PP {{ newMove.pp }}</span>
      </div>
      <template v-if="confirming !== null">
        <p class="warn">♥ {{ name }} älskar {{ favoriteName }}. Är du säker?</p>
        <p class="ask">Förtroendet sjunker lite och {{ name }} får ingen ny favorit på ett tag.</p>
        <button type="button" class="px-btn" @click="emit('resolve', confirming)">Ja, glöm {{ favoriteName }}</button>
        <button type="button" class="px-btn primary" @click="confirming = null">Nej, tillbaka</button>
      </template>
      <template v-else>
      <p class="ask">Men {{ name }} kan bara kunna fyra attacker. Vilken ska glömmas?</p>
      <button v-for="m in current" :key="m.index" type="button" class="px-btn row" :class="{ picked: selected === m.index }" :style="{ '--type': TYPE_COLORS[m.data.type] }" @click="choose(m.index)" @mouseenter="selected = m.index">
        <span class="swatch" />
        <span class="mname">Glöm {{ m.data.displayName }}<span v-if="m.id === pokemon?.favoriteMove" class="heart"> ♥</span></span>
        <span class="mmeta">{{ TYPE_LABELS[m.data.type] }} &middot; Kraft {{ m.data.power ?? '-' }} &middot; PP {{ m.pp }}/{{ m.maxPp }}</span>
      </button>
      <button type="button" class="px-btn" :class="{ picked: selected === current.length }" @click="emit('resolve', null)" @mouseenter="selected = current.length">Lär sig inte {{ newMove.displayName }}</button>
      <p class="hint">Piltangenter eller 1-4 väljer, mellanslag bekräftar, X hoppar över.</p>
      </template>
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
  width: min(520px, 94%);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

h2 {
  font-size: 11px;
  line-height: 1.5;
  margin: 0;
}

.new {
  padding: 8px 10px;
  border-left: 8px solid var(--type);
  background: #5a4330;
  display: flex;
  flex-direction: column;
}

.new span {
  font-size: 14px;
  color: #eadcb8;
}

.ask {
  margin: 0;
  color: #eadcb8;
}

.row {
  display: flex;
  align-items: center;
  gap: 10px;
  text-align: left;
  text-transform: none;
}

.swatch {
  width: 10px;
  height: 18px;
  background: var(--type);
}

.mname {
  flex: 1;
  font-family: 'Pixelify Sans', monospace;
  font-size: 15px;
}

.mmeta {
  font-family: 'Pixelify Sans', monospace;
  font-size: 13px;
  color: #dcc8a0;
}
.warn {
  margin: 0;
  color: #ff9ab0;
  font-size: 16px;
}

.heart {
  color: #ff6f8e;
}
.px-btn.picked {
  outline: 3px solid #ffd840;
  outline-offset: -3px;
}

.hint {
  margin: 0;
  font-size: 13px;
  color: #dcc8a0;
}
</style>
