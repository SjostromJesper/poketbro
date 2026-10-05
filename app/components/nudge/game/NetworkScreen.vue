<script setup lang="ts">
// The network menu of the computer in the Pokémon Center (PLAN-4 2.7): bracket matches, challenges and the inbox. Everything that changes something goes
// through the server (the Edge Functions), which validates the teams and plays the matches.
import { computed, onMounted, ref } from 'vue'
import { formatPlayer, parseTag } from '~~/nudge/game/account'
import { BRACKET_IDS, bracketLabel, FREE_BRACKET } from '~~/nudge/server/brackets'
import { describeMine, ladderLine, LADDER_PAGE_SIZE, pageOfPosition, rankLabel, type LadderRow } from '~~/nudge/game/standings'
import { challengeSentLines, describeInboxChallenge, describeInboxMatch, eligibleCount, errorLines, OFFLINE_MESSAGE, respondLines, submitLines, type ServerError } from '~~/nudge/game/network'
import { snapshotOf, type PokemonSnapshot } from '~~/nudge/server/snapshot'
import type { PublicProfile } from '~~/nudge/server/handlers'
import { useNetworkStore } from '~/stores/nudge/network'
import { usePlayerStore } from '~/stores/nudge/player'
import ReplayScene from '~/components/nudge/battle/ReplayScene.vue'
import type { ReplayData } from '~/stores/nudge/network'
import TeamPicker from './TeamPicker.vue'

const emit = defineEmits<{ (e: 'back'): void }>()
const network = useNetworkStore()
const player = usePlayerStore()

type View = 'menu' | 'standings' | 'ladder' | 'replays' | 'bracket' | 'team' | 'result' | 'id' | 'confirm' | 'challenge-bracket' | 'inbox' | 'answer'
const view = ref<View>('menu')
/** What the team picker is for. */
const purpose = ref<{ kind: 'bracket' | 'challenge' | 'answer', bracket: string, target?: PublicProfile, challengeId?: string }>({ kind: 'bracket', bracket: '' })
const idText = ref('')
const found = ref<PublicProfile | null>(null)
const lines = ref<string[]>([])
const busy = ref(false)
const replay = ref<ReplayData | null>(null)
const ladderBracket = ref('')
const ladder = ref<LadderRow[]>([])
const ladderPage = ref(0)
const mine = ref<{ row: LadderRow | null, placed: number, total: number } | null>(null)
const lastMatchId = ref<string | null>(null)
const page = ref(0)
const PAGE_SIZE = 10
const pageCount = computed(() => Math.max(1, Math.ceil(network.matches.length / PAGE_SIZE)))
const pageMatches = computed(() => network.matches.slice(page.value * PAGE_SIZE, (page.value + 1) * PAGE_SIZE))

const allPokemon = computed(() => [...player.party, ...player.box])
const online = computed(() => network.online)

onMounted(() => void network.refresh())

function show(result: string[], matchId: string | null = null) {
  lines.value = result
  lastMatchId.value = matchId
  view.value = 'result'
}

async function watch(matchId: string) {
  busy.value = true
  const data = await network.loadReplay(matchId)
  busy.value = false
  if (!data) return show(['Reprisen kunde inte hämtas.'])
  replay.value = data
}

async function openLadder(bracket: string, page?: number) {
  ladderBracket.value = bracket
  view.value = 'ladder'
  busy.value = true
  const standing = await network.loadMyStanding(bracket)
  if (standing === undefined) {
    busy.value = false
    return show([OFFLINE_MESSAGE])
  }
  mine.value = standing
  ladderPage.value = page ?? (standing.row ? pageOfPosition(standing.row.position) : 0)
  await loadLadderPage()
}

async function loadLadderPage() {
  busy.value = true
  const rows = await network.loadLadder(ladderBracket.value, ladderPage.value)
  busy.value = false
  if (rows === null) return show([OFFLINE_MESSAGE])
  ladder.value = rows
}

async function turnLadder(step: number) {
  ladderPage.value = Math.max(0, ladderPage.value + step)
  await loadLadderPage()
}

async function jumpToMe() {
  if (!mine.value?.row) return
  ladderPage.value = pageOfPosition(mine.value.row.position)
  await loadLadderPage()
}

function openReplays() {
  page.value = 0
  view.value = 'replays'
  void network.refresh()
}

