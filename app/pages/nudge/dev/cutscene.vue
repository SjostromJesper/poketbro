<script setup lang="ts">
// Dev page: plays a small test cutscene with the real engine and scene (/nudge/dev/cutscene).
import { ref } from 'vue'
import type { CutsceneStep } from '~~/nudge/game/cutscene'
import CutsceneScene from '~/components/nudge/cutscene/CutsceneScene.vue'
import NudgeFrame from '~/components/nudge/NudgeFrame.vue'

const steps: CutsceneStep[] = [
  { type: 'fade', to: 'black', ms: 0 },
  { type: 'playMusic', id: 'home' },
  { type: 'fade', to: 'clear', ms: 1200 },
  { type: 'showSprite', id: 'ek', sprite: { kind: 'character', sprite: 'professor' }, at: 'left' },
  { type: 'text', lines: ['Hej! Det här är en testscen för cutscene-motorn.', 'Ett tryck går vidare ett steg.'], speaker: 'Professor Ek' },
  { type: 'showSprite', id: 'eevee', sprite: { kind: 'pokemon', speciesId: 133 }, at: 'right', anim: 'pop' },
  { type: 'playCry', speciesId: 133 },
  { type: 'highlight', illustration: 'atb' },
  { type: 'text', lines: ['Här är en Eevee, och en bar som fylls.'], speaker: 'Professor Ek' },
  { type: 'highlight', illustration: null },
  { type: 'input', name: 'player', prompt: 'Vad heter du?', suggestions: ['Alex', 'Sam', 'Robin'], maxLength: 10 },
  { type: 'choice', name: 'ok', prompt: 'Så du heter {player}?', options: ['Ja', 'Nej'] },
  { type: 'text', lines: ['Hej {player}! (svar: {ok})'], speaker: 'Professor Ek' },
  { type: 'hideSprite', id: 'ek', anim: 'shrink' },
  { type: 'wait', ms: 1000 },
  { type: 'fade', to: 'black', ms: 800 },
]
const result = ref<Record<string, string> | null>(null)
</script>

<template>
  <NudgeFrame>
    <CutsceneScene v-if="!result" :steps="steps" @done="result = $event" />
    <div v-else class="done px-panel">
      <p>Scenen är slut. Variabler: {{ result }}</p>
      <button type="button" class="px-btn" @click="result = null">Spela igen</button>
    </div>
  </NudgeFrame>
</template>

<style scoped>
.done {
  position: absolute;
  inset: 30% 20%;
  padding: 20px;
}
</style>
