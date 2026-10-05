<script setup lang="ts">
// Plays the steps after a won (or lost, caught) battle inside the battle scene: text with a typewriter, XP bars, level-up panels,
// the move-forgetting dialog, favorite and nickname scenes. One press advances one step; the first press while text is being typed
// shows the whole line. Holding the key down never skips anything (key repeats are ignored and steps have a short lock).
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { fillNames } from '~~/nudge/game/names'
import type { SequenceStep, XpBar } from '~~/nudge/game/postBattle'
import FacePortrait from '~/components/nudge/overworld/FacePortrait.vue'
import FavoriteScene from '~/components/nudge/game/FavoriteScene.vue'
import MoveReplaceDialog from '~/components/nudge/game/MoveReplaceDialog.vue'
import NicknameDialog from '~/components/nudge/game/NicknameDialog.vue'
import { useAudioStore } from '~/stores/nudge/audio'
import { useGameStore } from '~/stores/nudge/game'

const props = defineProps<{ steps: SequenceStep[], speed: number }>()
const emit = defineEmits<{ (e: 'done'): void }>()

const game = useGameStore()
const audio = useAudioStore()

/** A local copy: choices (forgetting a move) add messages after the current step. */
const steps = ref<SequenceStep[]>([...props.steps])
const index = ref(-1)
const lineIndex = ref(0)
const revealed = ref(0)
const phase = ref(0)
const bar = ref<{ name: string, level: number, pct: number } | null>(null)

/** Minimum time between two advancing presses, so a held or double-pressed key cannot skip a level-up. */
const LOCK_MS = 260
const START_DELAY_MS = 900
let lockedUntil = 0
let typer: ReturnType<typeof setInterval> | null = null
let barFrame = 0
let barTimer: ReturnType<typeof setTimeout> | null = null
let started = false

const step = computed(() => steps.value[index.value] ?? null)
const message = computed(() => (step.value?.type === 'message' ? step.value : null))
const line = computed(() => fillNames(message.value?.lines[lineIndex.value] ?? ''))
const typed = computed(() => line.value.slice(0, Math.floor(revealed.value)))
const lineDone = computed(() => revealed.value >= line.value.length)

function stopTyper() {
  if (typer) clearInterval(typer)
  typer = null
}

function typeLine() {
  stopTyper()
  revealed.value = 0
  typer = setInterval(() => {
    revealed.value += Math.max(1, props.speed)
    if (revealed.value >= line.value.length) stopTyper()
  }, 28)
}

function animateBar(target: XpBar, onDone?: () => void) {
  cancelAnimationFrame(barFrame)
  const startAt = performance.now()
  const duration = Math.max(250, (700 * Math.max(0.2, Math.abs(target.to - target.from) / 100 + 0.3)) / Math.max(1, props.speed))
  bar.value = { name: target.name, level: target.level, pct: target.from }
  const tick = (now: number) => {
    const t = Math.min(1, (now - startAt) / duration)
    bar.value = { name: target.name, level: target.level, pct: target.from + (target.to - target.from) * t }
    if (t < 1) barFrame = requestAnimationFrame(tick)
    else onDone?.()
  }
  barFrame = requestAnimationFrame(tick)
}

function next() {
  lockedUntil = Date.now() + LOCK_MS
  index.value++
}

function enter() {
  const s = step.value
  stopTyper()
  if (barTimer) clearTimeout(barTimer)
  if (!s) {
    emit('done')
    return
  }
  lineIndex.value = 0
  phase.value = 0
  switch (s.type) {
    case 'message':
      if (s.jingle) void audio.jingle(s.jingle)
      if (s.bar) animateBar(s.bar)
      typeLine()
      break
    case 'xpBar':
      // Fills on its own, then moves on.
      animateBar(s.bar, () => {
        barTimer = setTimeout(next, 250)
      })
      break
    case 'favorite':
      void audio.jingle('favorite')
      break
    default:
      break
  }
}

watch(index, enter)

/** One press / click. */
function advance() {
  if (!started || Date.now() < lockedUntil) return
  const s = step.value
  if (!s) return
  if (s.type === 'message') {
    if (!lineDone.value) {
      stopTyper()
      revealed.value = line.value.length
      lockedUntil = Date.now() + 120
    } else if (lineIndex.value < s.lines.length - 1) {
      lineIndex.value++
      lockedUntil = Date.now() + LOCK_MS
      typeLine()
    } else {
      next()
    }
  } else if (s.type === 'levelUp') {
    if (phase.value === 0) {
      phase.value = 1
      lockedUntil = Date.now() + LOCK_MS
    } else {
      next()
    }
  }
}

function onKeyDown(event: KeyboardEvent) {
  if (event.repeat) return
  const target = event.target as HTMLElement | null
  if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
  if (event.key === ' ' || event.key === 'Enter' || event.key === 'z' || event.key === 'Z') {
    event.preventDefault()
    advance()
  }
}

