<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from '#imports'
import { useGameStore } from '~/stores/nudge/game'
import { usePlayerStore } from '~/stores/nudge/player'
import { useWorldStore } from '~/stores/nudge/world'
import BagScreen from './BagScreen.vue'
import SettingsPanel from './SettingsPanel.vue'
import PartyScreen from './PartyScreen.vue'
import SummaryScreen from './SummaryScreen.vue'

type Screen = 'main' | 'party' | 'summary' | 'bag' | 'settings'

const props = withDefaults(defineProps<{
  /** Which screen to open first (dev shortcut). */
  initialScreen?: Screen
}>(), { initialScreen: 'main' })

const world = useWorldStore()
const player = usePlayerStore()
const game = useGameStore()
const router = useRouter()
const screen = ref<Screen>(props.initialScreen)
const summaryUid = ref(props.initialScreen === 'summary' ? (player.party[0]?.uid ?? '') : '')

function back(): boolean {
  if (screen.value === 'summary') {
    screen.value = 'party'
    return true
  }
  if (screen.value !== 'main') {
    screen.value = 'main'
    return true
  }
  return false
}

function toTitle() {
  game.save(true)
  world.closeMenu()
  router.push('/nudge')
}

function openSummary(uid: string) {
  summaryUid.value = uid
  screen.value = 'summary'
}

onMounted(() => world.setMenuBack(back))
onBeforeUnmount(() => world.setMenuBack(null))
</script>

<template>
  <div class="menu-root">
    <div v-if="screen === 'main'" class="main px-panel">
      <h3 class="px-title">Meny</h3>
      <button type="button" class="px-btn" @click="screen = 'party'">Lag</button>
      <button type="button" class="px-btn" @click="screen = 'bag'">Väska</button>
      <button type="button" class="px-btn" :disabled="!player.party.length" @click="game.save()">Spara</button>
      <button type="button" class="px-btn" @click="screen = 'settings'">Inställningar</button>
      <button type="button" class="px-btn" @click="toTitle">Titelskärm</button>
      <button type="button" class="px-btn primary" @click="world.closeMenu()">Stäng</button>
    </div>
    <div v-else class="full px-panel">
      <PartyScreen v-if="screen === 'party'" @summary="openSummary" @back="screen = 'main'" />
      <SummaryScreen v-else-if="screen === 'summary'" :uid="summaryUid" @select="summaryUid = $event" @back="screen = 'party'" />
      <BagScreen v-else-if="screen === 'bag'" @back="screen = 'main'" />
      <div v-else-if="screen === 'settings'" class="settings-screen">
        <SettingsPanel />
        <button type="button" class="px-btn" @click="screen = 'main'">Tillbaka</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.menu-root {
  position: absolute;
  inset: 0;
  z-index: 20;
  pointer-events: none;
}

.menu-root > * {
  pointer-events: auto;
}

.main {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 210px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.main h3 {
  margin: 0 0 4px;
  font-size: 11px;
}

.settings-screen {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: flex-start;
}

.full {
  position: absolute;
  inset: 6px;
  padding: 12px;
  background: #121b29;
  overflow: hidden;
}
</style>
