<script setup lang="ts">
const supabase = useSupabaseClient()
const email = ref('')
const password = ref('')
const errorMessage = ref('')
const loading = ref(false)

async function handleSubmit() {
  errorMessage.value = ''
  loading.value = true
  const { error } = await supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value,
  })
  loading.value = false
  if (error) {
    errorMessage.value = error.message
    return
  }
  await navigateTo('/')
}
</script>

<template>
  <div class="card">
    <h1>Logga in</h1>
    <form @submit.prevent="handleSubmit">
      <label>
        E-post
        <input v-model="email" type="email" required autocomplete="email">
      </label>
      <label>
        Lösenord
        <input v-model="password" type="password" required autocomplete="current-password">
      </label>
      <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
      <button type="submit" :disabled="loading">{{ loading ? 'Loggar in...' : 'Logga in' }}</button>
    </form>
    <p>Inget konto än? <NuxtLink to="/registrera">Skapa ett här</NuxtLink></p>
  </div>
</template>

<style scoped>
form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.9rem;
  color: var(--text-muted);
}

input {
  background: var(--input-bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 0.5rem;
  color: var(--text);
  font-size: 1rem;
}

button {
  background: var(--accent);
  border: none;
  border-radius: 4px;
  padding: 0.6rem 1rem;
  color: var(--text-inverse);
  font-size: 1rem;
  cursor: pointer;
}

button:hover:not(:disabled) {
  background: var(--accent-hover);
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error {
  color: var(--orange);
  font-size: 0.9rem;
}
</style>
