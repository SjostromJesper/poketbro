<script setup lang="ts">
// Dev page: simulates an online match locally (autopilot, the same code as the server) and plays it back in the replay scene (/nudge/dev/replay).
import { ref } from 'vue'
import { gameData } from '~~/nudge/data'
import { BALANCE } from '~~/nudge/engine/balance'
import { createPokemon } from '~~/nudge/engine/pokemon'
import { createRng } from '~~/nudge/engine/rng'
import { simulatePvp } from '~~/nudge/server/autopilot'
import { snapshotOf } from '~~/nudge/server/snapshot'
import ReplayScene from '~/components/nudge/battle/ReplayScene.vue'
import NudgeFrame from '~/components/nudge/NudgeFrame.vue'
import type { ReplayData } from '~/stores/nudge/network'

const mk = (id: number, level: number, uid: string) => ({ ...snapshotOf(createPokemon({ data: gameData, balance: BALANCE, rng: createRng(id), speciesId: id, level, trust: 150 })), uid })
const teamA = [mk(6, 40, 'a1'), mk(9, 40, 'a2'), mk(3, 40, 'a3')]
const teamB = [mk(94, 40, 'b1'), mk(65, 40, 'b2'), mk(68, 40, 'b3')]
const result = simulatePvp({ data: gameData, balance: BALANCE, teamA, teamB, seed: 2024 })
const replay: ReplayData = {
  matchId: 'dev', kind: 'bracket', bracket: '40-49', createdAt: Date.now(), result: result.winner, engineVersion: result.engineVersion, playerA: { displayName: 'Anna', tag: 1452 },
  playerB: { displayName: 'Bo', tag: 2210 }, teamA, teamB, events: result.events, ratingChangeA: null, ratingChangeB: null,
}
const open = ref(true)
</script>

<template>
  <NudgeFrame>
    <ReplayScene v-if="open" :replay="replay" @close="open = false" />
    <button v-else type="button" class="px-btn" @click="open = true">Spela upp igen</button>
  </NudgeFrame>
</template>
