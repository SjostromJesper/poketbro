// The account of the player (PLAN-4 2.1): sign in, create an account, upgrade an old anonymous one, and the profile with the public player id.
// The Supabase client is handed over by the page (composables like `useSupabaseClient` only work inside components).
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { accessOf, cleanDisplayName, formatPlayer, validateCredentials, type AccessState, type Profile } from '~~/nudge/game/account'

/** The part of the Supabase client used here (loosely typed: the generated database types do not know the profiles table). */
interface Client {
  auth: any
  rpc: (...args: any[]) => any
}

/** POSTs JSON to one of our own server routes; failures throw an error carrying the server's message (`data.statusMessage`). */
async function postJson(url: string, body: unknown): Promise<void> {
  const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  if (response.ok) return
  const data = await response.json().catch(() => ({})) as { statusMessage?: string, message?: string }
  throw Object.assign(new Error(data.statusMessage ?? data.message ?? 'Något gick fel'), { data })
}

export const useAccountStore = defineStore('nudgeAccount', () => {
  const ready = ref(false)
  const access = ref<AccessState>('signed-out')
  const email = ref<string | null>(null)
  const profile = ref<Profile | null>(null)
  const error = ref<string | null>(null)
  const busy = ref(false)
  let client: Client | null = null

  /** `Namn #1452`, or null before the profile exists. */
  const label = computed(() => (profile.value ? formatPlayer(profile.value) : null))
  const canPlay = computed(() => access.value === 'account')

  function adopt(user: any) {
    access.value = accessOf(user)
    email.value = user?.email ?? null
  }

  async function loadProfile(name?: string) {
    if (!client || access.value === 'signed-out') return
    const { data, error: e } = await client.rpc('ensure_profile', { p_display_name: name ?? null })
    if (e) {
      error.value = `Profilen kunde inte hämtas: ${e.message}`
      return
    }
    const row = (Array.isArray(data) ? data[0] : data) as { display_name: string, tag: number } | null
    if (row) profile.value = { displayName: row.display_name, tag: row.tag }
  }

  /** Reads the session once at start. Never throws. */
  async function init(supabase: Client) {
    client = supabase
    try {
      const { data } = await supabase.auth.getSession()
      adopt(data.session?.user ?? null)
      if (access.value === 'account') await loadProfile()
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    }
    ready.value = true
  }

  async function run(action: () => Promise<string | null>): Promise<string | null> {
    busy.value = true
    error.value = null
    try {
      const message = await action()
      if (message) error.value = message
      return message
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      return error.value
    } finally {
      busy.value = false
    }
  }

  async function afterSignIn(): Promise<string | null> {
    const { data } = await client!.auth.getSession()
    adopt(data.session?.user ?? null)
    if (access.value === 'account') await loadProfile()
    return null
  }

  function signIn(emailAddress: string, password: string) {
    return run(async () => {
      const { error: e } = await client!.auth.signInWithPassword({ email: emailAddress.trim(), password })
      return e ? (e.message === 'Invalid login credentials' ? 'Fel e-post eller lösenord.' : e.message) : afterSignIn()
    })
  }

  /** Creates an account (server side, confirmed at once) and signs in. */
  function signUp(emailAddress: string, password: string) {
    return run(async () => {
      const problem = validateCredentials(emailAddress, password)
      if (problem) return problem
      try {
        await postJson('/api/auth/register', { email: emailAddress.trim(), password })
      } catch (e: any) {
        return e?.data?.statusMessage ?? 'Kunde inte skapa kontot.'
      }
      return signInNow(emailAddress, password)
    })
  }

  async function signInNow(emailAddress: string, password: string): Promise<string | null> {
    const { error: e } = await client!.auth.signInWithPassword({ email: emailAddress.trim(), password })
    return e ? e.message : afterSignIn()
  }

  /** "Skapa konto för att fortsätta": turns the anonymous account into an e-mail account, keeping the user id and therefore the saves. */
  function upgradeAnonymous(emailAddress: string, password: string) {
    return run(async () => {
      const problem = validateCredentials(emailAddress, password)
      if (problem) return problem
      try {
        await postJson('/api/nudge/upgrade', { email: emailAddress.trim(), password })
      } catch (e: any) {
        return e?.data?.statusMessage ?? 'Kunde inte skapa kontot.'
      }
      // The new session carries the e-mail: sign in with it (the user id is unchanged).
      return signInNow(emailAddress, password)
    })
  }

  function magicLink(emailAddress: string) {
    return run(async () => {
      const { error: e } = await client!.auth.signInWithOtp({ email: emailAddress.trim(), options: { emailRedirectTo: `${location.origin}/nudge`, shouldCreateUser: true } })
      return e ? e.message : null
    })
  }

  function forgotPassword(emailAddress: string) {
    return run(async () => {
      const { error: e } = await client!.auth.resetPasswordForEmail(emailAddress.trim(), { redirectTo: `${location.origin}/nudge` })
      return e ? e.message : null
    })
  }

  async function signOut() {
    await client?.auth.signOut()
    access.value = 'signed-out'
    email.value = null
    profile.value = null
  }

  /** The trainer name from the intro becomes the display name (and creates the profile the first time). */
  async function setDisplayName(name: string) {
    const clean = cleanDisplayName(name)
    if (!clean) return
    await loadProfile(clean)
  }

  /** Dev only (`?noauth=1`): lets the game run without an account while it is being built. Ignored in production builds. */
  function devBypass() {
    access.value = 'account'
    email.value = 'dev@localhost'
    profile.value = { displayName: 'Dev', tag: 1234 }
    ready.value = true
  }

  return { ready, access, email, profile, error, busy, label, canPlay, init, signIn, signUp, upgradeAnonymous, magicLink, forgotPassword, signOut, setDisplayName, loadProfile, devBypass }
})
