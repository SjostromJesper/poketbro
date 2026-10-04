<script setup lang="ts">
import { STAT_KEYS, STAT_LABELS } from '#shared/game/races'
import { SKILL_SLOT_COUNT, skillById, triggerSummary } from '#shared/game/skills'

const { character, load, setCharacter, reset } = useCharacter()
const { reset: resetInventory } = useInventory()
useHpTicker()

const deleting = ref(false)
const deleteError = ref('')

async function deleteCharacter() {
  if (deleting.value) return
  const confirmed = confirm(
    `Är du säker på att du vill radera ${character.value?.name}? Detta tar bort karaktären, all utrustning och all historik permanent. Går inte att ångra.`,
  )
  if (!confirmed) return

  deleting.value = true
  deleteError.value = ''
  try {
    await $fetch('/api/characters/delete', { method: 'POST' })
    reset()
    resetInventory()
    await navigateTo('/')
  } catch (error: any) {
    deleteError.value = error?.data?.statusMessage ?? 'Kunde inte radera gladiatorn'
  } finally {
    deleting.value = false
  }
}

onMounted(async () => {
  await load()
  if (!character.value) {
    navigateTo('/')
    return
  }
})

const skillSlots = computed(() => {
  const ids = character.value?.skill_ids ?? []
  return Array.from({ length: SKILL_SLOT_COUNT }, (_, i) => {
    const id = ids[i] ?? null
    return { skill: id ? skillById(id) ?? null : null }
  })
})

function emptyAllocation(): Record<string, number> {
  const obj: Record<string, number> = {}
  for (const key of STAT_KEYS) obj[key] = 0
  return obj
}

const pointsAllocation = ref<Record<string, number>>(emptyAllocation())
const spentPoints = computed(() => STAT_KEYS.reduce((sum, key) => sum + (pointsAllocation.value[key] || 0), 0))
const remainingPoints = computed(() => (character.value?.unspent_points ?? 0) - spentPoints.value)

const allocating = ref(false)
const allocateError = ref('')

async function confirmAllocation() {
  if (spentPoints.value === 0 || remainingPoints.value < 0 || allocating.value) return
  allocating.value = true
  allocateError.value = ''
  try {
    const updated = await $fetch('/api/characters/allocate-points', {
      method: 'POST',
      body: { allocated: pointsAllocation.value },
    })
    setCharacter(updated as any)
    pointsAllocation.value = emptyAllocation()
  } catch (error: any) {
    allocateError.value = error?.data?.statusMessage ?? 'Kunde inte spara fördelningen'
  } finally {
    allocating.value = false
  }
}
</script>

