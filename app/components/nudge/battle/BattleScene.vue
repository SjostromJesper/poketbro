<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { gameData } from '~~/nudge/data'
import { BALANCE } from '~~/nudge/engine/balance'
import { BALLS } from '~~/nudge/game/items'
import type { BattleOutcome, Side } from '~~/nudge/engine/types'
import { useAudioStore } from '~/stores/nudge/audio'
import { useBattleStore } from '~/stores/nudge/battle'
import AtbBar from './AtbBar.vue'
import BattleBackdrop from './BattleBackdrop.vue'
import BattleLog from './BattleLog.vue'
import BattlerPanel from './BattlerPanel.vue'
import CaptureAnimation from './CaptureAnimation.vue'
import DebugOverlay from './DebugOverlay.vue'
import MoveButton from './MoveButton.vue'
import NudgePips from './NudgePips.vue'
import { hpColor } from '../ui'

const props = defineProps<{
  /** Item counts. `null` = unlimited (dev battles). */
  bag?: Record<string, number> | null
}>()

const emit = defineEmits<{
  (e: 'finished', outcome: BattleOutcome | null): void
  (e: 'item-used', item: string): void
}>()

const store = useBattleStore()
const audio = useAudioStore()
const view = computed(() => store.view)

// ---------------------------------------------------------------------------
// Frame loop and keyboard
// ---------------------------------------------------------------------------

let raf = 0
let last = 0
function loop(now: number) {
  const dt = last ? now - last : 16
  last = now
  store.frame(dt)
  raf = requestAnimationFrame(loop)
}

function onKey(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null
  if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return
  if (menu.value !== 'none' || store.result || store.capturing) return
  if (event.key >= '1' && event.key <= '4') {
    store.nudge(Number(event.key) - 1)
    event.preventDefault()
  } else if (event.key === 'p' || event.key === 'P') {
    store.togglePause()
  } else if (event.key === 'd' || event.key === 'D') {
    store.debug = !store.debug
    store.sync()
  }
}

onMounted(() => {
  raf = requestAnimationFrame(loop)
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('keydown', onKey)
})

// ---------------------------------------------------------------------------
// Sprite animations (Web Animations API, so GIFs are not re-created)
// ---------------------------------------------------------------------------

const spriteEls: Record<Side, HTMLElement | null> = { player: null, enemy: null }
const setSprite = (side: Side) => (el: unknown) => {
  spriteEls[side] = el as HTMLElement | null
  if (side === 'enemy') enemyEl.value = el as HTMLElement | null
  else playerEl.value = el as HTMLElement | null
}

function animate(side: Side, kind: 'lunge' | 'hit' | 'enter' | null) {
  const el = spriteEls[side]
  if (!el || !kind) return
  const scale = 1 / Math.max(1, store.speed)
  const dir = side === 'player' ? 1 : -1
  if (kind === 'lunge') {
    el.animate([
      { transform: 'translate(0, 0)' },
      { transform: `translate(${dir * 46}px, ${-dir * 22}px)`, offset: 0.35 },
      { transform: 'translate(0, 0)' },
    ], { duration: 420 * scale, easing: 'ease-out' })
  } else if (kind === 'hit') {
    el.animate([
      { opacity: 1, transform: 'translate(0, 0)' },
      { opacity: 0.2, transform: `translate(${-dir * 8}px, 0)`, offset: 0.2 },
      { opacity: 1, transform: `translate(${dir * 6}px, 0)`, offset: 0.4 },
      { opacity: 0.4, transform: `translate(${-dir * 4}px, 0)`, offset: 0.6 },
      { opacity: 1, transform: 'translate(0, 0)' },
    ], { duration: 450 * scale, delay: 120 * scale })
  } else {
    el.animate([
      { opacity: 0, transform: 'translateY(40px) scale(0.3)' },
      { opacity: 1, transform: 'translateY(0) scale(1)' },
    ], { duration: 450 * scale, easing: 'ease-out' })
  }
}

watch(() => store.fx.player.nonce, () => animate('player', store.fx.player.anim))
watch(() => store.fx.enemy.nonce, () => animate('enemy', store.fx.enemy.anim))

// ---------------------------------------------------------------------------
// Menus: switch, bag, item target
// ---------------------------------------------------------------------------

const menu = ref<'none' | 'switch' | 'bag' | 'target'>('none')
const pendingItem = ref<string | null>(null)
const message = ref('')

