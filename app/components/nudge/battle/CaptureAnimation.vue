<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { gameData } from '~~/nudge/data'

const props = defineProps<{
  /** Ball item id: poke-ball, great-ball or ultra-ball. */
  ball: string
  /** Shakes to show before the result (0-3). */
  shakes: number
  caught: boolean
  /** Game speed multiplier (1, 2 or 3). */
  speed: number
  /** Element the ball is thrown from / to (their centres in stage coordinates). */
  origin: HTMLElement | null
  target: HTMLElement | null
  stage: HTMLElement | null
}>()

const emit = defineEmits<{
  /** The Pokémon is pulled into the ball (flash + shrink it in the scene). */
  (e: 'absorb'): void
  /** The ball opens and the Pokémon is back (failed catch). */
  (e: 'release'): void
  (e: 'shake', index: number): void
  (e: 'throw'): void
  (e: 'result', caught: boolean): void
  (e: 'done'): void
}>()

const ballEl = ref<HTMLElement | null>(null)
const flash = ref(false)
const sparkles = ref<{ id: number, dx: number, dy: number }[]>([])
const sprite = gameData.items[props.ball]?.sprite ?? ''

let cancelled = false
// Everything scales with the game speed, but never so fast that the wobbles cannot be seen.
const scale = Math.max(0.5, 1 / Math.max(1, props.speed))
const ms = (value: number) => value * scale

const sleep = (time: number) => new Promise<void>(resolve => setTimeout(resolve, time))

function centre(el: HTMLElement | null, stage: DOMRect): { x: number, y: number } {
  if (!el) return { x: stage.width / 2, y: stage.height / 2 }
  const r = el.getBoundingClientRect()
  return { x: r.left - stage.left + r.width / 2, y: r.top - stage.top + r.height * 0.55 }
}

async function play(animation: Animation | undefined) {
  if (!animation) return
  try {
    await animation.finished
  } catch {
    // cancelled
  }
}

async function run() {
  const el = ballEl.value
  const stageEl = props.stage
  if (!el || !stageEl) return emit('done')
  const stageRect = stageEl.getBoundingClientRect()
  const start = centre(props.origin, stageRect)
  const end = centre(props.target, stageRect)
  const groundY = Math.min(stageRect.height - 40, end.y + 70)
  const size = 40
  const place = (x: number, y: number) => `translate(${x - size / 2}px, ${y - size / 2}px)`

  // 1. Throw: an arc from the player to the opponent.
  el.style.opacity = '1'
  emit('throw')
  const frames: Keyframe[] = []
  const arcHeight = 90
  for (let i = 0; i <= 14; i++) {
    const t = i / 14
    const x = start.x + (end.x - start.x) * t
    const y = start.y + (end.y - start.y) * t - Math.sin(Math.PI * t) * arcHeight
    frames.push({ transform: `${place(x, y)} rotate(${t * 720}deg)` })
  }
  await play(el.animate(frames, { duration: ms(650), easing: 'linear', fill: 'forwards' }))
  if (cancelled) return

  // 2. The Pokémon is pulled in.
  flash.value = true
  emit('absorb')
  setTimeout(() => { flash.value = false }, ms(300))
  await sleep(ms(450))
  if (cancelled) return

  // 3. The ball falls to the ground with a small bounce.
  const drop = [
    { transform: place(end.x, end.y) },
    { transform: place(end.x, groundY), offset: 0.55, easing: 'ease-in' },
    { transform: place(end.x, groundY - 22), offset: 0.78, easing: 'ease-out' },
    { transform: place(end.x, groundY), offset: 1, easing: 'ease-in' },
  ]
  await play(el.animate(drop, { duration: ms(600), fill: 'forwards' }))
  if (cancelled) return
  await sleep(ms(250))

  // 4. Shakes: one wobble per shake, about 800 ms apart.
  const rest = place(end.x, groundY)
  for (let i = 0; i < props.shakes; i++) {
    if (cancelled) return
    emit('shake', i)
    await play(el.animate([
      { transform: `${rest} rotate(0deg)` },
      { transform: `${rest} rotate(-20deg)`, offset: 0.25 },
      { transform: `${rest} rotate(20deg)`, offset: 0.65 },
      { transform: `${rest} rotate(0deg)` },
    ], { duration: ms(600), fill: 'forwards' }))
    await sleep(ms(200))
  }
  if (cancelled) return

  // 5. The result.
  emit('result', props.caught)
  if (props.caught) {
    el.style.filter = 'brightness(0.65) saturate(0.7)'
    sparkles.value = Array.from({ length: 9 }, (_, id) => {
      const angle = (id / 9) * Math.PI * 2
      return { id, dx: Math.cos(angle) * 46, dy: Math.sin(angle) * 36 - 10 }
    })
    await sleep(ms(950))
  } else {
    flash.value = true
    el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms(250), fill: 'forwards' })
    emit('release')
    await sleep(ms(500))
    flash.value = false
  }
  if (!cancelled) emit('done')
}

onMounted(() => { void run() })
onBeforeUnmount(() => { cancelled = true })
</script>

<template>
  <div class="capture" aria-hidden="true">
    <img ref="ballEl" class="ball" :src="sprite" alt="" draggable="false">
    <div v-if="flash" class="flash" />
    <div class="sparkles" :style="{ left: '0', top: '0' }">
      <span v-for="s in sparkles" :key="s.id" class="spark" :style="{ '--dx': `${s.dx}px`, '--dy': `${s.dy}px` }">★</span>
    </div>
  </div>
</template>

<style scoped>
.capture {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 6;
}

.ball {
  position: absolute;
  left: 0;
  top: 0;
  width: 40px;
  height: 40px;
  opacity: 0;
  image-rendering: pixelated;
  will-change: transform;
}

.flash {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 74% 38%, rgba(255, 255, 255, 0.85), rgba(255, 255, 255, 0) 38%);
  animation: fade 0.35s ease-out forwards;
}

.sparkles {
  position: absolute;
  inset: 0;
}

.spark {
  position: absolute;
  left: 70%;
  top: 56%;
  color: #ffe45a;
  font-size: 20px;
  text-shadow: 0 0 6px #ffb020;
  animation: burst 0.9s ease-out forwards;
}

@keyframes fade {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes burst {
  from { transform: translate(0, 0) scale(0.4); opacity: 1; }
  to { transform: translate(var(--dx), var(--dy)) scale(1.3); opacity: 0; }
}
</style>