function snapshots(uids: string[]): PokemonSnapshot[] {
  return uids.map(uid => snapshotOf(player.findPokemon(uid)!))
}

function startBracket(bracket: string) {
  purpose.value = { kind: 'bracket', bracket }
  view.value = 'team'
}

async function lookUp() {
  const tag = parseTag(idText.value)
  if (tag === null) return show(['Ogiltigt spelar-ID. Ett ID är fyra eller fem siffror, till exempel #1452.'])
  busy.value = true
  const result = await network.findPlayer(tag)
  busy.value = false
  if (result === 'offline') return show([OFFLINE_MESSAGE])
  if (!result) return show([`Ingen spelare har ID #${tag}.`])
  found.value = result
  view.value = 'confirm'
}

function chooseChallengeBracket(bracket: string) {
  purpose.value = { kind: 'challenge', bracket, target: found.value! }
  view.value = 'team'
}

async function confirmTeam(uids: string[]) {
  const p = purpose.value
  busy.value = true
  const team = snapshots(uids)
  if (p.kind === 'bracket') {
    const result = await network.submitBracket(p.bracket, team)
    show(submitLines(result as never), result.ok && 'status' in result && result.status === 'played' ? result.matchId : null)
  }
  else if (p.kind === 'challenge') show(challengeSentLines(await network.sendChallenge(p.target!.tag, p.bracket, team) as never))
  else {
    const result = await network.respond(p.challengeId!, true, team)
    show(respondLines(result as never), result.ok && 'status' in result && result.status === 'accepted' ? result.matchId : null)
    void network.refresh()
  }
  busy.value = false
}

async function decline(id: string) {
  busy.value = true
  const result = await network.respond(id, false)
  busy.value = false
  show((result as ServerError).ok === false ? errorLines(result as ServerError) : respondLines(result as never))
  void network.refresh()
}

function answer(id: string, bracket: string) {
  purpose.value = { kind: 'answer', bracket, challengeId: id }
  view.value = 'team'
}

function openInbox() {
  view.value = 'inbox'
  void network.refresh().then(() => network.markSeen())
}

const when = (ms: number) => new Date(ms).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })
</script>