const BAG_ITEMS = ['potion', 'antidote', 'paralyze-heal']
const itemLabel = (item: string) => gameData.items[item]?.displayName ?? item
const itemCount = (item: string): number | null => (props.bag ? (props.bag[item] ?? 0) : null)
const ownedBalls = computed(() => BALLS.filter(id => itemCount(id) === null || (itemCount(id) ?? 0) > 0))
const ballCount = computed(() => BALLS.reduce((sum, id) => sum + (itemCount(id) ?? 0), 0))
const ballMenu = ref(false)
const capturing = computed(() => !!store.capturing)

const locked = computed(() => !!store.result || capturing.value)
const wild = computed(() => view.value?.kind === 'wild')
const ballDisabled = computed(() => locked.value || !wild.value || (view.value?.cooldowns.ballMs ?? 0) > 0 || ownedBalls.value.length === 0)
const runDisabled = computed(() => locked.value || !wild.value)
const switchDisabled = computed(() => locked.value || (view.value?.cooldowns.switchMs ?? 0) > 0 || !(view.value?.team.some(m => !m.fainted && !m.active)))
const bagDisabled = computed(() => locked.value || (view.value?.cooldowns.itemMs ?? 0) > 0)

function say(text: string) {
  message.value = text
  setTimeout(() => { if (message.value === text) message.value = '' }, 1800)
}

function openBalls() {
  // With only one kind of ball there is nothing to choose.
  if (ownedBalls.value.length === 1) throwBall(ownedBalls.value[0])
  else ballMenu.value = !ballMenu.value
}

function throwBall(ball: string) {
  ballMenu.value = false
  const result = store.act({ type: 'ball', ball })
  if (result?.accepted) emit('item-used', ball)
}

// --- catch animation: the scene reacts to the animation's cues ---
const stageEl = ref<HTMLElement | null>(null)
const enemyEl = ref<HTMLElement | null>(null)
const playerEl = ref<HTMLElement | null>(null)
const enemyHidden = ref(false)

function onThrow() {
  audio.sfx('ballThrow')
}

function onShake() {
  audio.sfx('ballShake')
}

function onResult(caught: boolean) {
  if (caught) audio.sfx('ballClick')
}

function onAbsorb() {
  audio.sfx('ballOpen')
  const el = spriteEls.enemy
  const scale = 1 / Math.max(1, store.speed)
  el?.animate([
    { filter: 'brightness(1)', transform: 'scale(1)', opacity: 1 },
    { filter: 'brightness(8)', transform: 'scale(0.8)', opacity: 1, offset: 0.35 },
    { filter: 'brightness(8)', transform: 'scale(0)', opacity: 0 },
  ], { duration: Math.max(260, 450 * scale), fill: 'forwards' })
  setTimeout(() => { enemyHidden.value = true }, Math.max(260, 450 * scale))
}

function onRelease() {
  audio.sfx('ballBreak')
  const el = spriteEls.enemy
  enemyHidden.value = false
  el?.getAnimations().forEach(a => a.cancel())
  el?.animate([
    { filter: 'brightness(8)', transform: 'scale(0)', opacity: 0 },
    { filter: 'brightness(3)', transform: 'scale(1.1)', opacity: 1, offset: 0.6 },
    { filter: 'brightness(1)', transform: 'scale(1)', opacity: 1 },
  ], { duration: 450 / Math.max(1, store.speed) + 150 })
}

function onCaptureDone() {
  enemyHidden.value = false
  store.resolveCapture()
}

function run() {
  const result = store.act({ type: 'run' })
  if (result && !result.accepted) say('Det går inte att fly nu.')
}

function openMenu(kind: 'switch' | 'bag') {
  menu.value = kind
}

function doSwitch(teamIndex: number) {
  const result = store.act({ type: 'switch', teamIndex })
  if (result?.accepted) menu.value = 'none'
  else if (result?.reason === 'cooldown') say('Byte är på cooldown.')
}

function chooseItem(item: string) {
  pendingItem.value = item
  menu.value = 'target'
}

function useItemOn(teamIndex: number) {
  if (!pendingItem.value) return
  const result = store.act({ type: 'item', item: pendingItem.value, targetIndex: teamIndex })
  if (result?.accepted) {
    emit('item-used', pendingItem.value)
    menu.value = 'none'
    pendingItem.value = null
  } else {
    say(result?.reason === 'cooldown' ? 'Items är på cooldown.' : 'Det skulle inte ha någon effekt.')
  }
}

function closeMenu() {
  menu.value = 'none'
  pendingItem.value = null
}

const RESULT_TEXT = {
  win: 'Du vann striden!',
  lose: 'Du blev besegrad...',
  fled: 'Du kom undan.',
  caught: 'Du fångade Pokémonen!',
} as const

