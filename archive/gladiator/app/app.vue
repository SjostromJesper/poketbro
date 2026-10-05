<script setup lang="ts">
const user = useSupabaseUser()
const supabase = useSupabaseClient()
const { character, load, reset } = useCharacter()
const route = useRoute()
// The Nudge prototype is a separate game with its own full-screen layout and no login.
const isNudge = computed(() => route.path === '/nudge' || route.path.startsWith('/nudge/'))

onMounted(() => {
  if (user.value) load()
})

watch(user, (value) => {
  if (value) {
    load(true)
  } else {
    reset()
  }
})

async function logout() {
  await supabase.auth.signOut()
  reset()
  await navigateTo('/login')
}
</script>

<template>
  <NuxtPage v-if="isNudge" />
  <div v-else class="app-shell">
    <header class="app-header">
      <span class="brand">Arenan</span>
      <nav v-if="!user">
        <NuxtLink to="/nudge">Poketbro (test)</NuxtLink>
        <NuxtLink to="/login">Logga in</NuxtLink>
        <NuxtLink to="/registrera">Skapa konto</NuxtLink>
      </nav>
      <div v-else class="header-actions">
        <NuxtLink to="/nudge" class="nudge-link">Poketbro (test)</NuxtLink>
        <button type="button" class="logout-btn" @click="logout">Logga ut</button>
      </div>
    </header>
    <div class="app-body">
      <aside v-if="user && character" class="sidebar">
        <NuxtLink to="/karaktar">Karaktär</NuxtLink>
        <NuxtLink to="/utrustning">Utrustning</NuxtLink>
        <NuxtLink to="/kopman">Köpmannen</NuxtLink>
        <NuxtLink to="/gladiatorskolan">Gladiatorskolan</NuxtLink>
        <NuxtLink to="/arenan">Arenan</NuxtLink>
        <NuxtLink to="/aventyr">Äventyr</NuxtLink>
        <NuxtLink to="/historik">Historik</NuxtLink>
      </aside>
      <main class="app-main">
        <NuxtRouteAnnouncer />
        <NuxtPage />
      </main>
    </div>
  </div>
</template>

<style>
:root {
  /* Sandstone/parchment "arena" palette - light, warm, marble-and-terracotta. */
  --bg: #f2e6c9;
  --surface: #fffaf0;
  --surface-alt: #e8d6a8;
  --surface-hover: #f1e3b8;
  --input-bg: #fdf8ea;
  --border: #c9a15c;
  --border-soft: #ddc496;
  --border-strong: #a97a35;
  --text: #3b2a18;
  --text-muted: #7d6a4d;
  --text-inverse: #fdf6e8;
  --accent: #a8631f;
  --accent-strong: #7a4a12;
  --accent-hover: #8f551a;
  --green: #2f7d3c;
  --green-light: #1f5c2a;
  --orange: #b5502e;
  --orange-light: #8f3a1c;
  --red: #9c2f2f;
  --red-light: #c1503a;
  --blue: #2f6a94;
  --teal: #2f6f78;
  --purple: #7a4fb0;
  --teal-accent: #1f8f6f;
  --shadow: rgba(120, 90, 40, 0.15);
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--bg);
  background-image:
    radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.4), transparent 60%),
    radial-gradient(circle at 80% 80%, rgba(169, 122, 53, 0.08), transparent 55%);
  background-attachment: fixed;
  color: var(--text);
  font-family: 'Trebuchet MS', 'Segoe UI', sans-serif;
}

.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  background: var(--surface-alt);
  border-bottom: 2px solid var(--border);
  box-shadow: 0 2px 6px var(--shadow);
}

.brand {
  font-weight: bold;
  font-size: 1.25rem;
  letter-spacing: 0.03em;
  color: var(--accent-strong);
}

.app-header nav {
  display: flex;
  gap: 1rem;
}

.app-header nav a {
  color: var(--text);
  text-decoration: none;
}

.app-header nav a:hover {
  color: var(--accent);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.nudge-link {
  color: var(--text-muted);
  font-size: 0.85rem;
  text-decoration: none;
}

.nudge-link:hover {
  color: var(--accent);
}

.logout-btn {
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 0.4rem 0.8rem;
  border-radius: 4px;
  cursor: pointer;
  font-family: inherit;
}

.logout-btn:hover {
  border-color: var(--border-strong);
  color: var(--accent);
}

.app-body {
  flex: 1;
  display: flex;
}

.sidebar {
  width: 200px;
  flex-shrink: 0;
  background: var(--surface-alt);
  border-right: 2px solid var(--border);
  padding: 1.5rem 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.sidebar a {
  color: var(--text);
  text-decoration: none;
  padding: 0.6rem 1.5rem;
}

.sidebar a:hover {
  background: var(--surface-hover);
  color: var(--accent);
}

.sidebar a.router-link-active {
  background: var(--surface-hover);
  color: var(--accent-strong);
  border-right: 3px solid var(--accent);
  font-weight: bold;
}

.app-main {
  flex: 1;
  padding: 2rem 1.5rem;
  max-width: 700px;
  width: 100%;
  margin: 0 auto;
}

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 10px var(--shadow);
}

.card h1 {
  margin-top: 0;
  color: var(--accent-strong);
}

.hint {
  color: var(--text-muted);
  font-size: 0.85rem;
}

button {
  font-family: inherit;
}
</style>
