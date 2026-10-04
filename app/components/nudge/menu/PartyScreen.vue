<script setup lang="ts">
import { ref } from 'vue'
import { gameData } from '~~/nudge/data'
import { BALANCE } from '~~/nudge/engine/balance'
import { displayNameOf, maxHpOf } from '~~/nudge/engine/pokemon'
import { itemInfo } from '~~/nudge/game/items'
import { usePlayerStore } from '~/stores/nudge/player'
import { hpColor, STATUS_LABELS } from '../ui'

defineEmits<{ (e: 'summary', uid: string): void, (e: 'back'): void }>()

const player = usePlayerStore()
const message = ref('')
const dragFrom = ref<number | null>(null)

function say(text: string | null) {
  if (text) message.value = text
}

function onDrop(to: number) {
  if (dragFrom.value !== null) player.moveParty(dragFrom.value, to)
  dragFrom.value = null
}

function trustLabel(trust: number) {
  const hearts = Math.max(0, Math.min(5, Math.ceil((trust / BALANCE.TRUST_MAX) * 5)))
  return '♥'.repeat(hearts) + '♡'.repeat(5 - hearts)
}
</script>

<template>
  <div class="screen">
    <h2 class="px-title">Ditt lag</h2>
    <p class="hint">Dra en Pokémon (eller använd pilarna) för att ändra ordning. Den första som kan slåss går in först i en strid, och nästa i ordningen tar över när den svimmar.</p>
    <ul class="list">
      <li
        v-for="(p, i) in player.party" :key="p.uid" class="row px-panel" :class="{ out: p.currentHp <= 0, dragging: dragFrom === i }"
        draggable="true" @dragstart="dragFrom = i" @dragover.prevent @drop="onDrop(i)" @dragend="dragFrom = null"
      >
        <span class="order">{{ i + 1 }}</span>
        <img :src="gameData.species[p.speciesId].sprites.icon" alt="" class="icon" draggable="false">
        <div class="info">
          <div class="top">
            <strong>{{ displayNameOf(gameData, p) }}</strong>
            <span class="lv">Lv{{ p.level }}</span>
            <span v-if="p.status" class="chip" :style="{ background: STATUS_LABELS[p.status].color }">{{ STATUS_LABELS[p.status].short }}</span>
            <span class="trait" :title="BALANCE.TRAITS[p.trait].description">{{ BALANCE.TRAITS[p.trait].label }}</span>
          </div>
          <div class="hp">
            <i class="bar"><b :style="{ width: `${(p.currentHp / maxHpOf(gameData, p)) * 100}%`, background: hpColor((p.currentHp / maxHpOf(gameData, p)) * 100) }" /></i>
            <span>{{ p.currentHp }}/{{ maxHpOf(gameData, p) }}</span>
          </div>
          <div class="meta">
            <span class="hearts" :title="`Förtroende ${p.trust}/255`">{{ trustLabel(p.trust) }}</span>
            <span class="held">
              <template v-if="p.heldItem">{{ itemInfo(gameData, p.heldItem).name }}
                <button type="button" class="link" @click="say(player.takeHeldItem(p.uid))">ta</button></template>
              <template v-else>ingen item</template>
            </span>
          </div>
        </div>
        <div class="actions">
          <button type="button" class="px-btn small" :disabled="i === 0" @click="player.moveParty(i, i - 1)">▲</button>
          <button type="button" class="px-btn small" :disabled="i === player.party.length - 1" @click="player.moveParty(i, i + 1)">▼</button>
          <button type="button" class="px-btn small" @click="$emit('summary', p.uid)">Info</button>
        </div>
      </li>
      <li v-if="player.party.length === 0" class="empty">Du har inga Pokémon ännu.</li>
    </ul>
    <p class="message">{{ message }}</p>
    <button type="button" class="px-btn" @click="$emit('back')">Tillbaka</button>
  </div>
</template>

<style scoped>
.screen {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
}

h2 {
  font-size: 12px;
  margin: 0;
}

.hint {
  margin: 0;
  font-size: 13px;
  color: #dcc8a0;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow: auto;
  flex: 1;
}

.row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  cursor: grab;
}

.row.out {
  opacity: 0.7;
}

.row.dragging {
  opacity: 0.4;
}

.order {
  font-family: 'Press Start 2P', monospace;
  font-size: 10px;
  color: #ffb84a;
  width: 14px;
}

.icon {
  width: 40px;
  height: 40px;
  image-rendering: pixelated;
}

.info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.top {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.lv {
  color: #ffd840;
  font-size: 13px;
}

.trait {
  margin-left: auto;
  font-size: 12px;
  color: #dcc8a0;
}

.chip {
  font-size: 11px;
  padding: 1px 5px;
  color: #2a1c12;
  border: 2px solid #2a1c12;
}

.hp {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #eadcb8;
}

.bar {
  flex: 1;
  max-width: 220px;
  height: 8px;
  background: #2a1c12;
}

.bar b {
  display: block;
  height: 100%;
}

.meta {
  display: flex;
  gap: 14px;
  font-size: 13px;
  color: #dcc8a0;
}

.hearts {
  color: #ff7a9a;
  letter-spacing: 1px;
}

.link {
  background: none;
  border: 0;
  color: #ffd070;
  font-family: inherit;
  cursor: pointer;
  text-decoration: underline;
}

.actions {
  display: flex;
  gap: 4px;
}

.small {
  padding: 6px 8px;
}

.empty {
  color: #dcc8a0;
}

.message {
  min-height: 20px;
  margin: 0;
  color: #8ef08e;
}
</style>