const xpLines = computed(() => {
  const outcome = store.outcome
  const v = view.value
  if (!outcome || !v) return []
  return Object.entries(outcome.xp).map(([uid, xp]) => {
    const name = store.engine?.state.player.battlers.find(b => b.uid === uid)?.name ?? '?'
    return `${name} fick ${xp} XP`
  })
})

const speeds = BALANCE.SPEED_MULTIPLIERS
</script>

<template>
  <div v-if="view" class="scene" :style="{ '--fx': 1 / store.speed }">
    <!-- Battlefield -->
    <div ref="stageEl" class="stage px-panel">
      <BattleBackdrop :theme="store.theme" />

      <div class="enemy-info">
        <BattlerPanel :battler="view.enemy" />
        <div v-if="view.kind === 'trainer'" class="trainer-count" :title="`${view.enemyRemaining} av ${view.enemyTeamSize} kvar`">
          <span v-for="i in view.enemyTeamSize" :key="i" class="ball" :class="{ out: i > view.enemyRemaining }" />
        </div>
      </div>

      <div class="platform enemy-platform" :class="`theme-${store.theme}`" />
      <div class="platform player-platform" :class="`theme-${store.theme}`" />

      <div :ref="setSprite('enemy')" class="sprite enemy" :class="{ fainted: store.fx.enemy.fainted, charging: !!view.enemy.charging, hidden: enemyHidden }">
        <img :src="view.enemy.sprite.front" :alt="view.enemy.name" draggable="false">
      </div>
      <div :ref="setSprite('player')" class="sprite player" :class="{ fainted: store.fx.player.fainted, charging: !!view.player.charging }">
        <img :src="view.player.sprite.back || view.player.sprite.front" :alt="view.player.name" draggable="false">
      </div>

      <div class="player-info">
        <BattlerPanel :battler="view.player" numbers />
      </div>

      <TransitionGroup name="emote" tag="div" class="emote-layer">
        <span v-for="e in store.emotes" :key="e.id" class="emote" :class="e.side">{{ e.emote }}</span>
      </TransitionGroup>
      <TransitionGroup name="floater" tag="div" class="emote-layer">
        <span v-for="f in store.floaters" :key="f.id" class="floater" :class="[f.side, f.kind]">{{ f.text }}</span>
      </TransitionGroup>

      <CaptureAnimation
        v-if="store.capturing" :key="`${store.capturing.ball}-${store.capturing.shakes}-${view.timeMs}`" :ball="store.capturing.ball"
        :shakes="store.capturing.shakes" :caught="store.capturing.caught" :speed="store.speed" :origin="playerEl" :target="enemyEl"
        :stage="stageEl" @throw="onThrow" @absorb="onAbsorb" @shake="onShake" @result="onResult" @release="onRelease" @done="onCaptureDone"
      />
      <div v-if="store.paused && !store.result" class="paused px-title">PAUS</div>
    </div>

    <!-- Controls -->
    <div class="controls">
      <div class="moves-col">
        <div class="moves">
          <MoveButton
            v-for="m in view.player.moves" :key="m.index" :move="m" :hotkey="m.index + 1" :disabled="capturing" @nudge="store.nudge(m.index)"
          />
        </div>
        <div class="nudge-line">
          <span class="px-title tiny">Nudge</span>
          <NudgePips :total="view.player.nudge.budget" :remaining="view.player.nudge.remaining" />
          <span class="hint">Klicka (eller 1-4) för att nudga nästa val.</span>
        </div>
      </div>

      <div class="actions">
        <div class="ball-wrap">
          <button type="button" class="px-btn" :disabled="ballDisabled" @click="openBalls">
            Boll<template v-if="props.bag"> x{{ ballCount }}</template>
          </button>
          <div v-if="ballMenu" class="ball-menu px-panel">
            <button v-for="id in ownedBalls" :key="id" type="button" class="px-btn row" @click="throwBall(id)">
              <img :src="gameData.items[id]?.sprite" alt="" class="ball-icon">
              {{ itemLabel(id) }}<template v-if="itemCount(id) !== null"> x{{ itemCount(id) }}</template>
              <small v-if="store.debug && view.captureChances"> {{ (view.captureChances[id] * 100).toFixed(0) }}%</small>
            </button>
          </div>
        </div>
        <button type="button" class="px-btn" :disabled="bagDisabled || capturing" @click="openMenu('bag')">Väska</button>
        <button type="button" class="px-btn" :disabled="switchDisabled || capturing" @click="openMenu('switch')">Byt</button>
        <button type="button" class="px-btn" :disabled="runDisabled" @click="run">Fly</button>
        <div class="speed">
          <button
            v-for="s in speeds" :key="s" type="button" class="px-btn small" :class="{ primary: store.speed === s }"
            @click="store.setSpeed(s)"
          >
            {{ s }}x
          </button>
          <button type="button" class="px-btn small" :class="{ primary: store.paused }" @click="store.togglePause()">P</button>
        </div>
        <div class="cooldowns">
          <span v-if="view.cooldowns.switchMs > 0">Byt {{ (view.cooldowns.switchMs / 1000).toFixed(0) }}s</span>
          <span v-if="view.cooldowns.itemMs > 0">Item {{ (view.cooldowns.itemMs / 1000).toFixed(0) }}s</span>
          <span v-if="view.cooldowns.ballMs > 0">Boll {{ (view.cooldowns.ballMs / 1000).toFixed(0) }}s</span>
        </div>
      </div>
    </div>

    <BattleLog :lines="store.log" :visible="5" />
    <p v-if="message" class="toast">{{ message }}</p>

    <DebugOverlay v-if="store.debug && view.debug" :view="view" />

    <!-- Team / bag menus -->
    <div v-if="menu !== 'none'" class="modal" @click.self="closeMenu">
      <div class="px-panel menu">
        <template v-if="menu === 'bag'">
          <h3 class="px-title">Väska</h3>
          <button
            v-for="item in BAG_ITEMS" :key="item" type="button" class="px-btn row"
            :disabled="itemCount(item) === 0" @click="chooseItem(item)"
          >
            {{ itemLabel(item) }}<span v-if="itemCount(item) !== null"> x{{ itemCount(item) }}</span>
          </button>
        </template>
        <template v-else>
          <h3 class="px-title">{{ menu === 'switch' ? 'Byt Pokémon' : `${itemLabel(pendingItem ?? '')} på...` }}</h3>
          <button
            v-for="m in view.team" :key="m.teamIndex" type="button" class="px-btn row member"
            :disabled="menu === 'switch' ? (m.fainted || m.active) : m.fainted"
            @click="menu === 'switch' ? doSwitch(m.teamIndex) : useItemOn(m.teamIndex)"
          >
            <img :src="m.icon" alt="" class="icon">
            <span class="mname">{{ m.name }} Lv{{ m.level }}<small v-if="m.active"> (ute)</small></span>
            <span class="mhp">
              <i class="bar"><b :style="{ width: `${(m.hp / m.maxHp) * 100}%`, background: hpColor((m.hp / m.maxHp) * 100) }" /></i>
              {{ m.hp }}/{{ m.maxHp }}
            </span>
          </button>
        </template>
        <button type="button" class="px-btn close" @click="closeMenu">Tillbaka</button>
      </div>
    </div>

    <!-- Result -->
    <div v-if="store.result" class="modal result">
      <div class="px-panel menu">
        <h3 class="px-title">{{ RESULT_TEXT[store.result] }}</h3>
        <p v-for="line in xpLines" :key="line" class="xp">{{ line }}</p>
        <button type="button" class="px-btn primary" @click="emit('finished', store.outcome)">Fortsätt</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scene {
  position: relative;
  width: min(960px, 100%);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.stage {
  position: relative;
  height: 380px;
  overflow: hidden;
}

.platform {
  position: absolute;
  border-radius: 50%;
  background: radial-gradient(ellipse at center, #a0cf70 0%, #6aa040 70%, transparent 72%);
  opacity: 0.9;
}

.platform.theme-indoor {
  background: radial-gradient(ellipse at center, #e8d0a8 0%, #b88c64 70%, transparent 72%);
}

.platform.theme-gym {
  background: radial-gradient(ellipse at center, #9a9aaa 0%, #5a5a6a 70%, transparent 72%);
}

.platform.theme-forest {
  background: radial-gradient(ellipse at center, #7aa850 0%, #3f7a38 70%, transparent 72%);
}

.enemy-platform {
  right: 4%;
  top: 36%;
  width: 300px;
  height: 56px;
}

.player-platform {
  left: 3%;
  bottom: 4%;
  width: 360px;
  height: 66px;
}

.enemy-info {
  position: absolute;
  top: 12px;
  left: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.trainer-count {
  display: flex;
  gap: 4px;
  padding-left: 4px;
}

.ball {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: linear-gradient(#e04040 50%, #f0f0f0 50%);
  border: 2px solid #2a1c12;
}

.ball.out {
  background: #555;
  opacity: 0.5;
}

.player-info {
  position: absolute;
  right: 12px;
  bottom: 12px;
}

.sprite {
  position: absolute;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  transition: opacity 0.6s, transform 0.6s;
}

.sprite img {
  image-rendering: pixelated;
  transform-origin: bottom center;
}

.sprite.enemy {
  right: 14%;
  top: 8%;
  width: 160px;
  height: 160px;
}

.sprite.enemy img {
  transform: scale(2);
}

.sprite.player {
  left: 12%;
  bottom: 9%;
  width: 180px;
  height: 180px;
}

.sprite.player img {
  transform: scale(2.4);
}

.sprite.fainted {
  opacity: 0;
  transform: translateY(40px);
}

.sprite.hidden {
  visibility: hidden;
}

.ball-wrap {
  position: relative;
  display: contents;
}

.ball-menu {
  position: absolute;
  right: 12px;
  bottom: 150px;
  z-index: 8;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 190px;
}

.ball-menu .row {
  text-align: left;
  display: flex;
  align-items: center;
  gap: 8px;
}

.ball-icon {
  width: 20px;
  height: 20px;
  image-rendering: pixelated;
}

.sprite.charging img {
  filter: drop-shadow(0 0 8px #ffe070) drop-shadow(0 0 16px #ff9020);
  animation: charge 0.5s ease-in-out infinite alternate;
}

@keyframes charge {
  from { filter: drop-shadow(0 0 4px #ffe070); }
  to { filter: drop-shadow(0 0 18px #ff7020) brightness(1.3); }
}

.emote-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.emote {
  position: absolute;
  font-size: 34px;
  text-shadow: 2px 2px 0 #2a1c12;
  animation: rise 1.2s ease-out forwards;
}

.emote.enemy {
  right: 22%;
  top: 4%;
}

.emote.player {
  left: 22%;
  bottom: 46%;
}

@keyframes rise {
  from { transform: translateY(8px) scale(0.6); opacity: 0; }
  20% { transform: translateY(-4px) scale(1.15); opacity: 1; }
  to { transform: translateY(-26px) scale(1); opacity: 0; }
}

.floater {
  position: absolute;
  font-family: 'Press Start 2P', monospace;
  font-size: 18px;
  color: #fff;
  text-shadow: 2px 2px 0 #2a1c12, -1px -1px 0 #2a1c12;
  animation: float 1.05s ease-out forwards;
}

.floater.enemy {
  right: 16%;
  top: 22%;
}

.floater.player {
  left: 18%;
  bottom: 38%;
}

.floater.heal { color: #7ee07e; }
.floater.crit { color: #ffd840; font-size: 24px; }
.floater.strong { color: #ff9a6a; }
.floater.weak { color: #eadcb8; font-size: 14px; }

@keyframes float {
  from { transform: translateY(0); opacity: 1; }
  to { transform: translateY(-48px); opacity: 0; }
}

.paused {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: 28px;
  background: rgba(0, 0, 0, 0.35);
  letter-spacing: 0.2em;
}

.controls {
  display: grid;
  grid-template-columns: 1fr 230px;
  gap: 10px;
}

.moves {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.nudge-line {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
  color: #dcc8a0;
  font-size: 14px;
}

.tiny {
  font-size: 9px;
  color: #ffb84a;
}

.actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  align-content: start;
}

.speed {
  grid-column: 1 / -1;
  display: flex;
  gap: 6px;
}

.speed .small {
  flex: 1;
  padding: 7px 4px;
}

.cooldowns {
  grid-column: 1 / -1;
  display: flex;
  gap: 8px;
  font-size: 13px;
  color: #dcc8a0;
  min-height: 18px;
}

.toast {
  margin: 0;
  color: #ffd840;
  text-align: center;
}

.modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: grid;
  place-items: center;
  z-index: 20;
}

.menu {
  width: min(440px, 92vw);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.menu h3 {
  margin: 0 0 6px;
  font-size: 12px;
  line-height: 1.5;
}

.row {
  text-align: left;
  display: flex;
  align-items: center;
  gap: 10px;
}

.member .icon {
  width: 40px;
  height: 40px;
  image-rendering: pixelated;
}

.mname {
  flex: 1;
  font-family: 'Pixelify Sans', monospace;
  font-size: 15px;
  text-transform: none;
}

.mhp {
  font-family: 'Pixelify Sans', monospace;
  font-size: 13px;
  text-transform: none;
  display: flex;
  align-items: center;
  gap: 6px;
}

.bar {
  display: inline-block;
  width: 60px;
  height: 8px;
  background: #2a1c12;
}

.bar b {
  display: block;
  height: 100%;
}

.close {
  margin-top: 4px;
}

.xp {
  margin: 0;
  color: #8ef08e;
}

.emote-enter-active, .floater-enter-active { transition: none; }
</style>
