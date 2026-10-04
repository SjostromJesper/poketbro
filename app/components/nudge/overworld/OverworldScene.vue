<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { DIRECTIONS } from '~~/nudge/game/types'
import { TRAINERS } from '~~/nudge/game/trainers'
import { useWorldStore } from '~/stores/nudge/world'
import DialogBox from './DialogBox.vue'
import { createPlaceholderRenderer, drawCharacter, drawExclamation, LOOKS, TILE, type TileRenderer } from './render'

const props = withDefaults(defineProps<{
  /** Optional tileset renderer; the built-in placeholder graphics are used when omitted. */
  renderer?: TileRenderer
  /** Content for the pause menu (M6). */
  menuTitle?: string
}>(), { renderer: undefined, menuTitle: 'Meny' })

const emit = defineEmits<{ (e: 'menu-action', action: string): void }>()

const store = useWorldStore()
const canvas = ref<HTMLCanvasElement | null>(null)

const VIEW_W = 15
const VIEW_H = 11
const WIDTH = VIEW_W * TILE
const HEIGHT = VIEW_H * TILE

let renderer: TileRenderer | null = null
let raf = 0
let last = 0

const mapName = computed(() => store.world?.map.name ?? '')
const bannerText = computed(() => store.banner?.text ?? '')

function draw() {
  const el = canvas.value
  const world = store.world
  if (!el || !world || !renderer) return
  const ctx = el.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  const v = store.visual
  const map = world.map
  const mapW = map.tiles[0].length * TILE
  const mapH = map.tiles.length * TILE

  ctx.fillStyle = '#05080c'
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  let camX = v.x * TILE + TILE / 2 - WIDTH / 2
  let camY = v.y * TILE + TILE / 2 - HEIGHT / 2
  camX = mapW <= WIDTH ? -(WIDTH - mapW) / 2 : Math.max(0, Math.min(mapW - WIDTH, camX))
  camY = mapH <= HEIGHT ? -(HEIGHT - mapH) / 2 : Math.max(0, Math.min(mapH - HEIGHT, camY))
  camX = Math.round(camX)
  camY = Math.round(camY)

  const frame = Math.floor(v.time / 450)
  const x0 = Math.max(0, Math.floor(camX / TILE))
  const y0 = Math.max(0, Math.floor(camY / TILE))
  const x1 = Math.min(map.tiles[0].length - 1, Math.ceil((camX + WIDTH) / TILE))
  const y1 = Math.min(map.tiles.length - 1, Math.ceil((camY + HEIGHT) / TILE))
  for (let ty = y0; ty <= y1; ty++) {
    const row = map.tiles[ty]
    for (let tx = x0; tx <= x1; tx++) renderer.drawTile(ctx, row[tx], tx, ty, tx * TILE - camX, ty * TILE - camY, frame, !!map.indoor)
  }

  // Characters, back to front.
  const drawables: { y: number, draw: () => void }[] = []
  for (const npc of map.npcs) {
    drawables.push({
      y: npc.y,
      draw: () => drawCharacter(ctx, LOOKS[npc.look], world.facingOf(npc.id, npc.facing), npc.x * TILE - camX, npc.y * TILE - camY, -1),
    })
  }
  for (const spot of map.trainers) {
    const def = TRAINERS[spot.id]
    drawables.push({
      y: spot.y,
      draw: () => {
        drawCharacter(ctx, LOOKS[def?.look ?? 'boy'], world.facingOf(spot.id, spot.facing), spot.x * TILE - camX, spot.y * TILE - camY, -1)
        if (v.spotted?.id === spot.id) drawExclamation(ctx, spot.x * TILE - camX, spot.y * TILE - camY)
      },
    })
  }
  drawables.push({
    y: v.y,
    draw: () => drawCharacter(ctx, LOOKS.player, world.state.facing, Math.round(v.x * TILE - camX), Math.round(v.y * TILE - camY), v.walk),
  })
  drawables.sort((a, b) => a.y - b.y).forEach(d => d.draw())

  if (v.fade > 0) {
    ctx.fillStyle = `rgba(0, 0, 0, ${v.fade})`
    ctx.fillRect(0, 0, WIDTH, HEIGHT)
  }
}

function loop(now: number) {
  const dt = last ? now - last : 16
  last = now
  store.update(dt)
  draw()
  raf = requestAnimationFrame(loop)
}

const HANDLED = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Enter', 'Escape'])

function onKeyDown(event: KeyboardEvent) {
  if (event.repeat) {
    if (HANDLED.has(event.key)) event.preventDefault()
    return
  }
  const target = event.target as HTMLElement | null
  if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return
  if (HANDLED.has(event.key)) event.preventDefault()
  store.keyDown(event.key)
}

function onKeyUp(event: KeyboardEvent) {
  store.keyUp(event.key)
}

function onBlur() {
  store.holdDirection(null)
  store.keyUp('Shift')
}

onMounted(() => {
  renderer = props.renderer ?? createPlaceholderRenderer()
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onBlur)
  raf = requestAnimationFrame(loop)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('blur', onBlur)
})

defineExpose({ draw, directions: DIRECTIONS })
</script>

<template>
  <div class="overworld">
    <div class="viewport">
      <canvas ref="canvas" :width="WIDTH" :height="HEIGHT" class="canvas" aria-label="Spelplan" />
      <Transition name="banner">
        <div v-if="bannerText" class="banner px-title">{{ bannerText }}</div>
      </Transition>
      <DialogBox v-if="store.dialog" :dialog="store.dialog" @advance="store.advanceDialog()" />
      <div v-if="store.menuOpen" class="menu px-panel">
        <h3 class="px-title">{{ menuTitle }}</h3>
        <slot name="menu" :close="store.closeMenu">
          <button type="button" class="px-btn" @click="store.closeMenu()">Fortsätt</button>
        </slot>
      </div>
      <slot name="overlay" />
    </div>
    <p class="help">
      Pilar/WASD: gå &middot; Shift: spring &middot; Mellanslag/Z/Enter: prata &middot; Esc/X: meny &middot; {{ mapName }}
    </p>
    <span class="sr-only" @click="emit('menu-action', 'noop')" />
  </div>
</template>

<style scoped>
.overworld {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100%;
  padding: 8px;
  gap: 8px;
}

.viewport {
  position: relative;
  width: min(100%, calc((100vh - 70px) * 240 / 176));
  border: 4px solid #0a0f16;
  box-shadow: 0 0 0 2px #35496a, 6px 6px 0 rgba(0, 0, 0, 0.4);
  background: #05080c;
}

.canvas {
  display: block;
  width: 100%;
  height: auto;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}

.banner {
  position: absolute;
  top: 10px;
  left: 10px;
  font-size: 12px;
  padding: 8px 12px;
  background: rgba(10, 15, 22, 0.88);
  border: 3px solid #35496a;
  color: #fff;
}

.banner-enter-active, .banner-leave-active { transition: opacity 0.4s, transform 0.4s; }
.banner-enter-from, .banner-leave-to { opacity: 0; transform: translateY(-8px); }

.menu {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 200px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 6;
}

.menu h3 {
  margin: 0 0 4px;
  font-size: 11px;
}

.help {
  margin: 0;
  font-size: 13px;
  color: #6f86a8;
  text-align: center;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
</style>
