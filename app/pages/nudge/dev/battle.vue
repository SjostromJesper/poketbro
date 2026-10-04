<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from '#imports'
import { gameData } from '~~/nudge/data'
import { BALANCE, type TraitId } from '~~/nudge/engine/balance'
import { createPokemon, displayNameOf } from '~~/nudge/engine/pokemon'
import { applyBattleOutcome, type OutcomeApplication } from '~~/nudge/engine/progression'
import { createRng } from '~~/nudge/engine/rng'
import type { BattleKind, BattleOutcome, OwnedPokemon } from '~~/nudge/engine/types'
import BattleScene from '~/components/nudge/battle/BattleScene.vue'
import NudgeFrame from '~/components/nudge/NudgeFrame.vue'
import { battleMusic } from '~~/nudge/game/music'
import { useAudioStore } from '~/stores/nudge/audio'
import { useBattleStore } from '~/stores/nudge/battle'
import { useSettingsStore } from '~/stores/nudge/settings'

interface Row {
  speciesId: number
  level: number
  trait: TraitId | 'random'
  nature: string
  trust: number
  heldItem: string
  /** Gives the Pokémon its strongest attack as a favorite move. */
  favorite?: boolean
}

const route = useRoute()
const store = useBattleStore()
const audio = useAudioStore()
const battle = store
const settings = useSettingsStore()

const speciesOptions = Object.values(gameData.species).map(s => ({ id: s.id, label: `#${s.id} ${s.displayName}` }))
const natureOptions = Object.values(gameData.natures)
const traitOptions = Object.entries(BALANCE.TRAITS).map(([id, def]) => ({ id: id as TraitId, label: def.label }))
const heldItems = ['', 'oran-berry', 'quick-claw', 'silk-scarf', 'charcoal', 'mystic-water', 'leftovers']

const row = (speciesId: number, level: number, trust = 120): Row => ({ speciesId, level, trait: 'random', nature: 'random', trust, heldItem: '' })

const playerRows = reactive<Row[]>([row(4, 12)])
const enemyRows = reactive<Row[]>([row(74, 10, 100)])
const kind = ref<BattleKind>('wild')
const badges = ref(0)
const seedText = ref('')
const debug = ref(false)

const running = ref(false)
let partySnapshot: OwnedPokemon[] = []
const summary = ref<string[]>([])
const lastOutcome = ref<BattleOutcome | null>(null)

/** "bulbasaur:46,pidgey:10" -> rows (used by the optional ?p=...&e=...&go=1 shortcut for quick testing). */
function rowsFromQuery(value: unknown): Row[] | null {
  if (typeof value !== 'string' || !value) return null
  const rows: Row[] = []
  for (const part of value.split(',')) {
    const [name, level] = part.split(':')
    const species = Object.values(gameData.species).find(s => s.name === name.toLowerCase())
    if (species) rows.push(row(species.id, Number(level) || 5))
  }
  return rows.length ? rows : null
}

onMounted(() => {
  settings.load()
  debug.value = route.query.debug === '1'
  const p = rowsFromQuery(route.query.p)
  const e = rowsFromQuery(route.query.e)
  if (p) playerRows.splice(0, playerRows.length, ...p)
  if (e) enemyRows.splice(0, enemyRows.length, ...e)
  if (route.query.kind === 'trainer' || route.query.kind === 'wild') kind.value = route.query.kind
  if (route.query.badges) badges.value = Number(route.query.badges) || 0
  if (route.query.seed) seedText.value = String(route.query.seed)
  if (route.query.go === '1') start()
  // Dev shortcut to preview the catch animation: ?throw=ultra-ball
  if (typeof route.query.throw === 'string' && route.query.go === '1') {
    const ball = route.query.throw
    setTimeout(() => { battle.engine && (battle.engine.active('enemy').hp = 1); battle.act({ type: 'ball', ball }) }, 600)
  }
})

