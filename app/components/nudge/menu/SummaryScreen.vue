<script setup lang="ts">
import { computed, watch } from 'vue'
import { gameData } from '~~/nudge/data'
import { BALANCE } from '~~/nudge/engine/balance'
import { itemInfo } from '~~/nudge/game/items'
import { buildSummary, CATEGORY_LABELS_SV } from '~~/nudge/game/summary'
import { useAudioStore } from '~/stores/nudge/audio'
import { usePlayerStore } from '~/stores/nudge/player'
import { hpColor, TYPE_COLORS, TYPE_LABELS } from '../ui'

const props = defineProps<{ uid: string }>()
const emit = defineEmits<{ (e: 'back'): void, (e: 'select', uid: string): void }>()

const player = usePlayerStore()
const pokemon = computed(() => player.findPokemon(props.uid))
const audio = useAudioStore()
const summary = computed(() => (pokemon.value ? buildSummary(gameData, BALANCE, pokemon.value) : null))
const sprite = computed(() => (summary.value ? gameData.species[summary.value.speciesId].sprites.front : ''))
// The Pokémon cries when its summary opens (and when you flip to the next one).
watch(() => pokemon.value?.uid, () => audio.cry(pokemon.value?.speciesId), { immediate: true })

const index = computed(() => player.party.findIndex(p => p.uid === props.uid))

function go(delta: number) {
  const next = player.party[index.value + delta]
  if (next) emit('select', next.uid)
}
</script>

<template>
  <div v-if="summary" class="screen">
    <div class="head">
      <h2 class="px-title">{{ summary.name }}</h2>
      <div class="nav">
        <button type="button" class="px-btn small" :disabled="index <= 0" @click="go(-1)">◀</button>
        <button type="button" class="px-btn small" :disabled="index < 0 || index >= player.party.length - 1" @click="go(1)">▶</button>
        <button type="button" class="px-btn small" @click="emit('back')">Tillbaka</button>
      </div>
    </div>

    <div class="cols">
      <section class="col px-panel">
        <img :src="sprite" :alt="summary.speciesName" class="sprite" draggable="false">
        <div class="types">
          <i v-for="t in summary.types" :key="t" :style="{ background: TYPE_COLORS[t] }">{{ TYPE_LABELS[t] }}</i>
        </div>
        <p class="line"><b>Art</b> {{ summary.speciesName }} <span class="lv">Lv{{ summary.level }}</span></p>
        <div class="line">
          <b>HP</b>
          <i class="bar"><span :style="{ width: `${(summary.hp / summary.maxHp) * 100}%`, background: hpColor((summary.hp / summary.maxHp) * 100) }" /></i>
          {{ summary.hp }}/{{ summary.maxHp }}
        </div>
        <div v-if="summary.xpProgress" class="line">
          <b>XP</b>
          <i class="bar"><span :style="{ width: `${(summary.xpProgress.current / summary.xpProgress.needed) * 100}%`, background: '#58a8f0' }" /></i>
          {{ summary.xpProgress.current }}/{{ summary.xpProgress.needed }}
        </div>
        <p class="line">
          <b>Förtroende</b>
          <span class="hearts" :title="`${summary.trust} av 255`">
            <template v-for="n in 5" :key="n"><span :class="{ off: n > summary.hearts }">♥</span></template>
          </span>
        </p>
        <p class="line"><b>Drag</b> {{ summary.trait.label }}</p>
        <p class="explain">{{ summary.trait.description }}</p>
        <p class="line"><b>Natur</b> {{ summary.nature.label }}</p>
        <p class="explain">{{ summary.nature.text }}</p>
        <p class="line"><b>Item</b> {{ summary.heldItem ? itemInfo(gameData, summary.heldItem).name : '-' }}</p>
        <p class="line"><b>Fångad av</b> {{ summary.originalTrainer === 'wild' ? 'vild' : summary.originalTrainer }}</p>
      </section>

      <section class="col">
        <div class="px-panel stats">
          <h3 class="px-title">Egenskaper</h3>
          <div v-for="s in summary.stats" :key="s.stat" class="stat" :class="{ up: s.nature > 0, down: s.nature < 0 }">
            <span>{{ s.label }}<template v-if="s.nature > 0"> ▲</template><template v-else-if="s.nature < 0"> ▼</template></span>
            <b>{{ s.value }}</b>
          </div>
        </div>

        <div class="px-panel">
          <h3 class="px-title">Attacker</h3>
          <div v-for="m in summary.moves" :key="m.name" class="move" :style="{ '--type': TYPE_COLORS[m.type] }">
            <div class="mhead">
              <strong>{{ m.name }}<span v-if="m.favorite" class="heart" title="Favoritattack"> ♥</span></strong>
              <span v-if="!m.favorite && m.progressHearts > 0" class="pheart" :title="`Gillar den här attacken: ${m.progressHearts}/5`">{{ '♥'.repeat(m.progressHearts) }}</span>
              <span class="mtype">{{ TYPE_LABELS[m.type] }}</span>
              <span class="mcat">{{ CATEGORY_LABELS_SV[m.category] }}</span>
              <span class="mpp">PP {{ m.pp }}/{{ m.maxPp }}</span>
            </div>
            <div class="mmeta">
              Kraft {{ m.power ?? '-' }} &middot; Träff {{ m.accuracy ?? '-' }}<template v-if="m.habit > 0"> &middot; vana {{ m.habit }}</template>
            </div>
            <div v-for="e in m.effects" :key="e" class="meffect">{{ e }}</div>
          </div>
        </div>

        <div class="px-panel">
          <h3 class="px-title">Vanor</h3>
          <p v-if="summary.favourite" class="fav"><span class="heart">♥</span> Favorit: <b>{{ summary.favourite }}</b></p>
          <p v-else-if="summary.favoriteCooldown > 0" class="explain">Har ingen favorit just nu, men kan få en ny efter några fler strider.</p>
          <p v-else class="explain">Ingen favorit än. Attacker som används i vunna strider blir med tiden lite mer sannolika, och med tillräckligt förtroende kan en bli en favorit. Attacker som den använder för att du knuffade den räknas extra.</p>
          <div v-for="h in summary.habits.slice(0, 4)" :key="h.move" class="habit">
            <span>{{ h.name }}</span><i class="bar"><span :style="{ width: `${Math.min(100, (h.value / summary.favoriteThreshold) * 100)}%` }" /></i><b>{{ h.value }}</b>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.screen {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
  overflow: auto;
}

