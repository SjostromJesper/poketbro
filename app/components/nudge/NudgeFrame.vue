<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { useHead } from '#imports'
import { useAudioStore } from '~/stores/nudge/audio'
import { useSettingsStore } from '~/stores/nudge/settings'

const audio = useAudioStore()
const settings = useSettingsStore()

const CANCEL = /^(avbryt|tillbaka|stäng|nej|ångra|lämna)/i

// Browsers only allow sound after a click or key press: the first one unlocks the audio.
// Every button also gets a menu sound (opt out with data-sound="none", or data-sound="cancel" for a cancel sound).
function onPointerDown() {
  void audio.unlock()
}

function onKeyDown() {
  void audio.unlock()
}

function onClick(event: MouseEvent) {
  const target = event.target
  if (!(target instanceof Element)) return
  const button = target.closest('button, a.px-btn')
  if (!button || (button as HTMLButtonElement).disabled) return
  const kind = button.getAttribute('data-sound')
  if (kind === 'none') return
  const label = (button.textContent ?? '').trim()
  audio.sfx(kind === 'cancel' || CANCEL.test(label) ? 'menuCancel' : 'menuConfirm')
}

onMounted(() => {
  settings.load()
  window.addEventListener('pointerdown', onPointerDown, true)
  window.addEventListener('keydown', onKeyDown, true)
  window.addEventListener('click', onClick, true)
})

onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', onPointerDown, true)
  window.removeEventListener('keydown', onKeyDown, true)
  window.removeEventListener('click', onClick, true)
  // Another Nudge page sets its own music right away; only silence the game when we really leave it.
  setTimeout(() => {
    if (!document.querySelector('.nudge-frame')) audio.stopAll()
  }, 50)
})

// Full-screen pixel-style frame for every Nudge page. Pulls the pixel fonts from Google Fonts (falls back to monospace offline).
useHead({
  title: 'Nudge',
  link: [
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
    { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Pixelify+Sans:wght@400;600&display=swap' },
  ],
})
</script>

<template>
  <div class="nudge-frame">
    <slot />
  </div>
</template>

<style>
.nudge-frame {
  position: fixed;
  inset: 0;
  overflow: auto;
  background: #2a1f16;
  background-image: radial-gradient(circle at 50% 0%, #4a3626 0%, #2a1f16 60%);
  color: #fff4dc;
  font-family: 'Pixelify Sans', 'Courier New', monospace;
  font-size: 16px;
  line-height: 1.35;
  -webkit-font-smoothing: none;
}

.nudge-frame *,
.nudge-frame *::before,
.nudge-frame *::after {
  box-sizing: border-box;
}

.nudge-frame .px-title {
  font-family: 'Press Start 2P', 'Courier New', monospace;
  letter-spacing: 0.02em;
}

.nudge-frame .px-btn {
  font-family: 'Press Start 2P', 'Courier New', monospace;
  font-size: 10px;
  color: #fff4dc;
  background: #6a4c32;
  border: 3px solid #2a1c12;
  box-shadow: inset 0 -4px 0 #4a3220, inset 0 3px 0 #9a7a52;
  padding: 10px 12px;
  cursor: pointer;
  text-transform: uppercase;
}

.nudge-frame .px-btn:hover:not(:disabled) {
  background: #8a6a44;
}

.nudge-frame .px-btn:active:not(:disabled) {
  transform: translateY(2px);
}

.nudge-frame .px-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.nudge-frame .px-btn.primary {
  background: #c8402c;
  box-shadow: inset 0 -4px 0 #8a2818, inset 0 3px 0 #e8705c;
}

.nudge-frame .px-btn.primary:hover:not(:disabled) {
  background: #d8503c;
}

.nudge-frame .px-panel {
  background: #4a3626;
  border: 3px solid #2a1c12;
  box-shadow: inset 0 0 0 2px #8a6a44, 4px 4px 0 rgba(0, 0, 0, 0.35);
}

.nudge-frame a {
  color: #ffd070;
}
</style>
