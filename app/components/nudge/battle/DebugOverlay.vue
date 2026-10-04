<script setup lang="ts">
import type { BattlerView, BattleView } from '~~/nudge/game/battleView'
import type { ChoiceDebug } from '~~/nudge/engine/types'
import { BALANCE } from '~~/nudge/engine/balance'
import { favoriteThreshold } from '~~/nudge/engine/favorite'
import { CATEGORY_LABELS } from '../ui'

defineProps<{ view: BattleView }>()

const pct = (value: number) => `${(value * 100).toFixed(1)}%`

function rows(battler: BattlerView, debug: ChoiceDebug) {
  const threshold = favoriteThreshold(battler.trait, BALANCE)
  return debug.moves.map(m => ({ ...m, name: battler.moves[m.moveIndex]?.name ?? m.move, nudged: debug.nudgedMoveIndex === m.moveIndex, progress: battler.habits[m.move] ?? 0, threshold }))
}
</script>

<template>
  <div v-if="view.debug" class="debug">
    <div v-if="view.captureChances" class="capture-line">
      Fångstchans nu: Poké Ball <b>{{ pct(view.captureChances['poke-ball']) }}</b> &middot; Great Ball <b>{{ pct(view.captureChances['great-ball']) }}</b>
      &middot; Ultra Ball <b>{{ pct(view.captureChances['ultra-ball']) }}</b>
    </div>
    <div v-for="side in (['player', 'enemy'] as const)" :key="side" class="block">
      <div class="title">
        {{ side === 'player' ? 'SPELARE' : 'MOTSTÅNDARE' }}: {{ view[side].name }} Lv{{ view[side].level }}
      </div>
      <div class="kv">
        <span>trait <b>{{ BALANCE.TRAITS[view[side].trait].label }}</b></span>
        <span>nature <b>{{ view[side].nature }}</b></span>
        <span>trust <b>{{ view[side].trust }}</b></span>
        <span>smart <b>{{ view.debug[side].smart.toFixed(2) }}</b></span>
      </div>
      <div class="kv">
        <span>ATB <b>{{ view[side].atb.toFixed(0) }}/{{ BALANCE.ATB_MAX }}</b></span>
        <span>fyll/s <b>{{ view[side].fillPerSec.toFixed(0) }}</b></span>
        <span>eff. speed <b>{{ view[side].effectiveSpeed.toFixed(0) }}</b></span>
        <span>HP <b>{{ view[side].hp }}/{{ view[side].maxHp }}</b></span>
      </div>
      <div v-if="side === 'player'" class="kv">
        <span>nudge-budget <b>{{ view.player.nudge.used }}/{{ view.player.nudge.budget }}</b> använda</span>
        <span v-if="view.player.nudge.pending">
          väntande: <b>{{ view.player.moves[view.player.nudge.pending.moveIndex]?.name }}</b>
          styrka <b>{{ view.player.nudge.pending.strength.toFixed(2) }}</b>
        </span>
        <span v-else>väntande: -</span>
      </div>
      <div class="kv cats">
        <span v-for="(w, c) in view.debug[side].categoryWeights" :key="c">{{ CATEGORY_LABELS[c] }} {{ pct(w) }}</span>
      </div>
      <table>
        <thead>
          <tr><th>move</th><th>kat.</th><th>p_auto</th><th>p_final</th><th>skada~</th><th>♥</th></tr>
        </thead>
        <tbody>
          <tr v-for="row in rows(view[side], view.debug[side])" :key="row.moveIndex" :class="{ nudged: row.nudged }">
            <td>{{ row.name }}</td>
            <td>{{ CATEGORY_LABELS[row.category] }}</td>
            <td>
              <span class="bar"><i :style="{ width: pct(row.pAuto) }" /></span>{{ pct(row.pAuto) }}
            </td>
            <td>
              <span class="bar final"><i :style="{ width: pct(row.pFinal) }" /></span>{{ pct(row.pFinal) }}
            </td>
            <td>{{ row.expectedDamage ? row.expectedDamage.toFixed(1) : '-' }}</td>
            <td>{{ row.favorite ? `♥ ×${row.favoriteMult.toFixed(2)}` : `${row.progress}/${row.threshold}` }}</td>
          </tr>
          <tr v-if="view.debug[side].struggle"><td colspan="6">Struggle (ingen PP kvar)</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.debug {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 10px;
  font-size: 13px;
  font-family: 'Courier New', monospace;
  background: rgba(0, 0, 0, 0.55);
  border: 2px dashed #ffd840;
  padding: 8px;
}

.capture-line {
  grid-column: 1 / -1;
  color: #b8c6dc;
}

.capture-line b {
  color: #7ee07e;
}

.title {
  color: #ffd840;
  margin-bottom: 4px;
}

.kv {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  color: #b8c6dc;
}

.kv b {
  color: #fff;
}

.cats {
  margin: 2px 0 4px;
  color: #8fa4c4;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th {
  text-align: left;
  color: #8fa4c4;
  font-weight: normal;
}

td, th {
  padding: 1px 4px;
  white-space: nowrap;
}

tr.nudged td:first-child {
  color: #ffd840;
}

.bar {
  display: inline-block;
  width: 56px;
  height: 7px;
  background: #1a2536;
  margin-right: 6px;
  vertical-align: middle;
}

.bar i {
  display: block;
  height: 100%;
  background: #5aa0ff;
}

.bar.final i {
  background: #ffd840;
}
</style>
