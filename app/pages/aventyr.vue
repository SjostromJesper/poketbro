<script setup lang="ts">
import { TERRAIN_LABELS, DIRECTION_LABELS, type Direction } from '#shared/game/worldmap'

const { character, load: loadCharacter } = useCharacter()
const {
  inParty, party, members, isLeader, timeRemaining, maxTime, discoveredTiles, load, joinOrCreate, move, resolveEvent, leave,
} = usePartyAdventure()

const errorMessage = ref('')
const busy = ref(false)
const lastEventText = ref('')
const lastBattle = ref<any>(null)

onMounted(async () => {
  await loadCharacter()
  if (!character.value) {
    navigateTo('/')
    return
  }
  await load()
})

const TERRAIN_SYMBOLS: Record<string, string> = {
  plains: '·',
  forest: '♣',
  hills: '^',
  swamp: '~',
  mountain: '▲',
  water: '≈',
}

const tileMap = computed(() => {
  const map = new Map<string, { terrain: string, poiType: string | null }>()
  for (const t of discoveredTiles.value) map.set(`${t.x},${t.y}`, { terrain: t.terrain, poi_type: t.poi_type } as any)
  return map
})

const GRID_RADIUS = 3
const gridRows = computed(() => {
  if (!party.value) return []
  const rows = []
  for (let dy = -GRID_RADIUS; dy <= GRID_RADIUS; dy++) {
    const row = []
    for (let dx = -GRID_RADIUS; dx <= GRID_RADIUS; dx++) {
      const x = party.value.x + dx
      const y = party.value.y + dy
      const known = tileMap.value.get(`${x},${y}`)
      row.push({ x, y, known, isMe: dx === 0 && dy === 0 })
    }
    rows.push(row)
  }
  return rows
})

async function doJoin() {
  errorMessage.value = ''
  busy.value = true
  try {
    await joinOrCreate()
  } catch (e: any) {
    errorMessage.value = e?.data?.statusMessage ?? 'Kunde inte gå med i en grupp'
  } finally {
    busy.value = false
  }
}

async function doMove(dir: Direction) {
  errorMessage.value = ''
  lastEventText.value = ''
  lastBattle.value = null
  busy.value = true
  try {
    const result: any = await move(dir)
    if (result.event.type === 'nothing') lastEventText.value = 'Ingenting hände på vägen.'
    else if (result.event.type === 'minor_find') lastEventText.value = `Ni hittade lite guld! +${result.event.goldEach} var.`
    else if (result.event.type === 'hazard') lastEventText.value = `Terrängen var farlig - alla tog ${result.event.damage} skada.`
    else if (result.event.type === 'poi') lastEventText.value = `Ni hittade en plats: ${result.event.name}!`
    else if (result.event.type === 'combat') {
      lastBattle.value = result.event.battle
      lastEventText.value = result.event.partyWon
        ? `Ni vann striden! +${result.event.goldPerMember} guld var.`
        : 'Ni förlorade striden mot fienderna.'
    }
  } catch (e: any) {
    errorMessage.value = e?.data?.statusMessage ?? 'Kunde inte flytta gruppen'
  } finally {
    busy.value = false
  }
}

async function doResolveEvent() {
  busy.value = true
  try {
    await resolveEvent()
  } finally {
    busy.value = false
  }
}

