<script setup lang="ts">
import {
  BASE_POINT_POOL,
  RACES,
  STAT_KEYS,
  STAT_LABELS,
  emptyStats,
  finalStats,
  raceById,
  type StatBlock,
} from '#shared/game/races'
import { COMMON_SKILLS, triggerSummary } from '#shared/game/skills'

const user = useSupabaseUser()
const { character, load, create } = useCharacter()

const checking = ref(true)

onMounted(async () => {
  if (user.value) {
    await load()
    if (character.value) {
      await navigateTo('/gladiatorskolan')
      return
    }
  }
  checking.value = false
})

const name = ref('Din gladiator')
const selectedRaceId = ref(RACES[0].id)
const selectedSkillId = ref(COMMON_SKILLS[0].id)
const allocated = ref<StatBlock>(emptyStats())
const errorMessage = ref('')
const submitting = ref(false)

const race = computed(() => raceById(selectedRaceId.value))
const spent = computed(() => STAT_KEYS.reduce((sum, key) => sum + allocated.value[key], 0))
const remaining = computed(() => BASE_POINT_POOL - spent.value)
const computedFinalStats = computed(() => finalStats(race.value, allocated.value))
const canCreate = computed(() => remaining.value === 0 && name.value.trim().length > 0)

function selectRace(id: string) {
  selectedRaceId.value = id
  allocated.value = emptyStats()
}

