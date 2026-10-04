<script setup lang="ts">
// The painted backdrop of a battle: sky/wall at the top, ground below, built from the same Ninja Adventure tile sheets as the map.
import { onMounted, ref, watch } from 'vue'
import type { BattleTheme } from '~~/nudge/game/battleThemes'
import { SHEETS, type SheetId } from '~~/nudge/game/tileset-manifest'

const props = defineProps<{ theme: BattleTheme }>()

const W = 320
const H = 128
const HORIZON = 64
const canvas = ref<HTMLCanvasElement | null>(null)

const images: Partial<Record<SheetId, HTMLImageElement>> = {}

function load(id: SheetId): Promise<void> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => { images[id] = image; resolve() }
    image.onerror = () => resolve()
    image.src = SHEETS[id].src
  })
}

function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) >>> 0
  h = ((h ^ (h >>> 13)) * 1274126177) >>> 0
  return (h ^ (h >>> 16)) >>> 0
}

/** Draws tile (tx, ty) of a sheet at pixel (x, y); a no-op when the sheet is missing (the plain colours remain). */
function tile(g: CanvasRenderingContext2D, sheet: SheetId, tx: number, ty: number, x: number, y: number, w = 1, h = 1) {
  const image = images[sheet]
  if (image) g.drawImage(image, tx * 16, ty * 16, w * 16, h * 16, x, y, w * 16, h * 16)
}

function gradient(g: CanvasRenderingContext2D, top: string, bottom: string, y0: number, y1: number) {
  const fill = g.createLinearGradient(0, y0, 0, y1)
  fill.addColorStop(0, top)
  fill.addColorStop(1, bottom)
  g.fillStyle = fill
  g.fillRect(0, y0, W, y1 - y0)
}

function grassGround(g: CanvasRenderingContext2D, shade = 0) {
  g.fillStyle = '#b4c050'
  g.fillRect(0, HORIZON, W, H - HORIZON)
  for (let ty = Math.floor(HORIZON / 16); ty < H / 16; ty++) {
    for (let tx = 0; tx < W / 16; tx++) {
      const h = hash(tx, ty)
      const tufts: [number, number][] = [[1, 12], [2, 12], [3, 12], [4, 12], [2, 11], [3, 11]]
      const [sx, sy] = h % 4 === 0 ? tufts[h % tufts.length] : [0, 12]
      tile(g, 'floor', sx, sy, tx * 16, ty * 16)
    }
  }
  if (shade) {
    g.fillStyle = `rgba(0, 30, 10, ${shade})`
    g.fillRect(0, HORIZON, W, H - HORIZON)
  }
}

/** A row of 2x2 trees standing on the horizon. */
function treeLine(g: CanvasRenderingContext2D, baseY: number, offset: number) {
  for (let i = 0; i * 32 - offset < W; i++) {
    const x = i * 32 - offset
    const col = hash(i, baseY) % 3 === 0 ? 2 : 0
    tile(g, 'nature', col, 0, x, baseY - 32, 2, 1)
    tile(g, 'nature', col, 1, x, baseY - 16, 2, 1)
  }
}

function paint() {
  const el = canvas.value
  if (!el) return
  const g = el.getContext('2d')!
  g.imageSmoothingEnabled = false
  g.clearRect(0, 0, W, H)

  switch (props.theme) {
    case 'meadow':
      gradient(g, '#7fc8f0', '#cdeaf8', 0, HORIZON)
      grassGround(g)
      treeLine(g, HORIZON + 10, 8)
      break
    case 'forest':
      gradient(g, '#6a9a86', '#9ec0a0', 0, HORIZON)
      grassGround(g, 0.28)
      treeLine(g, HORIZON - 4, 0)
      g.fillStyle = 'rgba(0, 30, 10, 0.3)'
      g.fillRect(0, 0, W, HORIZON)
      treeLine(g, HORIZON + 12, 16)
      break
    case 'town': {
      gradient(g, '#8fd0f4', '#d8eefa', 0, HORIZON)
      grassGround(g)
      const houses = [0, 4, 12, 8]
      houses.forEach((tx, i) => tile(g, 'house', tx, 0, -8 + i * 84, HORIZON - 36, 4, 3))
      break
    }
    case 'indoor':
      g.fillStyle = '#c8a47a'
      g.fillRect(0, 0, W, HORIZON)
      g.fillStyle = '#e8d0a8'
      g.fillRect(0, 0, W, HORIZON - 22)
      g.fillStyle = '#a8805a'
      g.fillRect(0, HORIZON - 22, W, 2)
      g.fillStyle = '#9a6a44'
      g.fillRect(0, HORIZON - 20, W, 20)
      for (let ty = Math.floor(HORIZON / 16); ty < H / 16; ty++) for (let tx = 0; tx < W / 16; tx++) tile(g, 'interiorFloor', 1, 1, tx * 16, ty * 16)
      break
    case 'gym': {
      g.fillStyle = '#4a4a58'
      g.fillRect(0, 0, W, HORIZON)
      g.fillStyle = '#5a5a6a'
      g.fillRect(0, 0, W, HORIZON - 20)
      const banners = ['#c8402c', '#3a7ad8', '#e8b030', '#4aa860']
      banners.forEach((c, i) => {
        g.fillStyle = c
        g.fillRect(24 + i * 80, 6, 18, 28)
        g.fillStyle = 'rgba(0,0,0,0.25)'
        g.fillRect(24 + i * 80, 30, 18, 4)
      })
      g.fillStyle = '#2a2a34'
      g.fillRect(0, HORIZON - 20, W, 20)
      for (let ty = Math.floor(HORIZON / 16); ty < H / 16; ty++) for (let tx = 0; tx < W / 16; tx++) tile(g, 'interiorFloor', 12, 7, tx * 16, ty * 16)
      g.strokeStyle = 'rgba(255,255,255,0.35)'
      g.lineWidth = 2
      g.beginPath()
      g.ellipse(W / 2, 100, 120, 24, 0, 0, Math.PI * 2)
      g.stroke()
      break
    }
  }
}

onMounted(async () => {
  paint()
  await Promise.all((['floor', 'nature', 'house', 'interiorFloor'] as SheetId[]).map(load))
  paint()
})
watch(() => props.theme, paint)
</script>

<template>
  <canvas ref="canvas" class="backdrop" :width="W" :height="H" aria-hidden="true" />
</template>

<style scoped>
.backdrop {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  image-rendering: pixelated;
}
</style>
