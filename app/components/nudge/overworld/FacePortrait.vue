<script setup lang="ts">
// A character's face in the active theme: the theme's portrait picture, or the head of the standing sprite when it has none.
import { onMounted, ref, watch } from 'vue'
import type { SpriteKey } from '~~/nudge/game/themes/types'
import { useSettingsStore } from '~/stores/nudge/settings'
import { loadTheme } from './themeRuntime'

const props = defineProps<{ sprite: SpriteKey, size?: number }>()
const settings = useSettingsStore()
const canvas = ref<HTMLCanvasElement | null>(null)
const SIZE = 38

async function paint() {
  const el = canvas.value
  if (!el) return
  const id = settings.theme
  const theme = await loadTheme(id)
  if (settings.theme !== id) return
  const g = el.getContext('2d')!
  g.imageSmoothingEnabled = false
  g.clearRect(0, 0, SIZE, SIZE)
  const p = theme.portrait(props.sprite)
  if (!p) return
  // Fit the picture into the square, keeping the pixel proportions, bottom centred (faces) or top aligned (sprites).
  const scale = Math.min(SIZE / p.sw, SIZE / p.sh)
  const w = p.sw * scale
  const h = p.sh * scale
  g.drawImage(p.image, p.sx, p.sy, p.sw, p.sh, (SIZE - w) / 2, SIZE - h, w, h)
}

onMounted(paint)
watch(() => [props.sprite, settings.theme], paint)
</script>

<template>
  <canvas ref="canvas" class="face-canvas" :width="SIZE" :height="SIZE" :style="{ width: `${size ?? 76}px`, height: `${size ?? 76}px` }" aria-hidden="true" />
</template>

<style scoped>
.face-canvas {
  image-rendering: pixelated;
  background: #2a1c12;
  border: 3px solid #2a1c12;
  box-shadow: 0 0 0 2px #c8b088;
  box-sizing: content-box;
}
</style>
