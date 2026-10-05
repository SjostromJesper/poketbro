// Common code of the Nudge Edge Functions (Deno): CORS, signing in the caller from the JWT, and the database access (`Db`) for the handlers.
// The game logic itself lives in ./nudge/server (generated from the game's code, see `npm run sync-functions`).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { gameData } from './nudge/data/index.ts'
import { BALANCE } from './nudge/engine/balance.ts'
import { randomRng, type ChallengeRow, type Context, type Db, type EntryRow, type MatchRecord, type PublicProfile } from './nudge/server/handlers.ts'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'content-type': 'application/json' } })

/** Handles a request: answers CORS, finds the signed-in user, runs `run` with the handler context and turns the result into a JSON response. */
export async function serve(req: Request, run: (ctx: Context, db: Db, body: Record<string, unknown>) => Promise<{ ok: boolean, status?: number } & Record<string, unknown>>): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { ok: false, code: 'method', message: 'Använd POST.' })
  const url = Deno.env.get('SUPABASE_URL')!
  const authHeader = req.headers.get('Authorization') ?? ''
  // Who is calling: ask Supabase Auth about the caller's own token.
  const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } })
  const { data: userData, error } = await asUser.auth.getUser()
  if (error || !userData.user) return json(401, { ok: false, code: 'not-signed-in', message: 'Inte inloggad.' })
  if (userData.user.is_anonymous) return json(403, { ok: false, code: 'anonymous', message: 'Skapa ett konto för att spela online.' })

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    return json(400, { ok: false, code: 'bad-json', message: 'Ogiltig förfrågan.' })
  }
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const ctx: Context = { userId: userData.user.id, now: Date.now(), data: gameData, balance: BALANCE, rng: randomRng() }
  try {
    const result = await run(ctx, supabaseDb(admin), body)
    return json(result.ok ? 200 : (result.status ?? 400), result)
  } catch (e) {
    console.error(e)
    return json(500, { ok: false, code: 'server-error', message: 'Något gick fel på servern.' })
  }
}

// deno-lint-ignore no-explicit-any
function supabaseDb(db: any): Db {
  const iso = (ms: number) => new Date(ms).toISOString()
  const must = <T>(r: { data: T, error: { message: string } | null }): T => {
    if (r.error) throw new Error(r.error.message)
    return r.data
  }
  const toProfile = (row: { user_id: string, display_name: string, tag: number } | null): PublicProfile | null => (row ? { userId: row.user_id, displayName: row.display_name, tag: row.tag } : null)
  const toChallenge = (row: Record<string, unknown>): ChallengeRow => ({
    id: row.id as string, fromUser: row.from_user as string, toUser: row.to_user as string, bracket: row.bracket as string, teamFrom: row.team_from as ChallengeRow['teamFrom'],
    status: row.status as ChallengeRow['status'], matchId: (row.match_id as string | null) ?? null, createdAt: Date.parse(row.created_at as string), expiresAt: Date.parse(row.expires_at as string),
  })
  return {
    async profileOf(userId) {
      return toProfile(must(await db.from('profiles').select('user_id, display_name, tag').eq('user_id', userId).maybeSingle()))
    },
    async profileByTag(tag) {
      return toProfile(must(await db.from('profiles').select('user_id, display_name, tag').eq('tag', tag).maybeSingle()))
    },
    async countRecentBracketMatches(userId, sinceMs) {
      const r = await db.from('nudge_matches').select('id', { count: 'exact', head: true }).eq('kind', 'bracket').eq('player_a', userId).gte('created_at', iso(sinceMs))
      if (r.error) throw new Error(r.error.message)
      return r.count ?? 0
    },
    async countRecentChallenges(userId, sinceMs) {
      const r = await db.from('nudge_challenges').select('id', { count: 'exact', head: true }).eq('from_user', userId).gte('created_at', iso(sinceMs))
      if (r.error) throw new Error(r.error.message)
      return r.count ?? 0
    },
    async countPendingOutgoing(userId, nowMs) {
      const r = await db.from('nudge_challenges').select('id', { count: 'exact', head: true }).eq('from_user', userId).eq('status', 'pending').gt('expires_at', iso(nowMs))
      if (r.error) throw new Error(r.error.message)
      return r.count ?? 0
    },
    async ratingStatsOf(userId, bracket) {
      const row = must(await db.from('bracket_ratings').select('rating, games').eq('user_id', userId).eq('bracket', bracket).maybeSingle()) as { rating: number, games: number } | null
      return { rating: row?.rating ?? 1000, games: row?.games ?? 0 }
    },
    async entriesInBracket(bracket, exceptUserId): Promise<EntryRow[]> {
      const rows = must(await db.from('bracket_entries').select('user_id, team').eq('bracket', bracket).neq('user_id', exceptUserId)) as { user_id: string, team: EntryRow['team'] }[]
      if (rows.length === 0) return []
      const ratings = must(await db.from('bracket_ratings').select('user_id, rating, games').eq('bracket', bracket).in('user_id', rows.map(r => r.user_id))) as { user_id: string, rating: number, games: number }[]
      const byUser = new Map(ratings.map(r => [r.user_id, r]))
      return rows.map(r => ({ userId: r.user_id, team: r.team, rating: byUser.get(r.user_id)?.rating ?? 1000, games: byUser.get(r.user_id)?.games ?? 0 }))
    },
    async recentOpponents(userId, bracket, count) {
      const rows = must(await db.from('nudge_matches').select('player_a, player_b').eq('kind', 'bracket').eq('bracket', bracket)
        .or(`player_a.eq.${userId},player_b.eq.${userId}`).order('created_at', { ascending: false }).limit(count)) as { player_a: string, player_b: string }[]
      return rows.map(r => (r.player_a === userId ? r.player_b : r.player_a))
    },
    async saveEntry(userId, bracket, team) {
      must(await db.from('bracket_entries').upsert({ user_id: userId, bracket, team, submitted_at: new Date().toISOString() }, { onConflict: 'user_id,bracket' }))
    },
    async recordMatch(match: MatchRecord, options) {
      const id = must(await db.rpc('nudge_record_match', {
        p_kind: match.kind, p_bracket: match.bracket, p_player_a: match.playerA, p_player_b: match.playerB, p_team_a: match.teamA, p_team_b: match.teamB, p_seed: match.seed,
        p_engine_version: match.engineVersion, p_result: match.result, p_events: match.events, p_challenge_id: options?.challengeId ?? null,
        p_rating_a: match.ratingA ?? null, p_rating_b: match.ratingB ?? null,
      }))
      return id as string
    },
    async insertChallenge(row) {
      const created = must(await db.from('nudge_challenges').insert({
        from_user: row.fromUser, to_user: row.toUser, bracket: row.bracket, team_from: row.teamFrom, status: 'pending', created_at: iso(row.createdAt), expires_at: iso(row.expiresAt),
      }).select('id').single()) as { id: string }
      return created.id
    },
    async getChallenge(id) {
      const row = must(await db.from('nudge_challenges').select('*').eq('id', id).maybeSingle()) as Record<string, unknown> | null
      return row ? toChallenge(row) : null
    },
    async setChallengeStatus(id, status) {
      must(await db.from('nudge_challenges').update({ status }).eq('id', id))
    },
  }
}
