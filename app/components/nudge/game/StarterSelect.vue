<script setup lang="ts">
import { computed } from 'vue'
import { gameData } from '~~/nudge/data'
import { BALANCE, type TraitId } from '~~/nudge/engine/balance'
import { createPokemon } from '~~/nudge/engine/pokemon'
import { createRng } from '~~/nudge/engine/rng'
import { STARTERS, STARTER_LEVEL } from '~~/nudge/game/items'
import { buildSummary } from '~~/nudge/game/summary'
import { useGameStore } from '~/stores/nudge/game'
import { usePlayerStore } from '~/stores/nudge/player'
import { TYPE_COLORS, TYPE_LABELS } from '../ui'

defineEmits<{ (e: 'choose', speciesId: number): void }>()
const player = usePlayerStore()
useGameStore().rollStarters()

// The nature and trait are rolled when the lab is entered (kept in the save), so the choice is a personal one.
const options = computed(() => STARTERS.map((s) => {
  const roll = player.starterRolls[s.speciesId]
  const species = gameData.species[s.speciesId]
  const mon = roll
    ? createPokemon({ data: gameData, balance: BALANCE, rng: createRng(s.speciesId), speciesId: s.speciesId, level: STARTER_LEVEL, trust: BALANCE.TRUST_START_STARTER, nature: roll.nature, trait: roll.trait as TraitId })
    : null
  const summary = mon ? buildSummary(gameData, BALANCE, mon) : null
  return { ...s, species, trait: summary?.trait, nature: summary?.nature }
}))
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
          <span v-if="o.trait" class="personal">
            <b>Drag: {{ o.trait.label }}</b>
            <small>{{ o.trait.description }}</small>
            <b>Natur: {{ o.nature?.label }}</b>
            <small>{{ o.nature?.text }}</small>
          </span>
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
  overflow: auto;
}

.box {
  padding: 16px;
  width: min(900px, 96%);
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
  color: #fff4dc;
  font-family: inherit;
  background: #5a4330;
  border: 3px solid #2a1c12;
  box-shadow: inset 0 0 0 2px #8a6a44;
  cursor: pointer;
}

.card:hover {
  background: #6e5238;
  box-shadow: inset 0 0 0 2px #ffd840;
}

.card img {
  height: 80px;
  image-rendering: pixelated;
  object-fit: contain;
  transform: scale(1.2);
  margin: 6px 0;
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
  color: #2a1c12;
  border: 2px solid #2a1c12;
}

.blurb {
  font-size: 14px;
  color: #dcc8a0;
  text-align: center;
}

.personal {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 4px;
  padding: 6px;
  width: 100%;
  background: rgba(0, 0, 0, 0.25);
  text-align: left;
  font-size: 13px;
}

.personal b {
  color: #ffd840;
}

.personal small {
  color: #dcc8a0;
  font-size: 12px;
  margin-bottom: 4px;
}
</style>
