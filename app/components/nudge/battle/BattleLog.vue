<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { LogLine } from '~/stores/nudge/battle'

const props = defineProps<{ lines: LogLine[], visible?: number }>()
const shown = computed(() => props.lines.slice(-(props.visible ?? 5)))
const box = ref<HTMLElement | null>(null)

watch(() => props.lines.length, async () => {
  await nextTick()
  if (box.value) box.value.scrollTop = box.value.scrollHeight
})
</script>

<template>
  <div ref="box" class="log px-panel" aria-live="polite">
    <p v-for="line in shown" :key="line.id" :class="line.tone">{{ line.text }}</p>
    <p v-if="shown.length === 0" class="info">...</p>
  </div>
</template>

<style scoped>
.log {
  height: 136px;
  overflow: hidden;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 2px;
}

p {
  margin: 0;
  font-size: 16px;
}

.good { color: #8ef08e; }
.bad { color: #ff9a9a; }
.info { color: #9fb2cc; }
p:last-child { color: #ffffff; }
</style>
