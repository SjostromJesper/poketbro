<script setup lang="ts">
const supabase = useSupabaseClient()
const email = ref('')
const password = ref('')
const errorMessage = ref('')
const loading = ref(false)

async function handleSubmit() {
  errorMessage.value = ''
  loading.value = true
  try {
    await $fetch('/api/auth/register', {
      method: 'POST',
      body: { email: email.value, password: password.value },
    })
    const { error } = await supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value,
    })
    if (error) {
      errorMessage.value = error.message
      return
    }
    await navigateTo('/')
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage ?? 'Kunde inte skapa kontot'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="card">
    <h1>Skapa konto</h1>
    <form @submit.prevent="handleSubmit">
      <label>
        E-post
        <input v-model="email" type="email" required autocomplete="email">
      </label>
      <label>
        Lösenord
        <input v-model="password" type="password" required minlength="6" autocomplete="new-password">
      </label>
      <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
      <button type="submit" :disabled="loading">{{ loading ? 'Skapar konto...' : 'Skapa konto' }}</button>
    </form>
    <p>Har du redan ett konto? <NuxtLink to="/login">Logga in</NuxtLink></p>
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
