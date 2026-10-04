<script setup lang="ts">
import { onMounted } from 'vue'
import { BALANCE } from '~~/nudge/engine/balance'
import { useBattleStore } from '~/stores/nudge/battle'
import { useGameStore } from '~/stores/nudge/game'
import { useSettingsStore } from '~/stores/nudge/settings'

defineProps<{ allowDelete?: boolean }>()
const emit = defineEmits<{ (e: 'deleted'): void }>()

const settings = useSettingsStore()
const battle = useBattleStore()
const game = useGameStore()

onMounted(() => settings.load())

function deleteSave() {
  if (confirm('Radera sparfilen? Det går inte att ångra.')) {
    game.deleteSave()
    emit('deleted')
  }
}
</script>

<template>
  <div class="settings px-panel">
    <h3 class="px-title">Inställningar</h3>
    <div class="row">
      <span>Stridshastighet (standard)</span>
      <div class="speeds">
        <button
          v-for="s in BALANCE.SPEED_MULTIPLIERS" :key="s" type="button" class="px-btn small" :class="{ primary: settings.battleSpeed === s }"
          @click="settings.battleSpeed = s"
        >
          {{ s }}x
        </button>
      </div>
    </div>
    <label class="row check">
      <input v-model="battle.debug" type="checkbox">
      <span>Debug-overlay i strid (visar sannolikheterna för attackval)</span>
    </label>
    <p class="note">Ljud finns inte i den här prototypen.</p>
    <button v-if="allowDelete" type="button" class="px-btn danger" @click="deleteSave">Radera sparfil</button>
  </div>
</template>

<style scoped>
.settings {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 460px;
}

h3 {
  margin: 0;
  font-size: 11px;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.check {
  justify-content: flex-start;
  cursor: pointer;
}

.speeds {
  display: flex;
  gap: 6px;
}

.small {
  padding: 6px 10px;
}

.note {
  margin: 0;
  font-size: 13px;
  color: #6f86a8;
}

.danger {
  align-self: flex-start;
  background: #8a2a2a;
}
</style>
