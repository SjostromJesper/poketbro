<script setup lang="ts">
import { computed } from 'vue'
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
    <p class="text">{{ visible }}<span v-if="done" class="more">▼</span></p>
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
  background: #f4f4ec;
  color: #1a2030;
  border: 4px solid #1a2030;
  box-shadow: inset 0 0 0 3px #8fa0c0, 4px 4px 0 rgba(0, 0, 0, 0.4);
  cursor: pointer;
  z-index: 5;
}

.speaker {
  position: absolute;
  top: -16px;
  left: 14px;
  font-size: 10px;
  padding: 5px 8px;
  background: #1a2030;
  color: #ffd840;
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
