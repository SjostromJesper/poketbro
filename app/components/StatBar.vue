<script setup lang="ts">
const props = defineProps<{
  label: string
  current: number
  max: number
  color?: string
  suffix?: string
}>()

const pct = computed(() => (props.max > 0 ? Math.min(100, Math.max(0, (props.current / props.max) * 100)) : 0))
</script>

<template>
  <div class="stat-bar">
    <div class="stat-bar-label">{{ label }}</div>
    <div class="stat-bar-track">
      <div class="stat-bar-fill" :style="{ width: pct + '%', background: color ?? 'var(--red)' }" />
      <span class="stat-bar-text">{{ current }} / {{ max }}<template v-if="suffix"> {{ suffix }}</template></span>
    </div>
  </div>
</template>

<style scoped>
.stat-bar {
  max-width: 320px;
  margin-bottom: 0.5rem;
}

.stat-bar-label {
  font-size: 0.7rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.2rem;
}

.stat-bar-track {
  position: relative;
  background: var(--surface-alt);
  border: 1px solid var(--border-soft);
  border-radius: 4px;
  height: 22px;
  overflow: hidden;
}

.stat-bar-fill {
  height: 100%;
  transition: width 0.3s ease;
}

.stat-bar-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.78rem;
  font-weight: bold;
  color: var(--text-inverse);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.55);
}
</style>
