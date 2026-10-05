<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from '#imports'
import { gameData } from '~~/nudge/data'
import { SLOTS, type Slot } from '~~/nudge/game/saveSlots'
import NudgeFrame from '~/components/nudge/NudgeFrame.vue'
import SettingsPanel from '~/components/nudge/menu/SettingsPanel.vue'
import { useAudioStore } from '~/stores/nudge/audio'
import { useSavesStore } from '~/stores/nudge/saves'
import { useSettingsStore } from '~/stores/nudge/settings'

const router = useRouter()
const settings = useSettingsStore()
const audio = useAudioStore()
const saves = useSavesStore()
const supabase = useSupabaseClient()

const audioReady = ref(false)
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
  saves.init()
  void saves.connect(supabase)
  window.addEventListener('pointerdown', onFirstInput, true)
  window.addEventListener('keydown', onFirstInput, true)
})

onBeforeUnmount(onFirstInput)

function continueGame(slot: Slot) {
  saves.setActive(slot)
  router.push(`/nudge/play?continue=1&slot=${slot}`)
}

function newGame(slot: Slot) {
  if (saves.slots[slot - 1] && !confirm(`Plats ${slot} har en sparad resa. Starta ett nytt spel där? Den gamla sparfilen skrivs över.`)) return
  saves.setActive(slot)
  router.push(`/nudge/play?new=1&slot=${slot}`)
}

function deleteSlot(slot: Slot) {
  if (confirm(`Radera sparplats ${slot}? Det går inte att ångra (och den tas bort från molnet).`)) void saves.remove(slot)
}

const when = (ms: number) => new Date(ms).toLocaleString('sv-SE')
const playTime = (ms: number) => `${Math.floor(ms / 3_600_000)} h ${Math.floor((ms % 3_600_000) / 60_000)} min`
const icon = (speciesId: number) => gameData.species[speciesId]?.sprites.icon ?? ''
const syncText = (dirty: boolean) => (saves.account.kind === 'unavailable' ? 'bara här' : dirty ? 'ej synkad' : 'synkad')
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

      <div class="slots">
        <div v-for="slot in SLOTS" :key="slot" class="slot px-panel" :class="{ empty: !saves.slots[slot - 1] }">
          <template v-if="saves.slots[slot - 1]">
            <div class="head">
              <strong>Plats {{ slot }}: {{ saves.slots[slot - 1]!.summary.playerName }}</strong>
              <span class="sync" :class="{ off: saves.slots[slot - 1]!.dirty || saves.account.kind === 'unavailable' }">☁ {{ syncText(saves.slots[slot - 1]!.dirty) }}</span>
            </div>
            <div class="party">
              <img v-for="(id, i) in saves.slots[slot - 1]!.summary.partyIcons" :key="i" :src="icon(id)" alt="">
            </div>
            <div class="meta">
              {{ saves.slots[slot - 1]!.summary.placeName }} &middot; {{ saves.slots[slot - 1]!.summary.badges }} märke(n) &middot;
              {{ playTime(saves.slots[slot - 1]!.summary.playTimeMs) }} &middot; {{ saves.slots[slot - 1]!.summary.money }} kr
            </div>
            <div class="meta">Sparad {{ when(saves.slots[slot - 1]!.summary.savedAt) }}</div>
            <div class="actions">
              <button type="button" class="px-btn primary" @click="continueGame(slot)">Fortsätt</button>
              <button type="button" class="px-btn" @click="newGame(slot)">Nytt spel</button>
              <button type="button" class="px-btn danger" @click="deleteSlot(slot)">Radera</button>
            </div>
          </template>
          <template v-else>
            <div class="head"><strong>Plats {{ slot }}</strong><span class="sync off">tom</span></div>
            <div class="actions">
              <button type="button" class="px-btn primary" @click="newGame(slot)">Nytt spel</button>
            </div>
          </template>
        </div>
      </div>

      <div class="buttons">
        <button type="button" class="px-btn" @click="showSettings = !showSettings">Inställningar</button>
        <NuxtLink to="/nudge/credits" class="px-btn link">Tack till</NuxtLink>
        <NuxtLink to="/nudge/dev/battle" class="px-btn link">Teststrid</NuxtLink>
      </div>

      <SettingsPanel v-if="showSettings" />

      <div v-if="saves.conflicts.length" class="conflict">
        <div class="px-panel box">
          <h2 class="px-title">Olika sparfiler</h2>
          <p>Plats {{ saves.conflicts[0].slot }} har ändrats både här och i molnet sedan sist. Vilken vill du använda?</p>
          <div class="choice">
            <div>
              <h3>Den här webbläsaren</h3>
              <p>{{ saves.conflicts[0].local.leadName }} Lv{{ saves.conflicts[0].local.leadLevel }} &middot; {{ saves.conflicts[0].local.badges }} märke(n)</p>
              <p>{{ saves.conflicts[0].local.placeName }} &middot; {{ playTime(saves.conflicts[0].local.playTimeMs) }}</p>
              <p>Sparad {{ when(saves.conflicts[0].local.savedAt) }}</p>
              <button type="button" class="px-btn primary" @click="saves.resolveConflict(saves.conflicts[0].slot, 'local')">Använd den här</button>
            </div>
            <div>
              <h3>Molnet</h3>
              <p>{{ saves.conflicts[0].cloud.leadName }} Lv{{ saves.conflicts[0].cloud.leadLevel }} &middot; {{ saves.conflicts[0].cloud.badges }} märke(n)</p>
              <p>{{ saves.conflicts[0].cloud.placeName }} &middot; {{ playTime(saves.conflicts[0].cloud.playTimeMs) }}</p>
              <p>Sparad {{ when(saves.conflicts[0].cloud.savedAt) }}</p>
              <button type="button" class="px-btn" @click="saves.resolveConflict(saves.conflicts[0].slot, 'cloud')">Använd molnets</button>
            </div>
          </div>
        </div>
      </div>

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

.slots {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: min(520px, 94vw);
}

.slot {
  padding: 10px 14px;
  text-align: left;
}

.slot .head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
}

.sync {
  font-size: 13px;
  color: #8ef08e;
}

.sync.off {
  color: #ffb84a;
}

.party {
  display: flex;
  gap: 2px;
  margin: 4px 0;
}

.party img {
  width: 40px;
  height: 40px;
  image-rendering: pixelated;
}

.actions {
  display: flex;
  gap: 6px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.conflict {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.7);
  z-index: 40;
}

.conflict .box {
  width: min(640px, 94vw);
  padding: 16px;
  text-align: left;
}

.conflict h2 {
  font-size: 12px;
  margin: 0 0 8px;
}

.conflict h3 {
  font-size: 10px;
  margin: 0 0 6px;
  color: #ffd840;
  font-family: 'Press Start 2P', monospace;
}

.conflict p {
  margin: 0 0 4px;
}

.choice {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
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