.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

h2 {
  font-size: 13px;
  margin: 0;
}

h3 {
  font-size: 9px;
  margin: 0 0 6px;
  color: #ffb84a;
}

.nav {
  display: flex;
  gap: 4px;
}

.small {
  padding: 6px 8px;
}

.cols {
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  gap: 8px;
  align-items: start;
}

.col {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
}

section.col:last-child {
  padding: 0;
  background: none;
  border: 0;
  box-shadow: none;
}

.col > .px-panel {
  padding: 8px 10px;
}

.sprite {
  align-self: center;
  height: 110px;
  image-rendering: pixelated;
  object-fit: contain;
  transform: scale(1.5);
  margin: 14px 0 10px;
}

.types {
  display: flex;
  gap: 4px;
  justify-content: center;
}

.types i {
  font-style: normal;
  font-size: 12px;
  padding: 2px 6px;
  color: #2a1c12;
  border: 2px solid #2a1c12;
}

.line {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.line b {
  color: #ffb84a;
  min-width: 78px;
  font-weight: 600;
}

.lv {
  color: #ffd840;
}

.explain {
  margin: -2px 0 2px 86px;
  font-size: 13px;
  color: #dcc8a0;
}

.bar {
  display: inline-block;
  flex: 1;
  height: 8px;
  background: #2a1c12;
  max-width: 150px;
}

.bar span {
  display: block;
  height: 100%;
  background: #ffd840;
}

.hearts {
  color: #ff5a7a;
  letter-spacing: 3px;
  font-size: 18px;
}

.hearts .off {
  color: #8a6a44;
}

.stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px 14px;
}

.stats h3 {
  grid-column: 1 / -1;
}

.stat {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
}

.stat.up { color: #ff9a8a; }
.stat.down { color: #8ab8ff; }

.move {
  padding: 4px 0 4px 8px;
  border-left: 6px solid var(--type);
  margin-bottom: 6px;
}

.mhead {
  display: flex;
  gap: 8px;
  align-items: baseline;
}

.mtype {
  color: var(--type);
  filter: brightness(1.2);
  font-size: 13px;
}

.mcat,
.mpp {
  font-size: 12px;
  color: #dcc8a0;
}

.mpp {
  margin-left: auto;
}

.mmeta {
  font-size: 13px;
  color: #eadcb8;
}

.meffect {
  font-size: 12px;
  color: #c8b088;
}

.fav {
  margin: 0 0 4px;
}

.habit {
  display: grid;
  grid-template-columns: 110px 1fr 24px;
  gap: 8px;
  align-items: center;
  font-size: 13px;
}

.habit .bar {
  max-width: none;
}

@media (max-width: 760px) {
  .cols { grid-template-columns: 1fr; }
}
.heart {
  color: #ff5a7a;
}

.pheart {
  color: #ff9ab0;
  font-size: 9px;
  letter-spacing: 1px;
}
</style>
