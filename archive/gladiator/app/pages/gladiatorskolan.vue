<script setup lang="ts">
import { REASON_LABELS, type BattleResult } from '#shared/game/battle'
import { TACTICS } from '#shared/game/tactics'
import { nextTickBoundary } from '#shared/game/regen'
import { MAX_LEVEL, XP_TO_LEVEL } from '#shared/game/progression'
import { MAX_ADVENTURE_TIME } from '#shared/game/stamina'

const { character, load, setCharacter } = useCharacter()
const { now } = useHpTicker()

onMounted(async () => {
  await load()
  if (!character.value) {
    navigateTo('/')
    return
  }
})

const graduated = computed(() => (character.value?.level ?? 1) >= MAX_LEVEL)
const nextLevelXp = computed(() => character.value ? XP_TO_LEVEL[character.value.level] : undefined)

const secondsToNextTick = computed(() => {
  if (!character.value || character.value.current_hp >= character.value.maxHp) return null
  return Math.max(0, Math.round((nextTickBoundary(now.value) - now.value) / 1000))
})

const giveUpPercent = ref(20)
const selectedTacticId = ref('normal')

const fighting = ref(false)
const battleResult = ref<BattleResult | null>(null)
const lastOutcomeText = ref('')
const errorMessage = ref('')

async function startBattle() {
  if (!character.value || fighting.value) return
  fighting.value = true
  errorMessage.value = ''
  try {
    const response = await $fetch('/api/training/fight', {
      method: 'POST',
      body: { tacticId: selectedTacticId.value, giveUpPercent: giveUpPercent.value },
    })
    setCharacter(response.character as any)
    battleResult.value = response.result
    lastOutcomeText.value = response.outcomeText
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage ?? 'Kunde inte genomföra striden'
  } finally {
    fighting.value = false
  }
}
</script>

<template>
  <div v-if="character" class="card">
    <h1>Gladiatorskolan</h1>

    <p class="hint">
      Nivå {{ character.level }} av {{ MAX_LEVEL }}
      <template v-if="graduated"> &middot; Examinerad - redo för arenan</template>
    </p>

    <StatBar label="Liv" :current="character.current_hp" :max="character.maxHp" color="var(--red)" />
    <StatBar v-if="!graduated" label="XP" :current="character.xp" :max="nextLevelXp ?? character.xp" color="var(--accent-strong)" />
    <StatBar label="Tid" :current="character.time_remaining" :max="MAX_ADVENTURE_TIME" color="var(--teal)" />

    <p v-if="secondsToNextTick !== null" class="hint tick-hint">
      Nästa läkning (+{{ Math.floor(character.maxHp * 0.32) }}) om {{ Math.floor(secondsToNextTick / 60) }}:{{ String(secondsToNextTick % 60).padStart(2, '0') }}
    </p>
    <p class="hint tick-hint">Strider kostar tid (ca 5-10 beroende på hur länge striden pågår) - tiden fylls på över tid, precis som ditt liv.</p>

    <div v-if="graduated" class="graduated-notice">
      <p>Du har examinerats ur gladiatorskolan och kan inte längre träna mot dockan här.</p>
      <p>Gå till <NuxtLink to="/arenan">Arenan</NuxtLink> för att utmana andra spelare eller ställa dig i kön för en slumpduell.</p>
    </div>

    <template v-else>
      <h2>Inställningar inför strid</h2>

      <label class="setting-field">
        Ge upp vid procent av liv
        <div class="giveup-row">
          <input v-model.number="giveUpPercent" type="range" min="0" max="90" step="5">
          <span class="giveup-value">{{ giveUpPercent }}%</span>
        </div>
        <span class="hint">
          <template v-if="giveUpPercent > 0">
            Du ger upp automatiskt om ditt liv sjunker till {{ giveUpPercent }}% eller lägre.
          </template>
          <template v-else>Du ger aldrig upp - striden avgörs med knockout.</template>
        </span>
      </label>

      <label class="setting-field">
        Taktik
        <select v-model="selectedTacticId">
          <option v-for="t in TACTICS" :key="t.id" :value="t.id">{{ t.label }}</option>
        </select>
      </label>

      <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
      <button type="button" class="fight-btn" :disabled="fighting" @click="startBattle">
        {{ fighting ? 'Slåss...' : 'Starta strid' }}
      </button>
    </template>

    <div v-if="battleResult" class="battle-result">
      <p class="outcome">{{ lastOutcomeText }}</p>
      <p class="summary">
        <strong>{{ battleResult.winnerName }}</strong> vann över {{ battleResult.loserName }}
        ({{ battleResult.rounds }} rundor, {{ REASON_LABELS[battleResult.reason] }})
      </p>
      <BattleLog :log="battleResult.log" :viewer-name="character.name" />
    </div>
  </div>
</template>

<style scoped>
h2 {
  color: var(--accent-strong);
  font-size: 1.05rem;
  margin: 1.25rem 0 0.75rem;
}

.tick-hint {
  margin: 0.4rem 0 1rem;
}

.graduated-notice {
  background: var(--bg);
  border: 1px solid var(--border-soft);
  border-radius: 6px;
  padding: 1rem;
  color: var(--text-muted);
}

.graduated-notice p {
  margin: 0 0 0.5rem;
}

.graduated-notice p:last-child {
  margin-bottom: 0;
}

.setting-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.9rem;
  color: var(--text-muted);
  max-width: 360px;
  margin-bottom: 1rem;
}

.giveup-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.giveup-row input[type='range'] {
  flex: 1;
}

.giveup-value {
  color: var(--accent-strong);
  font-weight: bold;
  width: 3ch;
}

.setting-field select {
  background: var(--input-bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 0.5rem;
  color: var(--text);
  font-size: 1rem;
}

.error {
  color: var(--orange);
  font-size: 0.9rem;
}

.fight-btn {
  background: var(--accent);
  border: none;
  border-radius: 4px;
  padding: 0.7rem 1.4rem;
  color: var(--text-inverse);
  font-size: 1rem;
  cursor: pointer;
  margin: 0.5rem 0 1rem;
}

.fight-btn:hover:not(:disabled) {
  background: var(--accent-hover);
}

.fight-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.outcome {
  color: var(--accent-strong);
  font-weight: bold;
}

.summary {
  color: var(--text-muted);
}
</style>