<template>
  <div class="network">
    <h2 class="px-title">Nätverk</h2>

    <p v-if="!online" class="offline">{{ OFFLINE_MESSAGE }}</p>

    <template v-else-if="view === 'menu'">
      <div class="menu">
        <button type="button" class="px-btn" @click="view = 'bracket'">Bracket</button>
        <button type="button" class="px-btn" @click="idText = ''; view = 'id'">Utmana</button>
        <button type="button" class="px-btn" @click="openInbox">Inkorg<span v-if="network.unseen" class="dot">{{ network.unseen }}</span></button>
        <button type="button" class="px-btn" @click="openReplays">Repriser</button>
        <button type="button" class="px-btn" @click="view = 'standings'">Standings</button>
      </div>
    </template>

    <template v-else-if="view === 'bracket'">
      <p class="hint">Välj nivågräns. Ditt lag möter någon med ungefär samma rating, och matchen spelas av servern.</p>
      <div class="brackets">
        <button v-for="b in BRACKET_IDS" :key="b" type="button" class="px-btn" :disabled="eligibleCount(allPokemon, b) < 3" @click="startBracket(b)">
          {{ bracketLabel(b) }}<small>{{ eligibleCount(allPokemon, b) }} passar</small>
        </button>
      </div>
      <button type="button" class="px-btn" @click="view = 'menu'">Tillbaka</button>
    </template>

    <template v-else-if="view === 'id'">
      <p class="hint">Skriv ID:t på spelaren du vill utmana, till exempel #1452.</p>
      <form class="idform" @submit.prevent="lookUp">
        <input v-model="idText" type="text" inputmode="numeric" placeholder="#1452" maxlength="8" aria-label="Spelar-ID">
        <button type="submit" class="px-btn primary" :disabled="!idText.trim() || busy">Sök</button>
      </form>
      <button type="button" class="px-btn" @click="view = 'menu'">Tillbaka</button>
    </template>

    <template v-else-if="view === 'confirm' && found">
      <p class="big">Utmana {{ formatPlayer(found) }}?</p>
      <div class="menu">
        <button type="button" class="px-btn primary" @click="view = 'challenge-bracket'">Ja</button>
        <button type="button" class="px-btn" @click="view = 'id'">Nej</button>
      </div>
    </template>

    <template v-else-if="view === 'challenge-bracket'">
      <p class="hint">Välj nivågräns för utmaningen, eller Fri utan gräns. Utmaningar ger ingen rating.</p>
      <div class="brackets">
        <button type="button" class="px-btn" :disabled="eligibleCount(allPokemon, FREE_BRACKET) < 3" @click="chooseChallengeBracket(FREE_BRACKET)">{{ bracketLabel(FREE_BRACKET) }}</button>
        <button v-for="b in BRACKET_IDS" :key="b" type="button" class="px-btn" :disabled="eligibleCount(allPokemon, b) < 3" @click="chooseChallengeBracket(b)">
          {{ bracketLabel(b) }}<small>{{ eligibleCount(allPokemon, b) }} passar</small>
        </button>
      </div>
      <button type="button" class="px-btn" @click="view = 'confirm'">Tillbaka</button>
    </template>

    <TeamPicker
      v-else-if="view === 'team'" :bracket="purpose.bracket" :busy="busy"
      :confirm-label="purpose.kind === 'bracket' ? 'Skicka in laget' : purpose.kind === 'challenge' ? 'Skicka utmaningen' : 'Anta utmaningen'"
      @confirm="confirmTeam" @back="view = purpose.kind === 'bracket' ? 'bracket' : purpose.kind === 'challenge' ? 'challenge-bracket' : 'inbox'"
    />

    <template v-else-if="view === 'result'">
      <p v-for="line in lines" :key="line" class="big">{{ line }}</p>
      <div class="menu">
        <button v-if="lastMatchId" type="button" class="px-btn primary" :disabled="busy" @click="watch(lastMatchId)">Se repris</button>
        <button type="button" class="px-btn" :class="{ primary: !lastMatchId }" @click="view = 'menu'">Tillbaka</button>
      </div>
    </template>

    <template v-else-if="view === 'standings'">
      <p class="hint">Välj nivågräns för att se din placering och hela laddern.</p>
      <div class="brackets">
        <button v-for="b in BRACKET_IDS" :key="b" type="button" class="px-btn" @click="openLadder(b)">{{ bracketLabel(b) }}</button>
      </div>
      <button type="button" class="px-btn" @click="view = 'menu'">Tillbaka</button>
    </template>

    <template v-else-if="view === 'ladder'">
      <h3 class="px-title">{{ bracketLabel(ladderBracket) }}</h3>
      <div v-if="mine" class="card mine">
        <span><template v-for="line in describeMine(mine.row, mine.placed)" :key="line">{{ line }}<br></template></span>
        <button v-if="mine.row" type="button" class="px-btn small" :disabled="busy" @click="jumpToMe">Gå till min sida</button>
      </div>
      <p v-if="!busy && ladder.length === 0" class="hint">Ingen har spelat i den här nivågränsen än.</p>
      <table v-if="ladder.length" class="ladder">
        <thead><tr><th>Plats</th><th>Spelare</th><th>Rating</th><th>Matcher</th></tr></thead>
        <tbody>
          <tr v-for="r in ladder" :key="r.userId" :class="{ me: r.userId === mine?.row?.userId, unplaced: r.rank === null }">
            <td>{{ rankLabel(r) }}</td><td>{{ formatPlayer(r) }}</td><td>{{ r.rating }}</td><td>{{ r.games }}</td>
          </tr>
        </tbody>
      </table>
      <div class="menu">
        <button type="button" class="px-btn small" :disabled="ladderPage === 0 || busy" @click="turnLadder(-1)">◀</button>
        <span class="hint">Sida {{ ladderPage + 1 }}<template v-if="mine && mine.total"> av {{ Math.max(1, Math.ceil(mine.total / LADDER_PAGE_SIZE)) }}</template></span>
        <button type="button" class="px-btn small" :disabled="ladder.length < LADDER_PAGE_SIZE || busy" @click="turnLadder(1)">▶</button>
        <button type="button" class="px-btn" @click="view = 'standings'">Tillbaka</button>
      </div>
    </template>

    <template v-else-if="view === 'replays'">
      <h3 class="px-title">Repriser</h3>
      <p v-if="network.matches.length === 0" class="hint">Inga spelade matcher än.</p>
      <div v-for="m in pageMatches" :key="m.id" class="card" :class="m.outcome">
        <span>{{ describeInboxMatch(m) }}<small>{{ when(m.createdAt) }}</small></span>
        <button type="button" class="px-btn small" :disabled="busy" @click="watch(m.id)">Se repris</button>
      </div>
      <div class="menu">
        <button type="button" class="px-btn small" :disabled="page === 0" @click="page--">◀</button>
        <span class="hint">Sida {{ page + 1 }} av {{ pageCount }}</span>
        <button type="button" class="px-btn small" :disabled="page + 1 >= pageCount" @click="page++">▶</button>
        <button type="button" class="px-btn" @click="view = 'menu'">Tillbaka</button>
      </div>
    </template>

    <template v-else-if="view === 'inbox'">
      <h3 class="px-title">Utmaningar till dig</h3>
      <p v-if="network.challenges.length === 0" class="hint">Inga väntande utmaningar.</p>
      <div v-for="c in network.challenges" :key="c.id" class="card">
        <span>{{ describeInboxChallenge(c) }}<small>Går ut {{ when(c.expiresAt) }}</small></span>
        <button type="button" class="px-btn small primary" :disabled="busy || eligibleCount(allPokemon, c.bracket) < 3" :title="eligibleCount(allPokemon, c.bracket) < 3 ? 'Du har inte 3 Pokémon som passar' : ''" @click="answer(c.id, c.bracket)">Anta</button>
        <button type="button" class="px-btn small" :disabled="busy" @click="decline(c.id)">Avböj</button>
      </div>
      <h3 class="px-title">Resultat</h3>
      <p v-if="network.matches.length === 0 && network.declined.length === 0" class="hint">Inga matcher än.</p>
      <div v-for="d in network.declined" :key="d.id" class="card"><span>{{ formatPlayer(d.to) }} avböjde din utmaning ({{ bracketLabel(d.bracket) }})<small>{{ when(d.createdAt) }}</small></span></div>
      <div v-for="m in network.matches.slice(0, 20)" :key="m.id" class="card" :class="m.outcome">
        <span>{{ describeInboxMatch(m) }}<small>{{ when(m.createdAt) }}</small></span>
        <button type="button" class="px-btn small" :disabled="busy" @click="watch(m.id)">Se repris</button>
      </div>
      <button type="button" class="px-btn" @click="view = 'menu'">Tillbaka</button>
    </template>

    <ReplayScene v-if="replay" :replay="replay" @close="replay = null" />

    <button v-if="view === 'menu' || !online" type="button" class="px-btn" @click="emit('back')">Tillbaka till datorn</button>
  </div>
