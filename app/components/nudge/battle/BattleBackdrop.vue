<script setup lang="ts">
// The painted backdrop of a battle: a sky (outdoors) and a small tile map drawn with the active graphics theme.
import { onMounted, ref, watch } from 'vue'
import { backdropMap, BACKDROP_COLS, BACKDROP_ROWS, SKY_ROWS, type BattleTheme } from '~~/nudge/game/battleThemes'
import { loadTheme } from '~/components/nudge/overworld/themeRuntime'
import { useSettingsStore } from '~/stores/nudge/settings'

const props = defineProps<{ theme: BattleTheme }>()
const settings = useSettingsStore()
const canvas = ref<HTMLCanvasElement | null>(null)

const TILE = 16
const W = BACKDROP_COLS * TILE
const H = BACKDROP_ROWS * TILE
const scale = ref(1)

const SKY: Record<BattleTheme, [string, string]> = {
  meadow: ['#7fc8f0', '#cdeaf8'],
  forest: ['#6a9a86', '#9ec0a0'],
  town: ['#8fd0f4', '#d8eefa'],
  indoor: ['#c8a47a', '#c8a47a'],
  gym: ['#4a4a58', '#4a4a58'],
}

async function paint() {
  const el = canvas.value
  if (!el) return
  const id = settings.theme
  const theme = await loadTheme(id)
  if (settings.theme !== id) return
  scale.value = theme.scale
  // The canvas size changes with the theme's resolution; wait for it before drawing.
  await new Promise(resolve => requestAnimationFrame(resolve))
  const g = el.getContext('2d')!
  g.setTransform(theme.scale, 0, 0, theme.scale, 0, 0)
  g.imageSmoothingEnabled = false
  const [top, bottom] = SKY[props.theme]
  const sky = g.createLinearGradient(0, 0, 0, H)
  sky.addColorStop(0, top)
  sky.addColorStop(1, bottom)
  g.fillStyle = sky
  g.fillRect(0, 0, W, H)
  const map = backdropMap(props.theme)
  const mapDef = { id: 'backdrop', name: '', warps: [], npcs: [], trainers: [], signs: [], ...map }
  for (let ty = SKY_ROWS[props.theme]; ty < BACKDROP_ROWS; ty++) {
    for (let tx = 0; tx < BACKDROP_COLS; tx++) theme.tiles.drawTile(g, mapDef, tx, ty, tx * TILE, ty * TILE, 0)
  }
  if (props.theme === 'forest') {
    g.fillStyle = 'rgba(0, 30, 10, 0.28)'
    g.fillRect(0, 0, W, H)
  }
}

onMounted(paint)
watch(() => [props.theme, settings.theme], paint)
</script>

<template>
  <canvas ref="canvas" class="backdrop" :width="W * scale" :height="H * scale" aria-hidden="true" />
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
