// The online side of the game as the player sees it (PLAN-4 2.6-2.7): sending teams and challenges through the Edge Functions, and reading the inbox
// (challenges to answer, results of matches). Everything that changes something goes through the functions; the tables are only read (row level security).
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { BattleEvent } from '~~/nudge/engine/types'
import { OFFLINE_MESSAGE, outcomeFor, unseenCount, type InboxChallenge, type InboxMatch, type OpponentLike, type ServerError } from '~~/nudge/game/network'
import type { ChallengeResult, PublicProfile, RespondResult, SubmitResult } from '~~/nudge/server/handlers'
import type { PokemonSnapshot } from '~~/nudge/server/snapshot'
import { readItem, writeItem } from './storage'
import { useAccountStore } from './account'

/** The part of the Supabase client used here. */
interface Client {
  from: (table: string) => any
  functions: { invoke: (...args: any[]) => Promise<{ data: any, error: any }> }
  auth: any
}

const SEEN_KEY = 'nudge:inbox:seen'

/** A saved match, ready to be played back. */
export interface ReplayData {
  matchId: string
  kind: 'bracket' | 'challenge'
  bracket: string
  createdAt: number
  result: 'a' | 'b' | 'draw'
  engineVersion: string
  playerA: OpponentLike
  playerB: OpponentLike
  teamA: PokemonSnapshot[]
  teamB: PokemonSnapshot[]
  events: BattleEvent[]
  ratingChangeA: number | null
  ratingChangeB: number | null
}

