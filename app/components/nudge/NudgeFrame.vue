<script setup lang="ts">
import { useHead } from '#imports'

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
  background: #0f1620;
  background-image: radial-gradient(circle at 50% 0%, #1d2b3d 0%, #0f1620 60%);
  color: #eef2f7;
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
  color: #eef2f7;
  background: #2a3a52;
  border: 3px solid #0a0f16;
  box-shadow: inset 0 -4px 0 #1b2738, inset 0 3px 0 #4a6288;
  padding: 10px 12px;
  cursor: pointer;
  text-transform: uppercase;
}

.nudge-frame .px-btn:hover:not(:disabled) {
  background: #35496a;
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
  background: #1a2536;
  border: 3px solid #0a0f16;
  box-shadow: inset 0 0 0 2px #35496a, 4px 4px 0 rgba(0, 0, 0, 0.35);
}

.nudge-frame a {
  color: #8ec8ff;
}
</style>