<template>
  <div v-if="character" class="card">
    <h1>{{ character.name }}</h1>
    <p class="hint">Nivå {{ character.level }} &middot; XP {{ character.xp }}</p>
    <StatBar label="Liv" :current="character.current_hp" :max="character.maxHp" color="var(--red)" />
    <p class="hp-line">Guld: <strong>{{ character.gold }}</strong> &middot; <NuxtLink to="/kopman">handla hos köpmannen</NuxtLink></p>

    <ul class="stat-list">
      <li v-for="key in STAT_KEYS" :key="key">
        <span>{{ STAT_LABELS[key] }}</span>
        <strong>{{ character.stats[key] }}</strong>
      </li>
    </ul>

    <p class="hint locked">
      Din grundfördelning är låst för alltid, men du får {{ 20 }} nya poäng att fördela varje gång du
      lvlar upp. Totalvärden ovan inkluderar bonusar från <NuxtLink to="/utrustning">utrustning</NuxtLink>.
    </p>

    <template v-if="character.unspent_points > 0">
      <h2>Nya poäng!</h2>
      <p class="hint">Du har <strong>{{ character.unspent_points }}</strong> olevlade poäng att fördela.</p>
      <div class="stat-row" v-for="key in STAT_KEYS" :key="key">
        <span class="stat-label">{{ STAT_LABELS[key] }}</span>
        <input v-model.number="pointsAllocation[key]" type="number" min="0" :max="character.unspent_points">
      </div>
      <p class="hint">
        Kvar att fördela: <strong :class="{ warn: remainingPoints < 0 }">{{ remainingPoints }}</strong>
      </p>
      <p v-if="allocateError" class="error">{{ allocateError }}</p>
      <button
        type="button"
        class="allocate-btn"
        :disabled="spentPoints === 0 || remainingPoints < 0 || allocating"
        @click="confirmAllocation"
      >
        {{ allocating ? 'Sparar...' : 'Bekräfta fördelning' }}
      </button>
    </template>

    <h2>Färdigheter</h2>
    <p class="hint">Fyra platser för stridsfärdigheter. Fler platser kan fyllas på senare genom särskilda sätt att hitta färdigheter.</p>
    <div class="skill-grid">
      <div v-for="(row, i) in skillSlots" :key="i" class="skill-box" :class="{ filled: row.skill }">
        <template v-if="row.skill">
          <strong class="skill-name">{{ row.skill.name }}</strong>
          <span class="hint">{{ row.skill.description }}</span>
          <span class="skill-meta hint">{{ triggerSummary(row.skill) }}</span>
        </template>
        <span v-else class="hint empty-slot">Tom plats</span>
      </div>
    </div>

    <h2>Farlig zon</h2>
    <p class="hint">Raderar din gladiator, all utrustning och all matchhistorik permanent. Ditt konto och din inloggning påverkas inte.</p>
    <p v-if="deleteError" class="error">{{ deleteError }}</p>
    <button type="button" class="delete-btn" :disabled="deleting" @click="deleteCharacter">
      {{ deleting ? 'Raderar...' : 'Radera gladiator' }}
    </button>
  </div>
</template>

<style scoped>
.hp-line {
  margin: 0.25rem 0 1rem;
}

.hp-line strong {
  color: var(--accent-strong);
}

.stat-list {
  list-style: none;
  padding: 0;
  margin: 1rem 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.stat-list li {
  display: flex;
  justify-content: space-between;
  background: var(--bg);
  border: 1px solid var(--border-soft);
  border-radius: 4px;
  padding: 0.5rem 0.75rem;
}

.stat-list strong {
  color: var(--accent-strong);
}

.locked {
  font-style: italic;
}

.stat-row {
  display: grid;
  grid-template-columns: 140px 90px;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.4rem;
}

.stat-label {
  color: var(--text);
  font-size: 0.9rem;
}

.stat-row input {
  background: var(--input-bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 0.4rem;
  color: var(--text);
  width: 80px;
}

.warn {
  color: var(--orange);
}

.error {
  color: var(--orange);
  font-size: 0.9rem;
}

.allocate-btn {
  background: var(--accent);
  border: none;
  border-radius: 4px;
  padding: 0.6rem 1.2rem;
  color: var(--text-inverse);
  font-size: 0.95rem;
  cursor: pointer;
  margin-top: 0.5rem;
}

.allocate-btn:hover:not(:disabled) {
  background: var(--accent-hover);
}

.allocate-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

h2 {
  color: var(--accent-strong);
  font-size: 1.05rem;
  margin: 1.5rem 0 0.5rem;
}

.skill-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.75rem;
  margin-top: 0.75rem;
}

.skill-box {
  background: var(--bg);
  border: 1px dashed var(--border-soft);
  border-radius: 6px;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-height: 90px;
}

.skill-box.filled {
  border-style: solid;
  border-color: var(--border);
}

.skill-name {
  color: var(--accent-strong);
  font-size: 0.9rem;
}

.skill-meta {
  font-size: 0.75rem;
}

.empty-slot {
  font-style: italic;
}

.delete-btn {
  background: transparent;
  border: 1px solid var(--red);
  border-radius: 4px;
  padding: 0.6rem 1.2rem;
  color: var(--red);
  font-size: 0.95rem;
  cursor: pointer;
  margin-top: 0.5rem;
}

.delete-btn:hover:not(:disabled) {
  background: var(--red);
  color: var(--text-inverse);
}

.delete-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