export const useNetworkStore = defineStore('nudgeNetwork', () => {
  const account = useAccountStore()
  let client: Client | null = null
  const challenges = ref<InboxChallenge[]>([])
  const matches = ref<InboxMatch[]>([])
  const declined = ref<{ id: string, to: OpponentLike, bracket: string, createdAt: number }[]>([])
  const loaded = ref(false)
  const lastSeenAt = ref(Number(readItem(SEEN_KEY)) || 0)

  function connect(supabase: Client) {
    client = supabase
  }

  /** Is there a way to reach the network at all? */
  const online = computed(() => !!client && account.canPlay && (typeof navigator === 'undefined' || navigator.onLine))
  const unseen = computed(() => unseenCount(challenges.value, matches.value, lastSeenAt.value))

  /** Calls an Edge Function. Network trouble comes back as the offline error, server refusals as the server's own error. */
  async function call<T>(name: string, body: unknown): Promise<T | ServerError> {
    if (!online.value || !client) return { ok: false, code: 'offline', message: OFFLINE_MESSAGE }
    try {
      const { data, error } = await client.functions.invoke(name, { body })
      if (error) {
        // A refusal (4xx) carries the server's JSON in the error's response; anything else is a connection problem.
        const response = error.context as Response | undefined
        if (response && typeof response.json === 'function') {
          const parsed = await response.json().catch(() => null)
          if (parsed && typeof parsed.message === 'string') return { ...parsed, ok: false } as ServerError
        }
        return { ok: false, code: 'offline', message: OFFLINE_MESSAGE }
      }
      return data as T
    } catch {
      return { ok: false, code: 'offline', message: OFFLINE_MESSAGE }
    }
  }

  const submitBracket = (bracket: string, team: PokemonSnapshot[]) => call<SubmitResult>('submit-bracket', { bracket, team })
  const sendChallenge = (toTag: number, bracket: string, team: PokemonSnapshot[]) => call<ChallengeResult>('send-challenge', { toTag, bracket, team })
  const respond = (challengeId: string, accept: boolean, team?: PokemonSnapshot[]) => call<RespondResult>('respond-challenge', { challengeId, accept, team })

  /** Looks a player up by id (for "Utmana Anna #1452?"). Null when nobody has that id; throws nothing. */
  async function findPlayer(tag: number): Promise<PublicProfile | null | 'offline'> {
    if (!online.value || !client) return 'offline'
    const { data, error } = await client.from('profiles').select('user_id, display_name, tag').eq('tag', tag).maybeSingle()
    if (error) return 'offline'
    return data ? { userId: data.user_id, displayName: data.display_name, tag: data.tag } : null
  }

  async function profilesOf(ids: string[]): Promise<Map<string, OpponentLike>> {
    const map = new Map<string, OpponentLike>()
    if (!client || ids.length === 0) return map
    const { data } = await client.from('profiles').select('user_id, display_name, tag').in('user_id', [...new Set(ids)])
    for (const row of (data ?? []) as { user_id: string, display_name: string, tag: number }[]) map.set(row.user_id, { displayName: row.display_name, tag: row.tag })
    return map
  }

  /** Reads the inbox: pending challenges to me, my latest matches and challenges that were turned down. Quiet on failure (the old lists stay). */
  async function refresh(): Promise<boolean> {
    if (!online.value || !client) return false
    try {
      const { data: session } = await client.auth.getSession()
      const me = session?.session?.user?.id as string | undefined
      if (!me) return false
      const nowIso = new Date().toISOString()
      const [incoming, played, turned] = await Promise.all([
        client.from('challenges').select('id, from_user, bracket, created_at, expires_at').eq('to_user', me).eq('status', 'pending').gt('expires_at', nowIso).order('created_at', { ascending: false }),
        client.from('matches').select('id, kind, bracket, player_a, player_b, result, rating_change_a, rating_change_b, created_at').or(`player_a.eq.${me},player_b.eq.${me}`).order('created_at', { ascending: false }).limit(100),
        client.from('challenges').select('id, to_user, bracket, created_at').eq('from_user', me).eq('status', 'declined').order('created_at', { ascending: false }).limit(20),
      ])
      if (incoming.error || played.error || turned.error) return false
      const names = await profilesOf([
        ...incoming.data.map((c: any) => c.from_user), ...played.data.map((m: any) => (m.player_a === me ? m.player_b : m.player_a)), ...turned.data.map((c: any) => c.to_user),
      ])
      const unknown = { displayName: '?', tag: 0 }
      challenges.value = incoming.data.map((c: any) => ({ id: c.id, from: names.get(c.from_user) ?? unknown, bracket: c.bracket, createdAt: Date.parse(c.created_at), expiresAt: Date.parse(c.expires_at) }))
      matches.value = played.data.map((m: any) => ({
        id: m.id, kind: m.kind, bracket: m.bracket, createdAt: Date.parse(m.created_at), opponent: names.get(m.player_a === me ? m.player_b : m.player_a) ?? unknown,
        outcome: outcomeFor(m.result, m.player_a, me), ratingChange: m.player_a === me ? m.rating_change_a : m.rating_change_b,
      }))
      declined.value = turned.data.map((c: any) => ({ id: c.id, to: names.get(c.to_user) ?? unknown, bracket: c.bracket, createdAt: Date.parse(c.created_at) }))
      loaded.value = true
      return true
    } catch {
      return false
    }
  }

  /** The player has looked at the inbox: the results up to now count as seen. */
  function markSeen() {
    lastSeenAt.value = Math.max(Date.now(), ...matches.value.map(m => m.createdAt))
    writeItem(SEEN_KEY, String(lastSeenAt.value))
  }

  /** Fetches one match with its saved event log and both teams (only possible for the two players, row level security). Null when it cannot be read. */
  async function loadReplay(matchId: string): Promise<ReplayData | null> {
    if (!online.value || !client) return null
    const { data, error } = await client.from('matches')
      .select('id, kind, bracket, player_a, player_b, team_a, team_b, result, events, engine_version, rating_change_a, rating_change_b, created_at').eq('id', matchId).maybeSingle()
    if (error || !data || !Array.isArray(data.events)) return null
    const names = await profilesOf([data.player_a, data.player_b])
    const unknown = { displayName: '?', tag: 0 }
    return {
      matchId: data.id, kind: data.kind, bracket: data.bracket, createdAt: Date.parse(data.created_at), result: data.result, engineVersion: data.engine_version,
      playerA: names.get(data.player_a) ?? unknown, playerB: names.get(data.player_b) ?? unknown, teamA: data.team_a, teamB: data.team_b, events: data.events,
      ratingChangeA: data.rating_change_a, ratingChangeB: data.rating_change_b,
    }
  }

  return { challenges, matches, declined, loaded, online, unseen, connect, call, submitBracket, sendChallenge, respond, findPlayer, loadReplay, refresh, markSeen }
})
