<script setup lang="ts">
import { ref } from 'vue'
import { gameData } from '~~/nudge/data'
import { displayNameOf, maxHpOf } from '~~/nudge/engine/pokemon'
import { MAX_PARTY, usePlayerStore } from '~/stores/nudge/player'

defineEmits<{ (e: 'close'): void }>()
const player = usePlayerStore()
const message = ref('')
const row = (p: (typeof player.party)[number]) => ({
  uid: p.uid, name: displayNameOf(gameData, p), level: p.level, icon: gameData.species[p.speciesId].sprites.icon,
  hp: p.currentHp, max: maxHpOf(gameData, p),
})
</script>

<template>
  <div class="modal">
    <div class="px-panel box">
      <h2 class="px-title">Pokémon-lagring</h2>
      <p class="hint">Klicka på en Pokémon för att flytta den. Laget har plats för {{ MAX_PARTY }}.</p>
      <div class="cols">
        <section>
          <h3 class="px-title">Lag ({{ player.party.length }}/{{ MAX_PARTY }})</h3>
          <button v-for="p in player.party.map(row)" :key="p.uid" type="button" class="px-btn item" @click="message = player.moveToBox(p.uid) ?? ''">
            <img :src="p.icon" alt=""><span>{{ p.name }} Lv{{ p.level }}</span><small>{{ p.hp }}/{{ p.max }}</small>
          </button>
        </section>
        <section>
          <h3 class="px-title">Box ({{ player.box.length }})</h3>
          <button v-for="p in player.box.map(row)" :key="p.uid" type="button" class="px-btn item" @click="message = player.moveToParty(p.uid) ?? ''">
            <img :src="p.icon" alt=""><span>{{ p.name }} Lv{{ p.level }}</span><small>{{ p.hp }}/{{ p.max }}</small>
          </button>
          <p v-if="player.box.length === 0" class="hint">Boxen är tom. Fångade Pokémon som inte får plats i laget hamnar här.</p>
        </section>
      </div>
      <p class="message">{{ message }}</p>
      <button type="button" class="px-btn" @click="$emit('close')">Logga ut</button>
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
  width: min(720px, 96%);
  max-height: 94%;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: auto;
}

h2 { font-size: 12px; margin: 0; }
h3 { font-size: 10px; margin: 0 0 6px; color: #ffb84a; }
.hint { margin: 0; font-size: 13px; color: #9fb2cc; }

.cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.item {
  display: flex;
  align-items: center;
  gap: 8px;
  text-align: left;
  text-transform: none;
}

.item img { width: 32px; height: 32px; image-rendering: pixelated; }
.item span { flex: 1; font-family: 'Pixelify Sans', monospace; font-size: 15px; }
.item small { font-family: 'Pixelify Sans', monospace; color: #9fb2cc; }
.message { margin: 0; min-height: 20px; color: #8ef08e; }
</style>
