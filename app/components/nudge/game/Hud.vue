<script setup lang="ts">
import { gameData } from '~~/nudge/data'
import { maxHpOf } from '~~/nudge/engine/pokemon'
import { usePlayerStore } from '~/stores/nudge/player'
import { useSavesStore } from '~/stores/nudge/saves'
import { hpColor } from '../ui'

const player = usePlayerStore()
const saves = useSavesStore()
</script>

<template>
  <div class="hud px-panel">
    <div class="line">
      <span class="money">{{ player.money }} kr</span>
      <span class="badges" title="Märken">★ {{ player.badges.length }}</span>
      <span v-if="saves.needsAttention" class="cloud" :title="saves.state === 'conflict' ? 'Olika sparfiler' : 'Ej synkad med molnet (sparat här)'">☁✗</span>
    </div>
    <div v-for="p in player.party" :key="p.uid" class="mon" :class="{ out: p.currentHp <= 0 }">
      <img :src="gameData.species[p.speciesId].sprites.icon" alt="" draggable="false">
      <span class="lv">{{ p.level }}</span>
      <i class="bar"><b :style="{ width: `${(p.currentHp / maxHpOf(gameData, p)) * 100}%`, background: hpColor((p.currentHp / maxHpOf(gameData, p)) * 100) }" /></i>
    </div>
  </div>
</template>

<style scoped>
.hud {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 14px;
  z-index: 4;
  min-width: 118px;
}

.line {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  color: #ffd840;
}

.cloud {
  color: #ffb84a;
  font-size: 12px;
}

.mon {
  display: flex;
  align-items: center;
  gap: 4px;
}

.mon img {
  width: 28px;
  height: 28px;
  image-rendering: pixelated;
}

.mon.out img {
  opacity: 0.35;
  filter: grayscale(1);
}

.lv {
  font-size: 11px;
  color: #eadcb8;
  width: 18px;
}

.bar {
  flex: 1;
  height: 5px;
  background: #2a1c12;
}

.bar b {
  display: block;
  height: 100%;
}
</style>