async function confirmCharacter() {
  if (!canCreate.value || submitting.value) return
  submitting.value = true
  errorMessage.value = ''
  try {
    await create({
      name: name.value.trim(),
      raceId: selectedRaceId.value,
      allocated: { ...allocated.value },
      skillId: selectedSkillId.value,
    })
    await navigateTo('/gladiatorskolan')
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage ?? 'Kunde inte skapa gladiatorn'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div v-if="checking" />
  <div v-else-if="!user" class="card">
    <h1>Välkommen till Arenan</h1>
    <p>
      Skapa en gladiator, träna i skolan och utmana andra spelare när du är redo.
    </p>
    <p>
      <NuxtLink to="/registrera">Skapa konto</NuxtLink> eller
      <NuxtLink to="/login">logga in</NuxtLink> för att börja.
    </p>
  </div>
  <div v-else class="creator">
    <div class="card">
      <h1>Skapa din gladiator</h1>
      <p class="hint">Välj noga - när gladiaten är skapad kan du inte ändra dina siffror igen.</p>

      <label class="name-field">
        Namn
        <input v-model="name" type="text" maxlength="24">
      </label>

      <h2>Välj ras</h2>
      <div class="race-grid">
        <button
          v-for="r in RACES"
          :key="r.id"
          type="button"
          class="race-card"
          :class="{ active: r.id === selectedRaceId }"
          @click="selectRace(r.id)"
        >
          <strong>{{ r.name }}</strong>
          <p class="hint">{{ r.description }}</p>
          <ul class="modifiers">
            <li v-for="key in STAT_KEYS" :key="key" :class="{ pos: r.modifiers[key] > 0, neg: r.modifiers[key] < 0 }">
              <template v-if="r.modifiers[key] !== 0">
                {{ STAT_LABELS[key] }} {{ r.modifiers[key] > 0 ? '+' : '' }}{{ r.modifiers[key] }}%
              </template>
            </li>
          </ul>
        </button>
      </div>
    </div>

    <div class="card">
      <h2>Välj startfärdighet</h2>
      <p class="hint">Du får en av dessa färdigheter direkt. Fler platser finns men fylls på senare genom särskilda sätt att hitta färdigheter.</p>
      <div class="skill-grid">
        <button
          v-for="s in COMMON_SKILLS"
          :key="s.id"
          type="button"
          class="skill-card"
          :class="{ active: s.id === selectedSkillId }"
          @click="selectedSkillId = s.id"
        >
          <strong>{{ s.name }}</strong>
          <p class="hint">{{ s.description }}</p>
          <p class="hint skill-meta">{{ triggerSummary(s) }}</p>
        </button>
      </div>
    </div>

    <div class="card">
      <h2>Fördela poäng</h2>
      <p class="hint">
        Du har {{ BASE_POINT_POOL }} poäng att fördela, oavsett ras - ditt folkslag ger procentuella bonusar/minus på de poäng du lägger, inte fler poäng att fördela.
        Kvar: <strong :class="{ warn: remaining !== 0 }">{{ remaining }}</strong>
      </p>

      <div class="stat-row" v-for="key in STAT_KEYS" :key="key">
        <span class="stat-label">{{ STAT_LABELS[key] }}</span>
        <span class="stat-mod">ras {{ race.modifiers[key] >= 0 ? '+' : '' }}{{ race.modifiers[key] }}%</span>
        <input v-model.number="allocated[key]" type="number" min="0" :max="BASE_POINT_POOL">
        <span class="stat-final">= {{ computedFinalStats[key] }}</span>
      </div>

      <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
      <button type="button" class="confirm-btn" :disabled="!canCreate || submitting" @click="confirmCharacter">
        {{ submitting ? 'Skapar...' : 'Skapa gladiator' }}
      </button>
      <p v-if="!canCreate" class="hint">Fördela alla poäng och ge din gladiator ett namn.</p>
    </div>
  </div>
</template>

<style scoped>
.creator {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.name-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.9rem;
  color: var(--text-muted);
  max-width: 260px;
  margin-bottom: 1rem;
}

.name-field input {
  background: var(--input-bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 0.5rem;
  color: var(--text);
  font-size: 1rem;
}

h2 {
  color: var(--accent-strong);
  font-size: 1.05rem;
  margin: 1.25rem 0 0.75rem;
}

.race-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.75rem;
}

.race-card {
  text-align: left;
  background: var(--bg);
  border: 1px solid var(--border-soft);
  border-radius: 6px;
  padding: 0.75rem;
  color: var(--text);
  cursor: pointer;
  font-family: inherit;
}

.race-card:hover {
  border-color: var(--border-strong);
}

.race-card.active {
  border-color: var(--accent);
  background: var(--surface-hover);
}

.race-card strong {
  color: var(--accent-strong);
}

.modifiers {
  list-style: none;
  padding: 0;
  margin: 0.5rem 0 0;
  font-size: 0.8rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.modifiers li.pos {
  color: var(--green);
}

.modifiers li.neg {
  color: var(--orange);
}

.skill-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.75rem;
}

.skill-card {
  text-align: left;
  background: var(--bg);
  border: 1px solid var(--border-soft);
  border-radius: 6px;
  padding: 0.75rem;
  color: var(--text);
  cursor: pointer;
  font-family: inherit;
}

.skill-card:hover {
  border-color: var(--border-strong);
}

.skill-card.active {
  border-color: var(--accent);
  background: var(--surface-hover);
}

.skill-card strong {
  color: var(--accent-strong);
}

.skill-meta {
  font-size: 0.75rem;
}

.stat-row {
  display: grid;
  grid-template-columns: 120px 70px 80px 60px;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.stat-label {
  color: var(--text);
}

.stat-mod {
  color: var(--text-muted);
  font-size: 0.8rem;
}

.stat-row input {
  background: var(--input-bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 0.4rem;
  color: var(--text);
  width: 80px;
}

.stat-final {
  color: var(--accent-strong);
  font-weight: bold;
}

.warn {
  color: var(--orange);
}

.error {
  color: var(--orange);
  font-size: 0.9rem;
}

.confirm-btn {
  background: var(--accent);
  border: none;
  border-radius: 4px;
  padding: 0.7rem 1.4rem;
  color: var(--text-inverse);
  font-size: 1rem;
  cursor: pointer;
  margin-top: 1rem;
}

.confirm-btn:hover:not(:disabled) {
  background: var(--accent-hover);
}

.confirm-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
