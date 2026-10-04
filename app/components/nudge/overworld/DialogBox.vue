<script setup lang="ts">
import { computed } from 'vue'
import { faceUrl } from '~~/nudge/game/sprites'
import type { DialogState } from '~/stores/nudge/world'

const props = defineProps<{ dialog: DialogState }>()
defineEmits<{ (e: 'advance'): void }>()

const line = computed(() => props.dialog.lines[props.dialog.index] ?? '')
const visible = computed(() => line.value.slice(0, Math.floor(props.dialog.revealed)))
const done = computed(() => props.dialog.revealed >= line.value.length)
</script>

<template>
  <div class="dialog" role="dialog" @click="$emit('advance')">
    <div v-if="dialog.speaker" class="speaker px-title">{{ dialog.speaker }}</div>
    <img v-if="dialog.portrait" class="face" :src="faceUrl(dialog.portrait)" alt="" draggable="false">
    <p class="text" :class="{ withFace: !!dialog.portrait }">{{ visible }}<span v-if="done" class="more">▼</span></p>
  </div>
</template>

<style scoped>
.dialog {
  position: absolute;
  left: 3%;
  right: 3%;
  bottom: 4%;
  min-height: 92px;
  padding: 14px 18px;
  background: #f8ecd0;
  color: #2a1c12;
  border: 4px solid #2a1c12;
  box-shadow: inset 0 0 0 3px #c8b088, 4px 4px 0 rgba(0, 0, 0, 0.4);
  cursor: pointer;
  z-index: 5;
}

.speaker {
  position: absolute;
  top: -16px;
  left: 14px;
  font-size: 10px;
  padding: 5px 8px;
  background: #2a1c12;
  color: #ffd840;
}

.face {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  width: 76px;
  height: 76px;
  image-rendering: pixelated;
  background: #2a1c12;
  border: 3px solid #2a1c12;
  box-shadow: 0 0 0 2px #c8b088;
}

.text.withFace {
  padding-left: 92px;
}

.text {
  margin: 0;
  font-size: 20px;
  line-height: 1.45;
  min-height: 58px;
}

.more {
  position: absolute;
  right: 14px;
  bottom: 8px;
  animation: bounce 0.7s steps(2) infinite;
}

@keyframes bounce {
  50% { transform: translateY(3px); }
}
</style>
