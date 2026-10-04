<script setup lang="ts">
import { REASON_LABELS, type BattleResult } from '#shared/game/battle'
import { RACES } from '#shared/game/races'
import { TACTICS, tacticById } from '#shared/game/tactics'
import { MAX_LEVEL } from '#shared/game/progression'
import { MAX_ADVENTURE_TIME } from '#shared/game/stamina'
import { ARENA_BEASTS, beastRewardGold, beastRewardXp } from '#shared/game/arenaBeasts'

interface PlayerRow {
  user_id: string
  name: string
  race_id: string
  level: number
}

const { character, load, setCharacter } = useCharacter()

const eligible = computed(() => (character.value?.level ?? 1) >= MAX_LEVEL)
const players = ref<PlayerRow[]>([])
const loadingPlayers = ref(false)

onMounted(async () => {
  await load()
  if (!character.value) {
    navigateTo('/')
    return
  }
  if (character.value.default_tactic_id) selectedTacticId.value = character.value.default_tactic_id
  if (character.value.default_give_up_percent !== undefined) giveUpPercent.value = character.value.default_give_up_percent
  if (eligible.value) {
    await fetchPlayers()

    const status = await $fetch('/api/duels/status')
    if (status.inQueue) {
      selectedTacticId.value = status.tacticId
      giveUpPercent.value = status.giveUpPercent
      inQueue.value = true
      pollOnce()
    }
  }
})

onUnmounted(() => {
  if (pollTimer) clearTimeout(pollTimer)
})

async function fetchPlayers() {
  loadingPlayers.value = true
  try {
    players.value = await $fetch('/api/characters/list')
  } finally {
    loadingPlayers.value = false
  }
}

function raceName(raceId: string) {
  return RACES.find(r => r.id === raceId)?.name ?? raceId
}

const giveUpPercent = ref(20)
const selectedTacticId = ref('normal')

const battleResult = ref<BattleResult | null>(null)
const lastOutcomeText = ref('')
const errorMessage = ref('')
const isBotTest = ref(false)

const inQueue = ref(false)
const polling = ref(false)
let pollTimer: ReturnType<typeof setTimeout> | undefined

const botFighting = ref(false)

async function fightBot() {
  errorMessage.value = ''
  battleResult.value = null
  botFighting.value = true
  try {
    const response = await $fetch('/api/arenan/bot-fight', {
      method: 'POST',
      body: { tacticId: selectedTacticId.value, giveUpPercent: giveUpPercent.value },
    })
    battleResult.value = response.result
    isBotTest.value = true
    const won = response.result.winnerName === character.value?.name
    lastOutcomeText.value = (won ? 'Du vann testmatchen!' : 'Du förlorade testmatchen.') + ' Ingen påverkan på din gladiator.'
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage ?? 'Kunde inte starta testmatchen'
  } finally {
    botFighting.value = false
  }
}

function applyDuelOutcome(response: { character: any, result: BattleResult, droppedItem?: { name: string } | null, goldGained?: number }) {
  const myName = character.value?.name
  setCharacter(response.character)
  battleResult.value = response.result
  isBotTest.value = false
  const won = response.result.winnerName === myName
  const lootText = response.droppedItem ? ` Du hittade "${response.droppedItem.name}"!` : ''
  const goldText = response.goldGained ? ` +${response.goldGained} guld.` : ''
  lastOutcomeText.value = (won ? 'Du vann duellen!' : 'Du förlorade duellen.') + goldText + lootText
}

async function challenge(targetUserId: string) {
  errorMessage.value = ''
  battleResult.value = null
  try {
    const response = await $fetch('/api/duels/challenge', {
      method: 'POST',
      body: { targetUserId, tacticId: selectedTacticId.value, giveUpPercent: giveUpPercent.value },
    })
    applyDuelOutcome(response as any)
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage ?? 'Kunde inte utmana spelaren'
  }
}

async function joinQueue() {
  errorMessage.value = ''
  battleResult.value = null
  inQueue.value = true
  await pollOnce()
}

