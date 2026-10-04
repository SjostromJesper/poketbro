<script setup lang="ts">
import type { BattlerView } from '~~/nudge/game/battleView'
import { hpColor, STAT_NAMES, STATUS_LABELS, TYPE_COLORS, TYPE_LABELS } from '../ui'
import AtbBar from './AtbBar.vue'

defineProps<{
  battler: BattlerView
  /** Show HP numbers (own Pokémon) instead of just the bar. */
  numbers?: boolean
}>()
</script>

<template>
  <div class="panel px-panel">
    <div class="head">
      <span class="name">{{ battler.name }}</span>
      <span class="lvl">Lv{{ battler.level }}</span>
    </div>
    <div class="chips">
      <span v-for="t in battler.types" :key="t" class="chip" :style="{ background: TYPE_COLORS[t] }">{{ TYPE_LABELS[t] }}</span>
      <span v-if="battler.status" class="chip" :style="{ background: STATUS_LABELS[battler.status].color }" :title="STATUS_LABELS[battler.status].title">
        {{ STATUS_LABELS[battler.status].short }}
      </span>
      <span v-if="battler.confused" class="chip alt" title="Förvirrad">CNF</span>
      <span v-if="battler.seeded" class="chip alt" title="Sådd (Leech Seed)">SEED</span>
      <span v-if="battler.protectedNow" class="chip alt" title="Skyddar sig">PROT</span>
      <span v-if="battler.napping" class="chip alt" title="Tupplur">ZZZ</span>
    </div>
    <div class="hp-row">
      <span class="label">HP</span>
      <div class="hp-track">
        <div class="hp-fill" :style="{ width: `${battler.hpPct}%`, background: hpColor(battler.hpPct) }" />
      </div>
    </div>
    <div v-if="numbers" class="numbers">{{ battler.hp }} / {{ battler.maxHp }}</div>
    <div class="atb-row">
      <span class="label">ATB</span>
      <AtbBar :pct="battler.atbPct" :charging="!!battler.charging" :stalled="battler.status === 'sleep' || battler.status === 'freeze' || battler.napping" />
    </div>
    <div v-if="battler.charging" class="charging">Laddar: {{ battler.charging.moveName }}...</div>
    <div v-if="battler.stages.length" class="stages">
      <span v-for="s in battler.stages" :key="s.stat" class="stage" :class="{ up: s.stage > 0, down: s.stage < 0 }">
        {{ STAT_NAMES[s.stat] }}{{ s.stage > 0 ? '+' : '' }}{{ s.stage }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.panel {
  width: 250px;
  padding: 8px 10px 8px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
}

.name {
  font-family: 'Press Start 2P', monospace;
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lvl {
  font-family: 'Press Start 2P', monospace;
  font-size: 9px;
  color: #ffd840;
  white-space: nowrap;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  min-height: 18px;
}

.chip {
  font-size: 11px;
  line-height: 1;
  padding: 3px 5px;
  color: #0a0f16;
  border: 2px solid #0a0f16;
  font-weight: 600;
}

.chip.alt {
  background: #8a9ab8;
}

.hp-row,
.atb-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.label {
  font-family: 'Press Start 2P', monospace;
  font-size: 8px;
  color: #ffb84a;
  width: 26px;
}

.hp-track {
  flex: 1;
  height: 10px;
  background: #0a0f16;
  border: 2px solid #0a0f16;
  box-shadow: 0 0 0 1px #35496a;
}

.hp-fill {
  height: 100%;
  transition: width 0.5s ease-out, background 0.3s;
}

.atb-row > :last-child {
  flex: 1;
}

.numbers {
  text-align: right;
  font-size: 14px;
  color: #cfd9e8;
}

.charging {
  font-size: 13px;
  color: #e8a0ff;
  animation: blink 0.8s steps(2) infinite;
}

.stages {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.stage {
  font-size: 11px;
  padding: 1px 4px;
  border: 1px solid #35496a;
}

.stage.up {
  color: #7ee07e;
}

.stage.down {
  color: #ff8a8a;
}

@keyframes blink {
  50% { opacity: 0.4; }
}
</style>