</template>

<style scoped>
.network { display: flex; flex-direction: column; gap: 10px; }
h2 { margin: 0; font-size: 12px; }
h3 { margin: 6px 0 0; font-size: 10px; color: #ffb84a; }
.hint { margin: 0; font-size: 14px; color: #dcc8a0; }
.big { margin: 0; font-size: 19px; }
.offline { margin: 0; font-size: 18px; color: #ffb84a; }
.menu { display: flex; gap: 8px; flex-wrap: wrap; }
.brackets { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 6px; }
.brackets small { display: block; font-size: 11px; color: #dcc8a0; text-transform: none; }
.idform { display: flex; gap: 8px; }
.idform input { font: inherit; font-size: 20px; padding: 6px 8px; width: 160px; background: #fff4dc; color: #2a1c12; border: 3px solid #2a1c12; }
.dot { margin-left: 6px; padding: 0 6px; background: #c8402c; color: #fff4dc; border-radius: 9px; font-size: 12px; }
.card { display: flex; align-items: center; gap: 6px; padding: 6px 8px; background: rgba(0, 0, 0, 0.25); border-left: 4px solid #8a6a44; }
.card span { flex: 1; font-size: 15px; }
.card small { display: block; font-size: 12px; color: #b8a07c; }
.card.mine { border-left-color: #ffd840; }
.ladder { width: 100%; border-collapse: collapse; font-size: 15px; }
.ladder th { text-align: left; color: #ffb84a; font-weight: normal; font-size: 13px; }
.ladder td, .ladder th { padding: 2px 6px; }
.ladder tr.me { background: rgba(255, 216, 64, 0.2); }
.ladder tr.unplaced { color: #b8a07c; }
.card.win { border-left-color: #4ad04a; }
.card.loss { border-left-color: #c8402c; }
</style>
