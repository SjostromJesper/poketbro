<script setup lang="ts">
import { onMounted } from 'vue'
import { BALANCE } from '~~/nudge/engine/balance'
import { useAudioStore } from '~/stores/nudge/audio'
import { useBattleStore } from '~/stores/nudge/battle'
import { useGameStore } from '~/stores/nudge/game'
import { useSettingsStore } from '~/stores/nudge/settings'

defineProps<{ allowDelete?: boolean }>()
const emit = defineEmits<{ (e: 'deleted'): void }>()

const settings = useSettingsStore()
const audio = useAudioStore()
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
    <label class="row check">
      <input v-model="settings.muted" type="checkbox">
      <span>Ljud av</span>
    </label>
    <label class="row slider">
      <span>Musik {{ Math.round(settings.musicVolume * 100) }}%</span>
      <input v-model.number="settings.musicVolume" type="range" min="0" max="1" step="0.05" :disabled="settings.muted">
    </label>
    <label class="row slider">
      <span>Ljudeffekter {{ Math.round(settings.sfxVolume * 100) }}%</span>
      <input v-model.number="settings.sfxVolume" type="range" min="0" max="1" step="0.05" :disabled="settings.muted" @change="audio.sfx('menuConfirm')">
    </label>
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

.slider input {
  width: 160px;
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
  color: #b8a07c;
}

.danger {
  align-self: flex-start;
  background: #8a2a2a;
}
</style>
