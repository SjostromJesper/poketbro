<script setup lang="ts">
// Picks the 3 Pokémon of an online team (PLAN-4 2.7) from the party and the box: only those that fit the bracket can be picked (the rest are greyed out with the reason),
// and the order they are picked in is the line-up, which can be changed with the arrows.
import { computed, ref } from 'vue'
import { gameData } from '~~/nudge/data'
import { displayNameOf } from '~~/nudge/engine/pokemon'
import { bracketLabel, TEAM_SIZE } from '~~/nudge/server/brackets'
import { eligibility, moveInSelection, toggleSelection } from '~~/nudge/game/network'
import { usePlayerStore } from '~/stores/nudge/player'

const props = defineProps<{ bracket: string, confirmLabel: string, busy?: boolean }>()
const emit = defineEmits<{ (e: 'confirm', uids: string[]): void, (e: 'back'): void }>()

const player = usePlayerStore()
const selection = ref<string[]>([])

const rows = computed(() => [
  ...player.party.map(p => ({ p, where: 'Lag' })),
  ...player.box.map(p => ({ p, where: 'Box' })),
].map(({ p, where }) => ({
  uid: p.uid, where, name: displayNameOf(gameData, p), level: p.level, icon: gameData.species[p.speciesId].sprites.icon, fit: eligibility(p, props.bracket),
  types: gameData.species[p.speciesId].types,
})))

const lineup = computed(() => selection.value.map(uid => rows.value.find(r => r.uid === uid)!).filter(Boolean))

function toggle(uid: string, ok: boolean) {
  if (ok) selection.value = toggleSelection(selection.value, uid)
}
</script>

<template>
  <div class="picker">
    <h3 class="px-title">Välj {{ TEAM_SIZE }} Pokémon: {{ bracketLabel(bracket) }}</h3>
    <p class="hint">Ordningen du väljer i är lagordningen. Pokémon som inte passar nivågränsen är gråade.</p>
    <div class="cols">
      <div class="list">
        <button
          v-for="r in rows" :key="r.uid" type="button" class="px-btn row" :class="{ picked: selection.includes(r.uid) }" :disabled="!r.fit.ok" :title="r.fit.reason"
          @click="toggle(r.uid, r.fit.ok)"
        >
          <img :src="r.icon" alt=""><span>{{ r.name }} Lv{{ r.level }}</span>
          <small>{{ r.fit.ok ? r.where : r.fit.reason }}</small>
        </button>
        <p v-if="rows.length === 0" class="hint">Du har inga Pokémon.</p>
      </div>
      <div class="lineup px-panel">
        <h4 class="px-title">Lagordning</h4>
        <ol>
          <li v-for="(r, i) in lineup" :key="r.uid">
            <img :src="r.icon" alt=""><span>{{ r.name }} Lv{{ r.level }}</span>
            <button type="button" class="px-btn small" :disabled="i === 0" aria-label="Flytta upp" @click="selection = moveInSelection(selection, i, -1)">▲</button>
            <button type="button" class="px-btn small" :disabled="i === lineup.length - 1" aria-label="Flytta ner" @click="selection = moveInSelection(selection, i, 1)">▼</button>
          </li>
        </ol>
        <p v-if="lineup.length < TEAM_SIZE" class="hint">Välj {{ TEAM_SIZE - lineup.length }} till.</p>
      </div>
    </div>
    <div class="buttons">
      <button type="button" class="px-btn" @click="emit('back')">Tillbaka</button>
      <button type="button" class="px-btn primary" :disabled="selection.length !== TEAM_SIZE || busy" @click="emit('confirm', selection)">{{ busy ? 'Skickar...' : confirmLabel }}</button>
    </div>
  </div>
</template>

<style scoped>
.picker { display: flex; flex-direction: column; gap: 8px; }
h3 { margin: 0; font-size: 11px; }
h4 { margin: 0 0 6px; font-size: 10px; color: #ffb84a; }
.hint { margin: 0; font-size: 13px; color: #dcc8a0; }
.cols { display: grid; grid-template-columns: 1.3fr 1fr; gap: 10px; }
.list { display: flex; flex-direction: column; gap: 4px; max-height: 300px; overflow: auto; }
.row { display: flex; align-items: center; gap: 8px; text-align: left; text-transform: none; }
.row img, .lineup img { width: 32px; height: 32px; image-rendering: pixelated; }
.row span { flex: 1; font-family: 'Pixelify Sans', monospace; font-size: 15px; }
.row small { font-family: 'Pixelify Sans', monospace; color: #dcc8a0; font-size: 12px; }
.row.picked { outline: 3px solid #ffd840; }
.row:disabled { opacity: 0.45; }
.lineup { padding: 8px 10px; }
ol { list-style: decimal; margin: 0; padding-left: 22px; display: flex; flex-direction: column; gap: 4px; }
li { display: flex; align-items: center; gap: 6px; }
li span { flex: 1; font-size: 15px; }
.buttons { display: flex; gap: 8px; justify-content: flex-end; }
</style>