function addRow(rows: Row[]) {
  if (rows.length < 6) rows.push(row(25, 5))
}

function removeRow(rows: Row[], index: number) {
  if (rows.length > 1) rows.splice(index, 1)
}

function build(rows: Row[], rng: ReturnType<typeof createRng>, owner: string): OwnedPokemon[] {
  return rows.map((r) => {
    const pokemon = makePokemon(r, rng, owner)
    if (r.favorite) {
      const best = pokemon.moves.filter(m => gameData.moves[m.move]?.power).sort((a, b) => (gameData.moves[b.move].power ?? 0) - (gameData.moves[a.move].power ?? 0))[0]
      if (best) pokemon.favoriteMove = best.move
    }
    return pokemon
  })
}

function makePokemon(r: Row, rng: ReturnType<typeof createRng>, owner: string): OwnedPokemon {
  return createPokemon({
    data: gameData,
    balance: BALANCE,
    rng,
    speciesId: Number(r.speciesId),
    level: Math.max(1, Math.min(100, Math.round(Number(r.level)))),
    trust: Math.max(0, Math.min(255, Number(r.trust))),
    trait: r.trait === 'random' ? undefined : r.trait,
    nature: r.nature === 'random' ? undefined : r.nature,
    heldItem: r.heldItem || undefined,
    originalTrainer: owner,
  })
}

function start() {
  const seed = seedText.value.trim() ? Number(seedText.value) : Math.floor(Math.random() * 0xFFFFFFFF)
  const rng = createRng(seed)
  const player = build(playerRows, rng, 'dev')
  const enemy = build(enemyRows, rng, kind.value === 'trainer' ? 'Motståndare' : 'wild')
  // The engine mutates copies; keep our own party for applying the outcome afterwards.
  partySnapshot = JSON.parse(JSON.stringify(player)) as OwnedPokemon[]
  store.debug = debug.value
  audio.music(battleMusic(kind.value))
  store.start({ player, enemy, kind: kind.value, badges: badges.value, seed })
  summary.value = []
  lastOutcome.value = null
  running.value = true
}

