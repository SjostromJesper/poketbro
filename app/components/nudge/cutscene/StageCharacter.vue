<script setup lang="ts">
// A character of the active theme drawn big on a cutscene stage (the standing front frame, scaled up with crisp pixels).
import { onMounted, ref, watch } from 'vue'
import type { SpriteKey } from '~~/nudge/game/themes/types'
import { loadTheme } from '~/components/nudge/overworld/themeRuntime'
import { useSettingsStore } from '~/stores/nudge/settings'

const props = defineProps<{ sprite: SpriteKey, size?: number }>()
const settings = useSettingsStore()
const canvas = ref<HTMLCanvasElement | null>(null)

async function paint() {
  const el = canvas.value
  if (!el) return
  const id = settings.theme
  const theme = await loadTheme(id)
  if (settings.theme !== id) return
  const g = el.getContext('2d')!
  g.imageSmoothingEnabled = false
  g.clearRect(0, 0, el.width, el.height)
  // The theme draws into one 16 x 16 tile with the feet at the bottom; taller sprites reach above it.
  theme.drawCharacter(g, props.sprite, 'down', 0, 8, -1)
}

onMounted(paint)
watch(() => [props.sprite, settings.theme], paint)
</script>

<template>
  <canvas ref="canvas" class="stage-char" width="16" height="24" :style="{ width: `${(size ?? 128)}px`, height: `${(size ?? 128) * 1.5}px` }" aria-hidden="true" />
</template>

<style scoped>
.stage-char {
  image-rendering: pixelated;
  display: block;
}
</style>
