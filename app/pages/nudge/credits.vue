<script setup lang="ts">
import { CREDITS } from '~~/nudge/game/credits'
import NudgeFrame from '~/components/nudge/NudgeFrame.vue'
</script>

<template>
  <NudgeFrame>
    <main class="credits">
      <h1 class="px-title">Tack till</h1>
      <p class="lead">Nudge är byggt med fria resurser. Stort tack till alla som gjort dem:</p>
      <ul class="list">
        <li v-for="c in CREDITS" :key="c.title" class="px-panel entry">
          <h2>{{ c.title }}</h2>
          <p class="by">av {{ c.by }}</p>
          <p>{{ c.what }}</p>
          <p class="meta">{{ c.license }} &middot; <a :href="c.url" target="_blank" rel="noopener">{{ c.url.replace('https://', '') }}</a></p>
        </li>
      </ul>
      <NuxtLink to="/nudge" class="px-btn">Tillbaka</NuxtLink>
    </main>
  </NudgeFrame>
</template>

<style scoped>
.credits {
  max-width: 640px;
  margin: 0 auto;
  padding: 28px 16px 40px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  align-items: center;
  text-align: center;
}

h1 {
  font-size: 18px;
  color: #ffd840;
  margin: 0;
}

.lead {
  margin: 0;
  color: #eadcb8;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.entry {
  padding: 12px 14px;
  text-align: left;
}

h2 {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  font-family: 'Press Start 2P', monospace;
  color: #ffd840;
}

.by {
  margin: 2px 0 6px;
  color: #dcc8a0;
}

.entry p {
  margin: 0 0 4px;
}

.meta {
  font-size: 14px;
  color: #b8a07c;
}

.px-btn {
  text-decoration: none;
  display: inline-block;
}
</style>