async function pollOnce() {
  if (!inQueue.value) return
  polling.value = true
  try {
    const response = await $fetch('/api/duels/poll', {
      method: 'POST',
      body: { tacticId: selectedTacticId.value, giveUpPercent: giveUpPercent.value },
    })
    if (response.status === 'matched') {
      inQueue.value = false
      applyDuelOutcome(response as any)
      return
    }
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage ?? 'Något gick fel i kön'
    inQueue.value = false
    return
  } finally {
    polling.value = false
  }
  pollTimer = setTimeout(pollOnce, 3000)
}

async function leaveQueue() {
  inQueue.value = false
  if (pollTimer) clearTimeout(pollTimer)
  await $fetch('/api/duels/leave-queue', { method: 'POST' })
}

const beastFightingId = ref<string | null>(null)

async function fightBeast(beastId: string) {
  errorMessage.value = ''
  battleResult.value = null
  beastFightingId.value = beastId
  try {
    const response = await $fetch('/api/arenan/beast-fight', {
      method: 'POST',
      body: { beastId, tacticId: selectedTacticId.value, giveUpPercent: giveUpPercent.value },
    })
    setCharacter(response.character as any)
    battleResult.value = response.result
    isBotTest.value = false
    lastOutcomeText.value = response.outcomeText
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage ?? 'Kunde inte slåss mot besten'
  } finally {
    beastFightingId.value = null
  }
}
</script>

<template>
  <div v-if="character" class="card">
    <h1>Arenan</h1>

    <StatBar label="Tid" :current="character.time_remaining" :max="MAX_ADVENTURE_TIME" color="var(--teal)" />
    <p class="hint">Strider kostar tid (ca 5-10 beroende på hur länge striden pågår) - tiden fylls på över tid, precis som ditt liv.</p>

    <div v-if="!eligible" class="graduated-notice">
      <p>Du måste vara examinerad (nivå {{ MAX_LEVEL }}) i gladiatorskolan för att slåss här.</p>
      <p>Just nu är du nivå {{ character.level }}. Fortsätt träna i <NuxtLink to="/gladiatorskolan">Gladiatorskolan</NuxtLink>.</p>
    </div>

    <template v-else>
      <label class="setting-field">
        Ge upp vid procent av liv
        <div class="giveup-row">
          <input v-model.number="giveUpPercent" type="range" min="0" max="90" step="5" :disabled="inQueue">
          <span class="giveup-value">{{ giveUpPercent }}%</span>
        </div>
      </label>

      <label class="setting-field">
        Taktik
        <select v-model="selectedTacticId" :disabled="inQueue">
          <option v-for="t in TACTICS" :key="t.id" :value="t.id">{{ t.label }}</option>
        </select>
        <span class="hint">{{ tacticById(selectedTacticId).description }}</span>
      </label>

      <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

      <h2>Testa mot bot</h2>
      <p class="hint">Prova din taktik, utrustning och färdigheter mot en bot på din egen nivå. Påverkar varken ditt liv, historik eller loot.</p>
      <div class="actions">
        <button type="button" class="fight-btn" :disabled="botFighting || inQueue" @click="fightBot">
          {{ botFighting ? 'Slåss...' : 'Starta testmatch' }}
        </button>
      </div>

      <h2>Arenans bestar</h2>
      <p class="hint">Nu när du är examinerad kan du utmana arenans namngivna bestar. Ju högre grad, desto farligare - men belöningen växer med den.</p>
      <div class="beast-table">
        <div class="beast-row beast-header">
          <span>Namn</span>
          <span>Vinst</span>
          <span>Grad</span>
          <span></span>
        </div>
        <div v-for="b in ARENA_BEASTS" :key="b.id" class="beast-row">
          <span class="beast-name">
            {{ b.name }}
            <span class="hint beast-desc">{{ b.description }}</span>
          </span>
          <span class="hint">{{ beastRewardGold(b.grade) }} silvermynt / {{ beastRewardXp(b.grade) }} erfarenhet</span>
          <span>{{ b.grade }}</span>
          <button type="button" class="fight-btn small" :disabled="beastFightingId !== null || inQueue" @click="fightBeast(b.id)">
            {{ beastFightingId === b.id ? 'Slåss...' : 'Utmana' }}
          </button>
        </div>
      </div>

      <h2>Slumpduell</h2>
      <div v-if="!inQueue" class="actions">
        <button type="button" class="fight-btn" @click="joinQueue">Ställ dig i kön</button>
      </div>
      <div v-else class="queue-waiting">
        <span>{{ polling ? 'Söker motståndare...' : 'Väntar på match...' }}</span>
        <button type="button" class="leave-btn" @click="leaveQueue">Lämna kön</button>
      </div>

      <h2>Utmana en spelare</h2>
      <p v-if="loadingPlayers" class="hint">Laddar spelare...</p>
      <p v-else-if="players.length === 0" class="hint">Inga andra spelare med gladiator ännu.</p>
      <ul v-else class="player-list">
        <li v-for="p in players" :key="p.user_id" class="player-row">
          <span class="player-name">{{ p.name }}</span>
          <span class="hint">{{ raceName(p.race_id) }} &middot; nivå {{ p.level }}</span>
          <button type="button" :disabled="inQueue" @click="challenge(p.user_id)">Utmana</button>
        </li>
      </ul>
    </template>

    <div v-if="battleResult" class="battle-result">
      <span v-if="isBotTest" class="test-badge">TESTMATCH</span>
      <p class="outcome">{{ lastOutcomeText }}</p>
      <p class="summary">
        <strong>{{ battleResult.winnerName }}</strong> vann över {{ battleResult.loserName }}
        ({{ battleResult.rounds }} rundor, {{ REASON_LABELS[battleResult.reason] }})
      </p>
      <BattleLog :log="battleResult.log" :viewer-name="character?.name" />
    </div>
  </div>
