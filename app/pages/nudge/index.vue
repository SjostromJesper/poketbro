<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from '#imports'
import { gameData } from '~~/nudge/data'
import type { SaveSummary } from '~~/nudge/game/save'
import NudgeFrame from '~/components/nudge/NudgeFrame.vue'
import SettingsPanel from '~/components/nudge/menu/SettingsPanel.vue'
import { useAudioStore } from '~/stores/nudge/audio'
import { useGameStore } from '~/stores/nudge/game'
import { useSettingsStore } from '~/stores/nudge/settings'

const router = useRouter()
const game = useGameStore()
const settings = useSettingsStore()
const audio = useAudioStore()

const audioReady = ref(false)
const summary = ref<SaveSummary | null>(null)
const showSettings = ref(false)
const starters = [1, 4, 7].map(id => gameData.species[id])

function onFirstInput() {
  audioReady.value = true
  window.removeEventListener('pointerdown', onFirstInput, true)
  window.removeEventListener('keydown', onFirstInput, true)
}

onMounted(() => {
  settings.load()
  audio.music('title')
  refresh()
  window.addEventListener('pointerdown', onFirstInput, true)
  window.addEventListener('keydown', onFirstInput, true)
})

onBeforeUnmount(onFirstInput)

function refresh() {
  summary.value = game.savedGame()
}

function continueGame() {
  router.push('/nudge/play?continue=1')
}

function newGame() {
  if (summary.value && !confirm('Du har en sparad resa. Starta nytt spel? Den gamla sparfilen skrivs över när du sparar nästa gång.')) return
  router.push('/nudge/play?new=1')
}

const savedAt = computed(() => (summary.value ? new Date(summary.value.savedAt).toLocaleString('sv-SE') : ''))
const leadIcon = computed(() => (summary.value?.leadSpeciesId ? gameData.species[summary.value.leadSpeciesId].sprites.icon : ''))
</script>

<template>
  <NudgeFrame>
    <main class="title">
      <div class="sprites" aria-hidden="true">
        <img v-for="(s, i) in starters" :key="s.id" :src="s.sprites.front" alt="" :style="{ animationDelay: `${i * 0.35}s` }">
      </div>
      <h1 class="px-title logo">NUDGE</h1>
      <p v-if="!audioReady" class="press">Tryck för att börja</p>
      <p class="sub">Pokémon som slåss av sig själva. Du viskar bara i örat.</p>

      <div class="buttons">
        <button v-if="summary" type="button" class="px-btn primary" @click="continueGame">Fortsätt</button>
        <button type="button" class="px-btn" :class="{ primary: !summary }" @click="newGame">Nytt spel</button>
        <button type="button" class="px-btn" @click="showSettings = !showSettings">Inställningar</button>
        <NuxtLink to="/nudge/credits" class="px-btn link">Tack till</NuxtLink>
        <NuxtLink to="/nudge/dev/battle" class="px-btn link">Teststrid</NuxtLink>
      </div>

      <div v-if="summary" class="save px-panel">
        <img v-if="leadIcon" :src="leadIcon" alt="" class="icon">
        <div>
          <strong>{{ summary.leadName ?? 'Ny resa' }}<template v-if="summary.leadLevel"> Lv{{ summary.leadLevel }}</template></strong>
          <div class="meta">{{ summary.placeName }} &middot; {{ summary.partySize }} Pokémon &middot; {{ summary.badges }} märke(n) &middot; {{ summary.money }} kr</div>
          <div class="meta">Sparad {{ savedAt }}</div>
        </div>
      </div>

      <SettingsPanel v-if="showSettings" allow-delete @deleted="refresh" />

      <p class="controls">
        Pilar/WASD: gå &middot; Shift: spring &middot; Mellanslag/Z/Enter: prata &middot; Esc/X: meny<br>
        I strid: klicka en attack (eller 1-4) för att nudga &middot; P: paus &middot; D: debug
      </p>
      <p class="credit">Privat prototyp. Pokémon-data och sprites från PokeAPI. <NuxtLink to="/nudge/credits">Tack till</NuxtLink></p>
    </main>
  </NudgeFrame>
</template>

<style scoped>
.title {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 24px 16px;
  text-align: center;
}

.sprites {
  display: flex;
  gap: 28px;
  height: 120px;
  align-items: flex-end;
}

.sprites img {
  image-rendering: pixelated;
  transform: scale(1.6);
  transform-origin: bottom center;
  animation: bob 1.4s ease-in-out infinite alternate;
}

.logo {
  margin: 8px 0 0;
  font-size: clamp(36px, 9vw, 72px);
  color: #ffd840;
  text-shadow: 4px 4px 0 #c8402c, 8px 8px 0 #2a1c12;
  letter-spacing: 0.08em;
}

.sub {
  margin: 0;
  color: #dcc8a0;
  font-size: 18px;
}

.buttons {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: min(280px, 90vw);
  margin-top: 10px;
}

.buttons .link {
  text-decoration: none;
  text-align: center;
  color: #fff4dc;
}

.save {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  text-align: left;
}

.save .icon {
  width: 48px;
  height: 48px;
  image-rendering: pixelated;
}

.meta {
  font-size: 14px;
  color: #dcc8a0;
}

.controls {
  margin: 8px 0 0;
  font-size: 14px;
  color: #b8a07c;
  line-height: 1.6;
}

.credit {
  margin: 0;
  font-size: 12px;
  color: #9a7a52;
}

@keyframes bob {
  from { translate: 0 0; }
  to { translate: 0 -8px; }
}
.press {
  margin: 0;
  font-family: 'Press Start 2P', monospace;
  font-size: 10px;
  color: #ffd840;
  animation: blink 1.2s steps(2) infinite;
}

@keyframes blink {
  50% { opacity: 0.2; }
}
</style>
