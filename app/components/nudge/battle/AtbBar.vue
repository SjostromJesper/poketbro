<script setup lang="ts">
defineProps<{
  /** 0-100 */
  pct: number
  /** The Pokémon is charging a move: the bar blinks. */
  charging?: boolean
  /** The Pokémon cannot fill its bar right now (asleep, frozen, napping). */
  stalled?: boolean
}>()
</script>

<template>
  <div class="atb" :class="{ charging, stalled, full: pct >= 99.5 }" role="progressbar" :aria-valuenow="Math.round(pct)" aria-valuemin="0" aria-valuemax="100">
    <div class="atb-fill" :style="{ width: `${pct}%` }" />
  </div>
</template>

<style scoped>
.atb {
  height: 8px;
  background: #2a1c12;
  border: 2px solid #2a1c12;
  box-shadow: 0 0 0 1px #8a6a44;
  position: relative;
}

.atb-fill {
  height: 100%;
  background: linear-gradient(#ffe46a, #f0b020);
}

.atb.full .atb-fill {
  background: linear-gradient(#fff8b0, #ffd840);
}

.atb.stalled .atb-fill {
  background: #a89070;
}

.atb.charging .atb-fill {
  background: linear-gradient(#ffd0ff, #d060ff);
  animation: blink 0.45s steps(2) infinite;
}

@keyframes blink {
  50% { opacity: 0.35; }
}
</style>
