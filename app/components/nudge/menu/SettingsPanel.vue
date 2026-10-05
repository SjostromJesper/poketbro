<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { BALANCE } from '~~/nudge/engine/balance'
import { THEME_IDS, THEMES } from '~~/nudge/game/themes'
import { useAudioStore } from '~/stores/nudge/audio'
import { useBattleStore } from '~/stores/nudge/battle'
import { useSavesStore } from '~/stores/nudge/saves'
import { useSettingsStore } from '~/stores/nudge/settings'


const settings = useSettingsStore()
const audio = useAudioStore()
const saves = useSavesStore()
const email = ref('')
const emailMessage = ref('')

const cloudText = computed(() => {
  const a = saves.account
  if (a.kind === 'unavailable') return `Sparar bara i den här webbläsaren (${a.reason}).`
  if (a.kind === 'unknown') return 'Ansluter...'
  const who = a.kind === 'account' ? `Inloggad som ${a.email}.` : 'Du spelar utan konto (anonym).'
  const state = saves.state === 'synced' ? 'Allt är synkat.' : saves.state === 'pending' ? 'Väntar på att synka...' : saves.state === 'conflict' ? 'Olika sparfiler väntar på ditt val.' : saves.state === 'error' ? `Kunde inte synka just nu (${saves.error}), försöker igen.` : ''
  return `${who} ${state}`
})

async function linkEmail() {
  emailMessage.value = await saves.linkEmail(email.value)
}

async function signIn() {
  emailMessage.value = await saves.signInWithEmail(email.value)
}
const battle = useBattleStore()

onMounted(() => settings.load())

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
    <div class="themes">
      <span>Grafiktema</span>
      <div class="theme-list">
        <button
          v-for="t in THEME_IDS" :key="t" type="button" class="px-btn small" :class="{ primary: settings.theme === t }" :title="THEMES[t].description"
          @click="settings.theme = t"
        >
          {{ THEMES[t].name }}
        </button>
      </div>
      <small class="note">{{ THEMES[settings.theme].description }}</small>
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
    <div class="cloud">
      <span>Molnsparning</span>
      <small class="note">{{ cloudText }}</small>
      <template v-if="saves.account.kind === 'anonymous'">
        <small class="note">Koppla ett konto med e-post för att nå dina sparfiler från andra enheter. Sparfilerna följer med.</small>
        <form class="email" @submit.prevent="linkEmail">
          <input v-model="email" type="email" placeholder="din@epost.se" autocomplete="email">
          <button type="submit" class="px-btn small" :disabled="!email">Koppla konto</button>
        </form>
      </template>
      <template v-if="saves.account.kind !== 'unavailable'">
        <small class="note">Har du redan ett konto på en annan enhet?</small>
        <form class="email" @submit.prevent="signIn">
          <input v-model="email" type="email" placeholder="din@epost.se" autocomplete="email">
          <button type="submit" class="px-btn small" :disabled="!email">Logga in med länk</button>
        </form>
      </template>
      <small v-if="emailMessage" class="note msg">{{ emailMessage }}</small>
    </div>
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

.cloud {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.email {
  display: flex;
  gap: 6px;
}

.email input {
  flex: 1;
  min-width: 0;
}

.msg {
  color: #ffd070;
}

.themes {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.theme-list {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
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