async function doLeave() {
  busy.value = true
  try {
    await leave()
    lastEventText.value = ''
    lastBattle.value = null
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div v-if="character" class="card">
    <h1>Äventyr</h1>

    <p class="hint">
      Tid kvar: <strong>{{ timeRemaining }}</strong> / {{ maxTime }} - fylls på över tid precis som ditt liv.
    </p>

    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

    <template v-if="!inParty">
      <p class="hint">Gå ihop med andra spelare och ge er ut på äventyr i den okända världen utanför staden.</p>
      <button type="button" class="join-btn" :disabled="busy" @click="doJoin">
        {{ busy ? 'Går med...' : 'Gå ihop i grupp' }}
      </button>
    </template>

    <template v-else>
      <h2>Gruppen</h2>
      <ul class="member-list">
        <li v-for="m in members" :key="m.userId">
          {{ m.name }} (nivå {{ m.level }})<template v-if="m.isLeader"> - ledare</template>
        </li>
      </ul>
      <button type="button" class="leave-btn" :disabled="busy" @click="doLeave">Lämna gruppen</button>

      <template v-if="party?.status === 'in_event' && party.pendingEvent">
        <h2>{{ party.pendingEvent.name }}</h2>
        <p class="hint">
          En plats av typen "{{ party.pendingEvent.poiType }}" - riktigt innehåll för grottor/ruiner/städer kommer
          senare, för nu kan ni bara fortsätta vidare.
        </p>
        <button type="button" class="move-btn" :disabled="busy" @click="doResolveEvent">Fortsätt</button>
      </template>

      <template v-else>
        <h2>Karta</h2>
        <p class="hint">Position: ({{ party?.x }}, {{ party?.y }})</p>
        <div class="grid">
          <div v-for="(row, ri) in gridRows" :key="ri" class="grid-row">
            <div
              v-for="cell in row"
              :key="`${cell.x},${cell.y}`"
              class="grid-cell"
              :class="{ me: cell.isMe, unknown: !cell.known }"
            >
              <template v-if="cell.isMe">☺</template>
              <template v-else-if="cell.known">{{ TERRAIN_SYMBOLS[cell.known.terrain] ?? '?' }}</template>
              <template v-else>?</template>
            </div>
          </div>
        </div>

        <h2 v-if="isLeader">Bege er vidare</h2>
        <div v-if="isLeader" class="compass">
          <button type="button" :disabled="busy" @click="doMove('n')">{{ DIRECTION_LABELS.n }}</button>
          <div class="compass-row">
            <button type="button" :disabled="busy" @click="doMove('w')">{{ DIRECTION_LABELS.w }}</button>
            <button type="button" :disabled="busy" @click="doMove('e')">{{ DIRECTION_LABELS.e }}</button>
          </div>
          <button type="button" :disabled="busy" @click="doMove('s')">{{ DIRECTION_LABELS.s }}</button>
        </div>
        <p v-else class="hint">Bara ledaren kan styra vart gruppen ger sig av.</p>

        <p v-if="lastEventText" class="event-text">{{ lastEventText }}</p>
        <div v-if="lastBattle" class="battle-result">
          <p class="summary">
            {{ lastBattle.winningSide === 'a' ? 'Ni' : 'Fienderna' }} vann striden ({{ lastBattle.rounds }} rundor)
          </p>
          <BattleLog :log="lastBattle.log" :viewer-name="character.name" />
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
h2 {
  color: var(--accent-strong);
  font-size: 1.05rem;
  margin: 1.25rem 0 0.75rem;
}

.error {
  color: var(--orange);
  font-size: 0.9rem;
}

.join-btn,
.move-btn {
  background: var(--accent);
  border: none;
  border-radius: 4px;
  padding: 0.7rem 1.4rem;
  color: var(--text-inverse);
  font-size: 1rem;
  cursor: pointer;
}

.join-btn:hover:not(:disabled),
.move-btn:hover:not(:disabled) {
  background: var(--accent-hover);
}

.join-btn:disabled,
.move-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.member-list {
  list-style: none;
  padding: 0;
  margin: 0 0 1rem;
  color: var(--text);
  font-size: 0.9rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.leave-btn {
  background: transparent;
  border: 1px solid var(--red);
  border-radius: 4px;
  padding: 0.5rem 1rem;
  color: var(--red);
  font-size: 0.85rem;
  cursor: pointer;
}

.leave-btn:hover:not(:disabled) {
  background: var(--red);
  color: var(--text-inverse);
}

.grid {
  display: inline-flex;
  flex-direction: column;
  background: var(--bg);
  border: 1px solid var(--border-soft);
  border-radius: 4px;
  padding: 0.5rem;
  margin-bottom: 1rem;
}

.grid-row {
  display: flex;
}

.grid-cell {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
  color: var(--text-muted);
}

.grid-cell.unknown {
  color: var(--border-soft);
}

.grid-cell.me {
  color: var(--accent-strong);
  font-weight: bold;
}

.compass {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 1rem;
}

.compass-row {
  display: flex;
  gap: 2.5rem;
}

.compass button {
  background: var(--accent);
  border: none;
  border-radius: 4px;
  padding: 0.5rem 1rem;
  color: var(--text-inverse);
  cursor: pointer;
}

.compass button:hover:not(:disabled) {
  background: var(--accent-hover);
}

.compass button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.event-text {
  color: var(--accent-strong);
  font-weight: bold;
}

.battle-result {
  margin-top: 1rem;
}

.summary {
  color: var(--text-muted);
}
</style>
