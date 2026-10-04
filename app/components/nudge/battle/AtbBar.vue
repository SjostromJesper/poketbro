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
  background: #0a0f16;
  border: 2px solid #0a0f16;
  box-shadow: 0 0 0 1px #35496a;
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
  background: #6a7a90;
}

.atb.charging .atb-fill {
  background: linear-gradient(#ffd0ff, #d060ff);
  animation: blink 0.45s steps(2) infinite;
}

@keyframes blink {
  50% { opacity: 0.35; }
}
</style>
