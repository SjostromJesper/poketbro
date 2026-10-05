<script setup lang="ts">
import { REASON_LABELS } from '#shared/game/battle'

interface MatchRow {
  id: string
  kind: 'training' | 'challenge' | 'queue' | 'beast'
  playedAt: string
  opponentName: string
  won: boolean
  winnerName: string
  loserName: string
  reason: keyof typeof REASON_LABELS
  rounds: number
  log: any[]
}

const KIND_LABELS: Record<MatchRow['kind'], string> = {
  training: 'Träning',
  challenge: 'Utmaning',
  queue: 'Slumpduell',
  beast: 'Arenabest',
}

const { character } = useCharacter()
const matches = ref<MatchRow[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    matches.value = await $fetch('/api/matches/list')
  } finally {
    loading.value = false
  }
})

const expandedId = ref<string | null>(null)

function toggle(id: string) {
  expandedId.value = expandedId.value === id ? null : id
}

function formatDate(timestamp: string) {
  return new Date(timestamp).toLocaleString('sv-SE', {
    dateStyle: 'short',
    timeStyle: 'medium',
  })
}
</script>

<template>
  <div class="card">
    <h1>Historik</h1>

    <p v-if="loading" class="hint">Laddar...</p>
    <p v-else-if="matches.length === 0" class="hint">Inga strider genomförda ännu.</p>

    <ul v-else class="match-list">
      <li v-for="m in matches" :key="m.id" class="match-item">
        <button type="button" class="match-summary" @click="toggle(m.id)">
          <span class="match-result" :class="{ won: m.won, lost: !m.won }">{{ m.won ? 'Vann' : 'Förlorade' }}</span>
          <span class="match-opponent">{{ KIND_LABELS[m.kind] }} mot {{ m.opponentName }}</span>
          <span class="hint">{{ formatDate(m.playedAt) }}</span>
          <span class="hint">{{ m.rounds }} rundor &middot; {{ REASON_LABELS[m.reason] }}</span>
          <span class="expand-hint hint">{{ expandedId === m.id ? 'Dölj rapport' : 'Läs rapport' }}</span>
        </button>

        <BattleLog v-if="expandedId === m.id" :log="m.log" :viewer-name="character?.name" />
      </li>
    </ul>
  </div>
</template>

<style scoped>
.match-list {
  list-style: none;
  padding: 0;
  margin: 1rem 0 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.match-item {
  background: var(--bg);
  border: 1px solid var(--border-soft);
  border-radius: 6px;
  overflow: hidden;
}

.match-summary {
  width: 100%;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 0.25rem 0.75rem;
  align-items: baseline;
  background: transparent;
  border: none;
  color: var(--text);
  font-family: inherit;
  font-size: 0.9rem;
  text-align: left;
  padding: 0.75rem 1rem;
  cursor: pointer;
}

.match-summary:hover {
  background: var(--surface-hover);
}

.match-result {
  font-weight: bold;
  grid-row: 1;
}

.match-result.won {
  color: var(--green);
}

.match-result.lost {
  color: var(--orange);
}

.match-opponent {
  grid-row: 1;
}

.expand-hint {
  grid-column: 3;
  grid-row: 1 / span 2;
  align-self: center;
  text-decoration: underline;
}
</style>
