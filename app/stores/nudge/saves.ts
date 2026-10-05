import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { parseSave, SAVE_KEY, SAVE_VERSION, summarizeSave, type ParseResult, type SaveData, type SaveSummary } from '~~/nudge/game/save'
import { isSlot, SLOTS, SaveSync, type Conflict, type LocalSlot, type LocalStore, type Slot, type SyncState } from '~~/nudge/game/saveSlots'
import { createSupabaseCloud } from './cloud'
import { readItem, removeItem, writeItem } from './storage'

const slotKey = (slot: Slot) => `nudge:slot:${slot}`
const TOMBSTONES_KEY = 'nudge:slot:deleted'
const ACTIVE_KEY = 'nudge:slot:active'

/** The browser side of the slots: each slot is one JSON value in localStorage. */
export const localSlotStore: LocalStore = {
  get(slot) {
    const raw = readItem(slotKey(slot))
    if (!raw) return null
    try {
      return JSON.parse(raw) as LocalSlot
    } catch {
      return null
    }
  },
  set(slot, value) {
    writeItem(slotKey(slot), JSON.stringify(value))
  },
  remove(slot) {
    removeItem(slotKey(slot))
  },
  tombstones() {
    try {
      return (JSON.parse(readItem(TOMBSTONES_KEY) ?? '[]') as unknown[]).filter(isSlot)
    } catch {
      return []
    }
  },
  setTombstones(slots) {
    if (slots.length) writeItem(TOMBSTONES_KEY, JSON.stringify(slots))
    else removeItem(TOMBSTONES_KEY)
  },
}

/** The part of the Supabase client used here. */
type AuthClient = Parameters<typeof createSupabaseCloud>[0]

export interface SlotView {
  slot: Slot
  summary: SaveSummary
  /** Waiting for the cloud (or never uploaded). */
  dirty: boolean
}

export type AccountState =
  /** Not tried yet. */
  | { kind: 'unknown' }
  /** Signed in anonymously (no e-mail). */
  | { kind: 'anonymous' }
  | { kind: 'account', email: string }
  /** Anonymous sign-in is off in the project, or the network is down: only local saving. */
  | { kind: 'unavailable', reason: string }

/**
 * Save slots: writes to the browser at once and to Supabase after a pause, keeps the cloud and the browser in sync and lets the player
 * link an e-mail account (an anonymous user is upgraded, so the saves follow). Without network, login or table the game still saves locally.
 */
export const useSavesStore = defineStore('nudgeSaves', () => {
  const slots = ref<(SlotView | null)[]>([null, null, null])
  const state = ref<SyncState>('local-only')
  const conflicts = ref<Conflict[]>([])
  const error = ref<string | null>(null)
  const account = ref<AccountState>({ kind: 'unknown' })
  /** The slot the running game is played in. */
  const active = ref<Slot>(1)
  const sync = shallowRef<SaveSync | null>(null)
  /** The Supabase client the page hands over (composables like `useSupabaseClient` are only usable inside components). */
  let client: AuthClient | null = null

  const engine = (): SaveSync => {
    if (!sync.value) {
      sync.value = new SaveSync(localSlotStore, null, { onChange: refresh })
    }
    return sync.value
  }

  function refresh() {
    slots.value = SLOTS.map((slot) => {
      const local = localSlotStore.get(slot)
      return local ? { slot, summary: local.summary, dirty: local.dirty } : null
    })
    const s = sync.value
    if (s) {
      state.value = s.state
      conflicts.value = [...s.conflicts]
      error.value = s.error
    }
  }

  /** Moves the single save of older versions into slot 1 (once) and reads the slots. Call at start. */
  function init() {
    const rememberedSlot = Number(readItem(ACTIVE_KEY))
    if (isSlot(rememberedSlot)) active.value = rememberedSlot
    if (!localSlotStore.get(1)) {
      const legacy = readItem(SAVE_KEY)
      const parsed = parseSave(legacy)
      if (parsed.ok) {
        write(1, parsed.save)
        removeItem(SAVE_KEY)
      }
    }
    engine()
    refresh()
  }

  function setActive(slot: Slot) {
    active.value = slot
    writeItem(ACTIVE_KEY, String(slot))
  }

  /** Logs in (anonymously if needed), connects the cloud and syncs. Never throws; problems end up in `account` / `error`. */
  async function connect(supabase: AuthClient) {
    client = supabase
    try {
      // An account is needed to play (PLAN-4 2.1): there is no automatic anonymous sign-in any more. Old anonymous sessions still work until they are upgraded.
      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        account.value = { kind: 'unavailable', reason: 'Inte inloggad' }
        return refresh()
      }
      const user = data.session?.user
      account.value = user?.email && !user.is_anonymous ? { kind: 'account', email: user.email } : { kind: 'anonymous' }
      const cloud = createSupabaseCloud(supabase)
      if (!(await cloud.available())) {
        account.value = { kind: 'unavailable', reason: 'Tabellen save_slots saknas (kör migrationen) eller nätverket är nere' }
        return refresh()
      }
      engine().setCloud(cloud)
      await engine().sync()
    } catch (e) {
      account.value = { kind: 'unavailable', reason: e instanceof Error ? e.message : String(e) }
    }
    refresh()
  }

  function write(slot: Slot, data: SaveData) {
    engine().write(slot, SAVE_VERSION, data, summarizeSave(data))
    refresh()
  }

  /** The save of a slot, validated and migrated. */
  function read(slot: Slot): ParseResult {
    const local = localSlotStore.get(slot)
    return parseSave(local ? JSON.stringify(local.data) : null)
  }

  async function remove(slot: Slot) {
    await engine().remove(slot)
    refresh()
  }

  async function flush() {
    await sync.value?.flush()
    refresh()
  }

  async function resolveConflict(slot: Slot, keep: 'local' | 'cloud') {
    await engine().resolve(slot, keep)
    refresh()
  }

  /** Upgrade the anonymous user to an e-mail account (a confirmation link is sent). The user id stays, so the saves follow. */
  async function linkEmail(email: string): Promise<string> {
    if (!client) return 'Inte ansluten än.'
    const { error: e } = await client.auth.updateUser({ email }, { emailRedirectTo: `${location.origin}/nudge` })
    return e ? e.message : 'Klicka på länken i mejlet för att koppla kontot.'
  }

  /** Sign in to an existing account on this device with a magic link; the cloud saves are then found by the next sync. */
  async function signInWithEmail(email: string): Promise<string> {
    if (!client) return 'Inte ansluten än.'
    const { error: e } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}/nudge` } })
    return e ? e.message : 'Klicka på länken i mejlet för att logga in.'
  }

  const needsAttention = computed(() => state.value === 'pending' || state.value === 'error' || state.value === 'conflict')

  return { slots, state, conflicts, error, account, active, needsAttention, init, setActive, connect, write, read, remove, flush, resolveConflict, linkEmail, signInWithEmail }
})
