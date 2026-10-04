<script setup lang="ts">
import type { MoveView } from '~~/nudge/game/battleView'
import { TYPE_COLORS, TYPE_LABELS } from '../ui'

defineProps<{ move: MoveView, hotkey: number, disabled?: boolean }>()
defineEmits<{ (e: 'nudge'): void }>()
</script>

<template>
  <button
    type="button"
    class="move"
    data-sound="none"
    :class="{ pending: move.pending, empty: !move.usable, favorite: move.favorite }"
    :style="{ '--type': TYPE_COLORS[move.type] }"
    :disabled="!move.usable || disabled"
    :title="move.pending ? 'Nudge väntar - gäller nästa val' : move.favorite ? 'Favoritattack: nudgen är gratis' : 'Klicka för att nudga'"
    @click="$emit('nudge')"
  >
    <span class="key">{{ hotkey }}</span>
    <span class="body">
      <span class="name">{{ move.name }}<span v-if="move.favorite" class="heart"> ♥</span></span>
      <span class="meta">
        <span class="type">{{ TYPE_LABELS[move.type] }}</span>
        <span class="pp">PP {{ move.pp }}/{{ move.maxPp }}</span>
        <span v-if="move.favorite" class="free">gratis nudge</span>
      </span>
    </span>
    <span v-if="move.pending" class="flag">♪</span>
  </button>
</template>

<style scoped>
.move {
  display: flex;
  align-items: center;
  gap: 8px;
  text-align: left;
  width: 100%;
  padding: 6px 8px 6px 0;
  color: #eef2f7;
  font-family: inherit;
  font-size: 16px;
  background: #1f2d44;
  border: 3px solid #0a0f16;
  border-left: 0;
  box-shadow: inset 0 0 0 2px #35496a;
  cursor: pointer;
  position: relative;
}

.move:hover:not(:disabled) {
  background: #2a3d5c;
}

.move:active:not(:disabled) {
  transform: translateY(2px);
}

.key {
  align-self: stretch;
  display: grid;
  place-items: center;
  width: 28px;
  background: var(--type);
  color: #0a0f16;
  font-family: 'Press Start 2P', monospace;
  font-size: 10px;
  border-right: 3px solid #0a0f16;
}

.body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.name {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.meta {
  display: flex;
  gap: 8px;
  font-size: 13px;
  color: #9fb2cc;
}

.type {
  color: var(--type);
  filter: brightness(1.15);
}

.pending {
  background: #3a3418;
  box-shadow: inset 0 0 0 2px #ffd840, 0 0 10px rgba(255, 216, 64, 0.7);
  animation: glow 0.9s ease-in-out infinite alternate;
}

.flag {
  position: absolute;
  right: 8px;
  top: 4px;
  color: #ffd840;
  font-size: 18px;
}

.move:disabled:not(.empty) {
  opacity: 0.55;
  cursor: not-allowed;
}

.empty {
  opacity: 0.4;
  cursor: not-allowed;
}

@keyframes glow {
  from { box-shadow: inset 0 0 0 2px #ffd840, 0 0 4px rgba(255, 216, 64, 0.4); }
  to { box-shadow: inset 0 0 0 2px #ffd840, 0 0 12px rgba(255, 216, 64, 0.9); }
}
.heart {
  color: #ff6f8e;
}

.free {
  color: #ff9ab0;
}

.move.favorite {
  box-shadow: inset 0 0 0 2px #7a3a56;
}
</style>
