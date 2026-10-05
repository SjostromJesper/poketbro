<script setup lang="ts">
// "Professorns anteckningar": the explanations unlocked so far (locked ones are shown as "???").
import { computed, ref } from 'vue'
import { NOTES } from '~~/nudge/game/text/notes'
import { usePlayerStore } from '~/stores/nudge/player'

defineEmits<{ (e: 'back'): void }>()
const player = usePlayerStore()
const open = ref<string | null>(null)
const unlocked = computed(() => new Set(player.notes))
const current = computed(() => NOTES.find(n => n.id === open.value && unlocked.value.has(n.id)) ?? null)
</script>

<template>
  <div class="notes">
    <h3 class="px-title">Professorns anteckningar</h3>
    <div class="body">
      <ul class="list">
        <li v-for="n in NOTES" :key="n.id">
          <button type="button" class="px-btn" :class="{ primary: open === n.id }" :disabled="!unlocked.has(n.id)" @click="open = n.id">
            {{ unlocked.has(n.id) ? n.title : '???' }}
          </button>
        </li>
      </ul>
      <div class="text px-panel">
        <template v-if="current">
          <h4 class="px-title">{{ current.title }}</h4>
          <p v-for="line in current.lines" :key="line">{{ line }}</p>
        </template>
        <p v-else class="hint">Välj ett avsnitt. Nya avsnitt låses upp när spelet förklarar dem.</p>
      </div>
    </div>
    <button type="button" class="px-btn" @click="$emit('back')">Tillbaka</button>
  </div>
</template>

<style scoped>
.notes {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
}

h3 {
  margin: 0;
  font-size: 12px;
}

.body {
  display: flex;
  gap: 12px;
  flex: 1;
  min-height: 0;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 210px;
}

.list .px-btn {
  width: 100%;
  text-align: left;
}

.text {
  flex: 1;
  padding: 12px 14px;
  overflow: auto;
}

h4 {
  margin: 0 0 8px;
  font-size: 11px;
  color: #ffd840;
}

p {
  margin: 0 0 10px;
  font-size: 17px;
  line-height: 1.4;
}

.hint {
  color: #b8a07c;
}
</style>
