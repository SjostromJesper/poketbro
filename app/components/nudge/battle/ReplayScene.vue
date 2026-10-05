<script setup lang="ts">
// Plays back a saved online match in spectator mode (PLAN-4 2.8): the same look as a battle, but no nudge or action buttons. The saved event log is
// read, not simulated again. Controls: pause, 1x / 2x / 4x and "Hoppa till slutet".
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef, triggerRef } from 'vue'
import { gameData } from '~~/nudge/data'
import { BALANCE } from '~~/nudge/engine/balance'
import { describeEvent } from '~~/nudge/engine/messages'
import type { BattleEvent, Side } from '~~/nudge/engine/types'
import type { BattlerView } from '~~/nudge/game/battleView'
import { formatPlayer } from '~~/nudge/game/account'
import { eventDelay, ReplayPlayer, type ReplayMember } from '~~/nudge/game/replay'
import { bracketLabel } from '~~/nudge/server/brackets'
import { ratingText } from '~~/nudge/game/network'
import type { ReplayData } from '~/stores/nudge/network'
import { useAudioStore } from '~/stores/nudge/audio'
import BattleBackdrop from './BattleBackdrop.vue'
import BattlerPanel from './BattlerPanel.vue'

const props = defineProps<{ replay: ReplayData }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const audio = useAudioStore()
const player = new ReplayPlayer(props.replay.events, props.replay.teamA, props.replay.teamB, gameData, BALANCE, props.replay.result)
const state = shallowRef(player.state)
const names = { player: formatPlayer(props.replay.playerA), enemy: formatPlayer(props.replay.playerB) }
const log = ref<{ id: number, text: string }[]>([])
const speed = ref(1)
const paused = ref(false)
const fx = reactive<Record<Side, { anim: string, nonce: number, fainted: boolean }>>({ player: { anim: '', nonce: 0, fainted: false }, enemy: { anim: '', nonce: 0, fainted: false } })
const floaters = ref<{ id: number, side: Side, text: string, kind: string }[]>([])
const emotes = ref<{ id: number, side: Side, emote: string }[]>([])
const lastMoveAt = { player: 0, enemy: 0 }
const clock = ref(0)
let nextId = 1
let raf = 0
let last = 0
let wait = 700

function transient<T extends { id: number }>(list: { value: T[] }, item: Omit<T, 'id'>, ms: number) {
  const entry = { ...item, id: nextId++ } as T
  list.value.push(entry)
  setTimeout(() => {
    const i = list.value.findIndex(e => e.id === entry.id)
    if (i >= 0) list.value.splice(i, 1)
  }, ms)
}

function show(event: BattleEvent) {
  const text = describeEvent(event, { kind: 'pvp', data: gameData, names })
  if (text) log.value.push({ id: nextId++, text })
  if (log.value.length > 40) log.value.splice(0, log.value.length - 40)
  switch (event.type) {
    case 'send-out':
      fx[event.side] = { anim: 'enter', nonce: fx[event.side].nonce + 1, fainted: false }
      lastMoveAt[event.side] = clock.value
      audio.cry(event.speciesId)
      break
    case 'move-used':
      fx[event.side] = { ...fx[event.side], anim: 'lunge', nonce: fx[event.side].nonce + 1 }
      lastMoveAt[event.side] = clock.value
      break
    case 'damage':
      if (event.source === 'status' || event.source === 'leech-seed') break
      fx[event.side] = { ...fx[event.side], anim: 'hit', nonce: fx[event.side].nonce + 1 }
      if (event.amount > 0) transient(floaters, { side: event.side, text: `-${event.amount}`, kind: event.crit ? 'crit' : event.effectiveness > 1 ? 'strong' : event.effectiveness < 1 ? 'weak' : 'damage' }, 1000)
      break
    case 'heal':
      transient(floaters, { side: event.side, text: `+${event.amount}`, kind: 'heal' }, 1000)
      break
    case 'faint':
      fx[event.side] = { ...fx[event.side], fainted: true }
      break
    case 'emote':
      transient(emotes, { side: event.side, emote: event.emote }, 1100)
      break
    default:
      break
  }
}

function frame(now: number) {
  const dt = Math.min(100, now - (last || now))
  last = now
  if (!paused.value && !player.done) {
    clock.value += dt * speed.value
    wait -= dt * speed.value
    // Several quick events (a choice and its emote) can pass in one frame.
    for (let guard = 0; guard < 6 && wait <= 0 && !player.done; guard++) {
      const event = player.next()
      if (!event) break
      show(event)
      wait += eventDelay(event)
    }
    triggerRef(state)
  } else if (player.done) {
    triggerRef(state)
  }
  raf = requestAnimationFrame(frame)
}

