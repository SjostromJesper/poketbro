<script setup lang="ts">
// The sign-in / sign-up screen shown before the title screen: an account is needed to play. Old anonymous players are asked to create an account (their saves follow).
import { ref } from 'vue'
import { useAccountStore } from '~/stores/nudge/account'

const account = useAccountStore()
const mode = ref<'in' | 'up'>('in')
const email = ref('')
const password = ref('')
const info = ref('')

const upgrade = () => account.access === 'anonymous'

async function submit() {
  info.value = ''
  if (upgrade()) await account.upgradeAnonymous(email.value, password.value)
  else if (mode.value === 'up') await account.signUp(email.value, password.value)
  else await account.signIn(email.value, password.value)
}

async function link() {
  info.value = ''
  if (!email.value) return void (account.error = 'Skriv din e-postadress först.')
  if (!(await account.magicLink(email.value))) info.value = 'Klicka på länken i mejlet för att logga in.'
}

async function forgot() {
  info.value = ''
  if (!email.value) return void (account.error = 'Skriv din e-postadress först.')
  if (!(await account.forgotPassword(email.value))) info.value = 'Ett mejl för att välja nytt lösenord är på väg.'
}
</script>

<template>
  <main class="auth">
    <h1 class="px-title logo">VISKA</h1>
    <div class="px-panel box">
      <template v-if="upgrade()">
        <h2 class="px-title">Skapa konto för att fortsätta</h2>
        <p class="note">Du spelar just nu utan konto. Skapa ett konto med e-post och lösenord: dina sparfiler följer med, ingenting försvinner.</p>
      </template>
      <template v-else>
        <div class="tabs">
          <button type="button" class="px-btn small" :class="{ primary: mode === 'in' }" @click="mode = 'in'">Logga in</button>
          <button type="button" class="px-btn small" :class="{ primary: mode === 'up' }" @click="mode = 'up'">Skapa konto</button>
        </div>
        <p class="note">Du behöver ett konto för att spela. Det ger dig ett spelar-ID så att andra kan hitta dig, och sparar dina spel i molnet.</p>
      </template>
      <form @submit.prevent="submit">
        <label>E-post<input v-model="email" type="email" required autocomplete="email"></label>
        <label>Lösenord<input v-model="password" type="password" required minlength="6" :autocomplete="mode === 'in' && !upgrade() ? 'current-password' : 'new-password'"></label>
        <p v-if="account.error" class="error">{{ account.error }}</p>
        <p v-if="info" class="ok">{{ info }}</p>
        <button type="submit" class="px-btn primary" :disabled="account.busy">
          {{ account.busy ? 'Vänta...' : upgrade() ? 'Skapa konto' : mode === 'in' ? 'Logga in' : 'Skapa konto' }}
        </button>
      </form>
      <div v-if="!upgrade() && mode === 'in'" class="alts">
        <button type="button" class="link" @click="link">Skicka en inloggningslänk istället</button>
        <button type="button" class="link" @click="forgot">Glömt lösenordet?</button>
      </div>
    </div>
  </main>
</template>

<style scoped>
.auth {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  padding: 24px 16px;
}

.logo {
  margin: 0;
  font-size: clamp(32px, 8vw, 60px);
  color: #ffd840;
  text-shadow: 4px 4px 0 #c8402c, 8px 8px 0 #2a1c12;
  letter-spacing: 0.08em;
}

.box {
  width: min(420px, 94vw);
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

h2 {
  margin: 0;
  font-size: 12px;
}

.tabs {
  display: flex;
  gap: 8px;
}

.note {
  margin: 0;
  font-size: 15px;
  color: #dcc8a0;
}

form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 15px;
}

input {
  font: inherit;
  font-size: 18px;
  padding: 7px 9px;
  background: #fff4dc;
  color: #2a1c12;
  border: 3px solid #2a1c12;
}

.error {
  margin: 0;
  color: #ff9a8a;
}

.ok {
  margin: 0;
  color: #8ef08e;
}

.alts {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.link {
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  font-size: 14px;
  color: #ffd840;
  text-align: left;
  cursor: pointer;
  text-decoration: underline;
}
</style>