</template>

<style scoped>
h2 {
  color: var(--accent-strong);
  font-size: 1.05rem;
  margin: 1.25rem 0 0.75rem;
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

.fight-btn,
.leave-btn,
button {
  font-family: inherit;
}

.fight-btn {
  background: var(--accent);
  border: none;
  border-radius: 4px;
  padding: 0.7rem 1.4rem;
  color: var(--text-inverse);
  font-size: 1rem;
  cursor: pointer;
}

.fight-btn:hover:not(:disabled) {
  background: var(--accent-hover);
}

.fight-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.fight-btn.small {
  padding: 0.4rem 0.8rem;
  font-size: 0.85rem;
}

.beast-table {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 1.25rem;
}

.beast-row {
  display: grid;
  grid-template-columns: 1.4fr 1.6fr 0.5fr auto;
  align-items: center;
  gap: 0.75rem;
  background: var(--bg);
  border: 1px solid var(--border-soft);
  border-radius: 4px;
  padding: 0.5rem 0.75rem;
}

.beast-header {
  background: transparent;
  border: none;
  padding: 0 0.75rem;
  color: var(--accent-strong);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.beast-name {
  display: flex;
  flex-direction: column;
  color: var(--text);
}

.beast-desc {
  font-size: 0.75rem;
}

.queue-waiting {
  display: flex;
  align-items: center;
  gap: 1rem;
  color: var(--text-muted);
}

.leave-btn {
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 0.5rem 1rem;
  color: var(--text);
  cursor: pointer;
}

.leave-btn:hover {
  border-color: var(--border-strong);
  color: var(--accent-strong);
}

.player-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.player-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: var(--bg);
  border: 1px solid var(--border-soft);
  border-radius: 4px;
  padding: 0.5rem 0.75rem;
}

.player-name {
  flex: 1;
  color: var(--text);
}

.player-row button {
  background: var(--accent);
  border: none;
  border-radius: 4px;
  padding: 0.4rem 0.8rem;
  color: var(--text-inverse);
  cursor: pointer;
}

.player-row button:hover:not(:disabled) {
  background: var(--accent-hover);
}

.player-row button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.outcome {
  color: var(--accent-strong);
  font-weight: bold;
}

.test-badge {
  display: inline-block;
  background: var(--surface-hover);
  border: 1px solid var(--blue);
  color: var(--blue);
  font-size: 0.7rem;
  letter-spacing: 0.05em;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  margin-bottom: 0.5rem;
}

.summary {
  color: var(--text-muted);
}
</style>