function skip() {
  while (!player.done) {
    const event = player.next()
    if (!event) break
    // Only the log text matters when skipping.
    const text = describeEvent(event, { kind: 'pvp', data: gameData, names })
    if (text) log.value.push({ id: nextId++, text })
  }
  log.value = log.value.slice(-40)
  for (const side of ['player', 'enemy'] as const) fx[side] = { ...fx[side], fainted: player.state[side].team[player.state[side].active]?.fainted ?? false }
  triggerRef(state)
}

function view(side: Side): BattlerView | null {
  const s = state.value[side]
  const m: ReplayMember | undefined = s.team[s.active]
  if (!m) return null
  const species = gameData.species[m.speciesId]
  // The ATB bar is only a picture here: it fills again after each action.
  const atbPct = Math.min(100, ((clock.value - lastMoveAt[side]) / 2500) * 100)
  return {
    side, uid: `${side}-${s.active}`, teamIndex: s.active, name: m.name, speciesId: m.speciesId, level: m.level, types: m.types,
    sprite: { front: species.sprites.front, back: species.sprites.back, icon: species.sprites.icon }, hp: m.hp, maxHp: m.maxHp, hpPct: (m.hp / m.maxHp) * 100,
    atb: atbPct * 10, atbPct: m.fainted ? 0 : atbPct, fillPerSec: 0, effectiveSpeed: 0, status: m.status, confused: false, seeded: false, protectedNow: false, napping: false,
    fainted: m.fainted, charging: null, trait: 'loyal', nature: '', trust: 0, heldItem: null, stages: [], moves: [], habits: {},
    nudge: { budget: 0, used: 0, remaining: 0, pending: null },
  }
}

const mine = computed(() => view('player'))
const theirs = computed(() => view('enemy'))
const winnerText = computed(() => {
  const w = state.value.winner
  if (!w) return ''
  if (w === 'draw') return 'Oavgjort!'
  return `${w === 'a' ? names.player : names.enemy} vann!`
})
const rating = computed(() => (props.replay.kind === 'bracket' ? ratingText(props.replay.ratingChangeA) : ''))

onMounted(() => {
  raf = requestAnimationFrame(frame)
  audio.music('battleTrainer')
})
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  audio.music(null)
})
</script>

<template>
  <div class="replay">
    <header class="px-panel head">
      <strong>{{ names.player }} mot {{ names.enemy }}</strong>
      <span>{{ props.replay.kind === 'bracket' ? 'Bracket' : 'Utmaning' }} · {{ bracketLabel(props.replay.bracket) }} · Repris</span>
    </header>

    <div class="stage px-panel">
      <BattleBackdrop theme="town" />
      <div class="enemy-info"><BattlerPanel v-if="theirs" :battler="theirs" numbers /></div>
      <div class="lineup enemy-line"><i v-for="(m, i) in state.enemy.team" :key="i" :class="{ out: m.fainted, active: i === state.enemy.active }" /></div>
      <div v-if="theirs" :key="`e${fx.enemy.nonce}`" class="sprite enemy" :class="[fx.enemy.anim, { fainted: fx.enemy.fainted }]">
        <img :src="theirs.sprite.front" :alt="theirs.name" draggable="false">
      </div>
      <div v-if="mine" :key="`p${fx.player.nonce}`" class="sprite player" :class="[fx.player.anim, { fainted: fx.player.fainted }]">
        <img :src="mine.sprite.back || mine.sprite.front" :alt="mine.name" draggable="false">
      </div>
      <div class="player-info"><BattlerPanel v-if="mine" :battler="mine" numbers /></div>
      <div class="lineup player-line"><i v-for="(m, i) in state.player.team" :key="i" :class="{ out: m.fainted, active: i === state.player.active }" /></div>
      <TransitionGroup name="emote" tag="div" class="layer">
        <span v-for="e in emotes" :key="e.id" class="emote" :class="e.side">{{ e.emote }}</span>
      </TransitionGroup>
      <TransitionGroup name="floater" tag="div" class="layer">
        <span v-for="f in floaters" :key="f.id" class="floater" :class="[f.side, f.kind]">{{ f.text }}</span>
      </TransitionGroup>
      <div v-if="winnerText" class="winner px-title">{{ winnerText }}<small v-if="rating">{{ rating }}</small></div>
    </div>

    <div class="log px-panel" aria-live="polite">
      <p v-for="l in log.slice(-6)" :key="l.id">{{ l.text }}</p>
    </div>

    <div class="controls">
      <button type="button" class="px-btn" :class="{ primary: paused }" @click="paused = !paused">{{ paused ? 'Spela' : 'Pausa' }}</button>
      <button v-for="s in [1, 2, 4]" :key="s" type="button" class="px-btn small" :class="{ primary: speed === s }" @click="speed = s">{{ s }}x</button>
      <button type="button" class="px-btn" :disabled="state.index >= state.total" @click="skip">Hoppa till slutet</button>
      <span class="progress">{{ state.index }} / {{ state.total }}</span>
      <button type="button" class="px-btn" @click="emit('close')">Stäng</button>
    </div>
  </div>
