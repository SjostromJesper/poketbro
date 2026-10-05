<script setup lang="ts">
import { computed } from 'vue'
import { getMap } from '~~/nudge/game/maps'
import { useWorldStore } from '~/stores/nudge/world'

defineEmits<{ (e: 'travel', mapId: string): void, (e: 'close'): void }>()
const world = useWorldStore()
const places = computed(() => (world.world?.state.visitedCenters ?? [])
  .filter(c => c.mapId !== world.world?.state.mapId)
  .map(c => ({ mapId: c.mapId, name: getMap(c.mapId).name })))
</script>

<template>
  <div class="modal">
    <div class="px-panel box">
      <h2 class="px-title">Snabbresa</h2>
      <p>Vart vill du åka? Du hamnar utanför stadens Pokémon Center.</p>
      <button v-for="p in places" :key="p.mapId" type="button" class="px-btn" @click="$emit('travel', p.mapId)">{{ p.name }}</button>
      <button type="button" class="px-btn" data-sound="cancel" @click="$emit('close')">Stanna kvar</button>
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
  padding: 16px;
  width: min(420px, 94%);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

h2 {
  font-size: 11px;
  margin: 0;
}

p {
  margin: 0;
  color: #eadcb8;
}
</style>
