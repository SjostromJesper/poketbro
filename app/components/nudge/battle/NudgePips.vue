<script setup lang="ts">
defineProps<{ total: number, remaining: number }>()
</script>

<template>
  <span class="pips" :title="`${remaining} av ${total} nudges kvar`">
    <span v-for="i in total" :key="i" class="pip" :class="{ on: i <= remaining }" />
  </span>
</template>

<style scoped>
.pips {
  display: inline-flex;
  gap: 4px;
  vertical-align: middle;
}

.pip {
  width: 10px;
  height: 10px;
  border: 2px solid #0a0f16;
  background: #2a3a52;
  box-shadow: 0 0 0 1px #4a6288;
}

.pip.on {
  background: #ffd840;
  box-shadow: 0 0 0 1px #ffe98a, 0 0 6px #ffd840;
}
</style>