</template>

<style scoped>
.replay {
  position: fixed;
  inset: 0;
  z-index: 70;
  padding: 12px;
  overflow: auto;
  background: #2a1f16;
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
}

.head, .stage, .log, .controls { width: min(960px, 100%); }
.head { display: flex; justify-content: space-between; padding: 6px 12px; gap: 12px; flex-wrap: wrap; }
.head span { color: #dcc8a0; font-size: 14px; }
.stage { position: relative; height: 380px; overflow: hidden; }
.enemy-info { position: absolute; top: 10px; left: 10px; }
.player-info { position: absolute; right: 10px; bottom: 10px; }
.lineup { position: absolute; display: flex; gap: 4px; }
.enemy-line { top: 120px; left: 14px; }
.player-line { right: 14px; bottom: 150px; }
.lineup i { width: 12px; height: 12px; border-radius: 50%; background: #ff5a5a; border: 2px solid #2a1c12; }
.lineup i.out { background: #555; }
.lineup i.active { outline: 2px solid #ffd840; }
.sprite { position: absolute; }
.sprite img { image-rendering: pixelated; height: 150px; }
.sprite.enemy { right: 14%; top: 50px; }
.sprite.player { left: 12%; bottom: 20px; }
.sprite.player img { height: 190px; }
.sprite.fainted { opacity: 0; transform: translateY(40px); transition: all 0.6s; }
.sprite.lunge { animation: lunge 0.42s ease-out; }
.sprite.hit { animation: hit 0.45s; }
.sprite.enter { animation: enter 0.45s ease-out; }
.sprite.player.lunge { --dx: 46px; --dy: -22px; }
.sprite.enemy.lunge { --dx: -46px; --dy: 22px; }

@keyframes lunge { 35% { transform: translate(var(--dx, 40px), var(--dy, -20px)); } }
@keyframes hit { 20% { opacity: 0.2; } 40% { opacity: 1; } 60% { opacity: 0.4; } }
@keyframes enter { from { opacity: 0; transform: translateY(40px) scale(0.3); } }

.layer { position: absolute; inset: 0; pointer-events: none; }
.emote { position: absolute; font-size: 28px; }
.emote.player { left: 22%; bottom: 40%; }
.emote.enemy { right: 18%; top: 28%; }
.floater { position: absolute; font-family: 'Press Start 2P', monospace; font-size: 14px; color: #fff; text-shadow: 2px 2px 0 #000; }
.floater.player { left: 24%; bottom: 36%; }
.floater.enemy { right: 20%; top: 40%; }
.floater.heal { color: #8ef08e; }
.floater.crit, .floater.strong { color: #ffd840; }
.floater-enter-active { transition: all 1s ease-out; }
.floater-enter-from { opacity: 0; transform: translateY(20px); }
.emote-enter-active { transition: all 0.3s; }
.emote-enter-from { opacity: 0; transform: scale(0.4); }

.winner { position: absolute; left: 50%; top: 40%; transform: translate(-50%, -50%); padding: 14px 22px; background: rgba(0, 0, 0, 0.8); color: #ffd840; font-size: 16px; text-align: center; border: 4px solid #ffd840; }
.winner small { display: block; margin-top: 8px; font-size: 11px; color: #fff4dc; }

.log { height: 136px; padding: 8px 10px; display: flex; flex-direction: column; justify-content: flex-end; gap: 2px; overflow: hidden; }
.log p { margin: 0; font-size: 16px; }
.controls { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.progress { margin-left: auto; color: #dcc8a0; font-size: 14px; }
</style>