function onReplace(uid: string, move: string, replaceIndex: number | null) {
  const lines = game.learnChoice(uid, move, replaceIndex)
  steps.value.splice(index.value + 1, 0, { type: 'message', lines })
  next()
}

function onNickname(uid: string, nickname: string | null) {
  game.giveNickname(uid, nickname)
  next()
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
  setTimeout(() => {
    started = true
    index.value = 0
    if (!steps.value.length) emit('done')
  }, START_DELAY_MS)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
  stopTyper()
  cancelAnimationFrame(barFrame)
  if (barTimer) clearTimeout(barTimer)
})

const levelUp = computed(() => (step.value?.type === 'levelUp' ? step.value : null))
</script>

<template>
  <div class="seq">
    <div v-if="bar" class="xp px-panel">
      <div class="who">{{ bar.name }} <span>Lv{{ bar.level }}</span></div>
      <div class="track"><i :style="{ width: `${bar.pct}%` }" /></div>
      <small>XP</small>
    </div>

    <div v-if="levelUp" class="stats px-panel" @click="advance">
      <h3 class="px-title">{{ levelUp.name }} nådde nivå {{ levelUp.level }}!</h3>
      <div v-for="c in levelUp.changes" :key="c.stat" class="row" :class="{ up: c.delta > 0 }">
        <span>{{ c.label }}</span>
        <b v-if="phase === 0">{{ c.delta > 0 ? `+${c.delta}` : c.delta === 0 ? '±0' : c.delta }}</b>
        <b v-else>{{ c.after }}</b>
      </div>
      <p class="hint">{{ phase === 0 ? 'Mellanslag: se nya värden' : 'Mellanslag: fortsätt' }}</p>
    </div>

    <div v-if="message" class="box" role="dialog" @click="advance">
      <div v-if="message.speaker" class="speaker px-title">{{ message.speaker }}</div>
      <FacePortrait v-if="message.portrait" class="face" :sprite="message.portrait" />
      <p class="text" :class="{ withFace: !!message.portrait }">{{ typed }}<span v-if="lineDone" class="more">▼</span></p>
    </div>

    <MoveReplaceDialog v-if="step?.type === 'moveReplace'" :key="`mr-${index}`" :uid="step.uid" :move="step.move" @resolve="onReplace(step.uid, step.move, $event)" />
    <FavoriteScene v-else-if="step?.type === 'favorite'" :key="`fav-${index}`" :uid="step.uid" :move="step.move" :previous="step.previous" @resolve="next" />
    <NicknameDialog v-else-if="step?.type === 'nickname'" :key="`nick-${index}`" :uid="step.uid" @resolve="onNickname(step.uid, $event)" />
  </div>
</template>

<style scoped>
.seq {
  position: absolute;
  inset: 0;
  z-index: 25;
  pointer-events: none;
}

.seq > * {
  pointer-events: auto;
}

.box {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  min-height: 150px;
  padding: 16px 20px;
  background: #f8ecd0;
  color: #2a1c12;
  border: 4px solid #2a1c12;
  box-shadow: inset 0 0 0 3px #c8b088, 4px 4px 0 rgba(0, 0, 0, 0.4);
  cursor: pointer;
}

.speaker {
  position: absolute;
  top: -16px;
  left: 14px;
  font-size: 10px;
  padding: 5px 8px;
  background: #2a1c12;
  color: #ffd840;
}

.face {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
}

.text {
  margin: 0;
  font-size: 22px;
  line-height: 1.45;
}

.text.withFace {
  padding-left: 92px;
}

.more {
  position: absolute;
  right: 16px;
  bottom: 10px;
  animation: bounce 0.7s steps(2) infinite;
}

.xp {
  position: absolute;
  right: 14px;
  bottom: 170px;
  width: 260px;
  padding: 8px 10px;
}

.who {
  display: flex;
  justify-content: space-between;
  font-size: 16px;
}

.who span {
  color: #ffd840;
}

.track {
  height: 10px;
  margin: 5px 0 2px;
  background: #2a1c12;
  border: 2px solid #2a1c12;
}

.track i {
  display: block;
  height: 100%;
  background: #4ab8ff;
}

small {
  color: #dcc8a0;
}

.stats {
  position: absolute;
  left: 50%;
  top: 40%;
  transform: translate(-50%, -50%);
  min-width: 280px;
  padding: 14px 18px;
  cursor: pointer;
}

.stats h3 {
  margin: 0 0 10px;
  font-size: 11px;
  line-height: 1.5;
  color: #ffd840;
}

.row {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  font-size: 20px;
  padding: 2px 0;
}

.row.up b {
  color: #8ef08e;
}

.hint {
  margin: 10px 0 0;
  font-size: 13px;
  color: #dcc8a0;
}

@keyframes bounce {
  50% { transform: translateY(3px); }
}
</style>