function finished(outcome: BattleOutcome | null) {
  lastOutcome.value = outcome
  const lines: string[] = []
  if (outcome) {
    const result: OutcomeApplication = applyBattleOutcome(gameData, BALANCE, partySnapshot, outcome)
    for (const info of result.levelUps) {
      const p = partySnapshot.find(x => x.uid === info.uid)
      const name = p ? displayNameOf(gameData, p) : '?'
      lines.push(`${name}: nivå ${info.from} -> ${info.to}${info.learned.length ? `, lärde sig ${info.learned.join(', ')}` : ''}${info.pendingMoves.length ? `, vill lära sig ${info.pendingMoves.join(', ')}` : ''}${info.evolveTo ? `, kan utvecklas till #${info.evolveTo}` : ''}`)
    }
    for (const p of partySnapshot) {
      const habits = Object.entries(p.habits).map(([m, n]) => `${m} ${n}`).join(', ')
      lines.push(`${displayNameOf(gameData, p)}: förtroende ${p.trust}${habits ? `, vanor: ${habits}` : ''}`)
    }
    if (outcome.caught) lines.push(`Fångade ${displayNameOf(gameData, outcome.caught)} Lv${outcome.caught.level}!`)
  }
  summary.value = lines
  running.value = false
  store.end()
}

const hasSummary = computed(() => summary.value.length > 0)
</script>

<template>
  <NudgeFrame>
    <main class="dev">
      <h1 class="px-title">Nudge - teststrid</h1>

      <section v-if="!running" class="setup">
        <p class="intro">
          Utvecklingssida för stridsskärmen. Välj Pokémon och starta. Tips: lägg <code>?debug=1</code> i adressen (eller tryck D i striden)
          för att se sannolikheterna live.
        </p>

        <div class="teams">
          <div v-for="(rows, title) in { 'Din sida': playerRows, 'Motståndare': enemyRows }" :key="title" class="px-panel team">
            <h2 class="px-title">{{ title }}</h2>
            <div v-for="(r, i) in rows" :key="i" class="member">
              <select v-model.number="r.speciesId" aria-label="Art">
                <option v-for="s in speciesOptions" :key="s.id" :value="s.id">{{ s.label }}</option>
              </select>
              <label>Lv <input v-model.number="r.level" type="number" min="1" max="100"></label>
              <label>
                Drag
                <select v-model="r.trait">
                  <option value="random">Slumpa</option>
                  <option v-for="t in traitOptions" :key="t.id" :value="t.id">{{ t.label }}</option>
                </select>
              </label>
              <label>
                Natur
                <select v-model="r.nature">
                  <option value="random">Slumpa</option>
                  <option v-for="n in natureOptions" :key="n.name" :value="n.name">{{ n.displayName }}</option>
                </select>
              </label>
              <label>
                Trust {{ r.trust }}
                <input v-model.number="r.trust" type="range" min="0" max="255">
              </label>
              <label>
                Item
                <select v-model="r.heldItem">
                  <option v-for="item in heldItems" :key="item" :value="item">{{ item ? gameData.items[item]?.displayName ?? item : '-' }}</option>
                </select>
              </label>
              <label style="flex-direction: row; align-items: center; white-space: nowrap; gap: 4px"><input v-model="r.favorite" type="checkbox"> ♥ Favorit</label>
              <button type="button" class="px-btn small" :disabled="rows.length <= 1" @click="removeRow(rows, i)">X</button>
            </div>
            <button type="button" class="px-btn small" :disabled="rows.length >= 6" @click="addRow(rows)">+ Lägg till</button>
          </div>
        </div>

        <div class="px-panel options">
          <label>
            Typ
            <select v-model="kind">
              <option value="wild">Vild Pokémon</option>
              <option value="trainer">Tränare</option>
            </select>
          </label>
          <label>Märken <input v-model.number="badges" type="number" min="0" max="8"></label>
          <label>Seed <input v-model="seedText" type="text" placeholder="slumpas"></label>
          <label class="check"><input v-model="debug" type="checkbox"> Debug-overlay</label>
          <button type="button" class="px-btn primary" @click="start">Starta strid</button>
        </div>

        <div v-if="hasSummary" class="px-panel summary">
          <h2 class="px-title">Efter striden</h2>
          <p v-for="line in summary" :key="line">{{ line }}</p>
        </div>
      </section>

      <BattleScene v-else :bag="null" @finished="finished" />
    </main>
  </NudgeFrame>
</template>

<style scoped>
.dev {
  max-width: 1000px;
  margin: 0 auto;
  padding: 16px;
}

h1 {
  font-size: 16px;
  margin: 4px 0 14px;
}

h2 {
  font-size: 11px;
  margin: 0 0 8px;
}

.intro {
  color: #9fb2cc;
  margin: 0 0 12px;
}

code {
  background: #0a0f16;
  padding: 1px 5px;
}

.teams {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

.team {
  padding: 12px;
}

.member {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 8px 12px;
  padding: 8px 0;
  border-bottom: 1px dashed #35496a;
}

label {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 13px;
  color: #9fb2cc;
}

input[type='number'] {
  width: 64px;
}

input,
select {
  background: #0a0f16;
  color: #eef2f7;
  border: 2px solid #35496a;
  font-family: inherit;
  font-size: 15px;
  padding: 3px 6px;
}

.options {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 12px 18px;
  padding: 12px;
  margin-top: 12px;
}

.check {
  flex-direction: row;
  align-items: center;
  gap: 6px;
}

.summary {
  margin-top: 12px;
  padding: 12px;
}

.summary p {
  margin: 2px 0;
}

.small {
  padding: 6px 8px;
}
</style>
