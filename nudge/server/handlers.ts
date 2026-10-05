// The server's three operations (PLAN-4 2.4-2.6): sending in a bracket team, sending a challenge and answering one. They validate everything, simulate the
// match and write the result through a small `Db` interface, so the same code runs in the Edge Functions (Supabase) and in the tests (an in-memory Db).
import type { GameData } from '../data/types'
import type { Balance } from '../engine/balance'
import { createRng, type Rng } from '../engine/rng'
import { simulatePvp, type MatchWinner, type PvpResult } from './autopilot'
import { isBracket, isRatedBracket } from './brackets'
import { pickOpponent } from './matchmaking'
import { validateTeam, type PokemonSnapshot } from './snapshot'

export const RATING_START = 1000
/** Per player and hour (PLAN-4 2.4). */
export const MAX_BRACKET_MATCHES_PER_HOUR = 30
export const MAX_CHALLENGES_PER_HOUR = 20
/** Unanswered outgoing challenges at the same time. */
export const MAX_PENDING_CHALLENGES = 10
export const CHALLENGE_EXPIRY_MS = 7 * 24 * 3600 * 1000
/** How many of the last opponents a bracket match avoids. */
export const RECENT_OPPONENTS = 3

export interface PublicProfile {
  userId: string
  displayName: string
  tag: number
}

export interface EntryRow {
  userId: string
  rating: number
  team: PokemonSnapshot[]
}

export interface MatchRecord {
  kind: 'bracket' | 'challenge'
  bracket: string
  playerA: string
  playerB: string
  teamA: PokemonSnapshot[]
  teamB: PokemonSnapshot[]
  seed: number
  engineVersion: string
  result: MatchWinner
  events: unknown
  ratingChangeA: number | null
  ratingChangeB: number | null
  /** The new ratings of both players (bracket matches; set when ratings are applied, null/absent = unchanged). */
  ratingA?: number | null
  ratingB?: number | null
}

export interface ChallengeRow {
  id: string
  fromUser: string
  toUser: string
  bracket: string
  teamFrom: PokemonSnapshot[]
  status: 'pending' | 'accepted' | 'declined' | 'expired'
  matchId: string | null
  createdAt: number
  expiresAt: number
}

/** What the handlers need from the database. The Edge Functions implement it with supabase-js, the tests with plain objects. */
export interface Db {
  profileOf(userId: string): Promise<PublicProfile | null>
  profileByTag(tag: number): Promise<PublicProfile | null>
  /** Bracket matches the player started / challenges they sent since `sinceMs`. */
  countRecentBracketMatches(userId: string, sinceMs: number): Promise<number>
  countRecentChallenges(userId: string, sinceMs: number): Promise<number>
  countPendingOutgoing(userId: string, nowMs: number): Promise<number>
  ratingOf(userId: string, bracket: string): Promise<number>
  /** Everybody else's current team in the bracket with their ratings. */
  entriesInBracket(bracket: string, exceptUserId: string): Promise<EntryRow[]>
  recentOpponents(userId: string, bracket: string, count: number): Promise<string[]>
  /** Replaces the player's current team in the bracket. */
  saveEntry(userId: string, bracket: string, team: PokemonSnapshot[]): Promise<void>
  /** Saves the match (and, for brackets, the rating changes) in one transaction. Returns the match id. */
  recordMatch(match: MatchRecord, options?: { challengeId?: string }): Promise<string>
  insertChallenge(row: Omit<ChallengeRow, 'id' | 'matchId'>): Promise<string>
  getChallenge(id: string): Promise<ChallengeRow | null>
  setChallengeStatus(id: string, status: 'declined' | 'expired'): Promise<void>
}

export interface Context {
  userId: string
  now: number
  data: GameData
  balance: Balance
  rng: Rng
}

export type Failure = { ok: false, status: number, code: string, message: string, errors?: string[] }
export const fail = (status: number, code: string, message: string, errors?: string[]): Failure => ({ ok: false, status, code, message, ...(errors ? { errors } : {}) })

const seedOf = (rng: Rng) => Math.floor(rng.next() * 0xFFFFFFFF)

export interface MatchSummary {
  matchId: string
  winner: 'you' | 'opponent' | 'draw'
  opponent: PublicProfile
  reason: PvpResult['reason']
  ratingChange: number | null
}

export type SubmitResult = Failure | { ok: true, status: 'waiting', message: string } | ({ ok: true, status: 'played' } & MatchSummary)

/** Sends in a team for a bracket: the team becomes the player's current one, and a match is played against a fitting opponent (or waits for one). */
export async function submitBracket(db: Db, ctx: Context, input: { bracket?: unknown, team?: unknown }): Promise<SubmitResult> {
  const bracket = typeof input.bracket === 'string' ? input.bracket : ''
  if (!isRatedBracket(bracket)) return fail(400, 'bad-bracket', 'Okänd nivågräns för bracket-matcher.')
  const checked = validateTeam(ctx.data, ctx.balance, input.team, bracket)
  if (!checked.ok) return fail(400, 'invalid-team', 'Laget är inte giltigt.', checked.errors)
  const profile = await db.profileOf(ctx.userId)
  if (!profile) return fail(403, 'no-profile', 'Du saknar profil. Spela introt först.')
  if ((await db.countRecentBracketMatches(ctx.userId, ctx.now - 3600_000)) >= MAX_BRACKET_MATCHES_PER_HOUR) {
    return fail(429, 'rate-limit', `Du kan spela högst ${MAX_BRACKET_MATCHES_PER_HOUR} bracket-matcher per timme. Vänta en stund.`)
  }

  await db.saveEntry(ctx.userId, bracket, checked.team)
  const candidates = await db.entriesInBracket(bracket, ctx.userId)
  const recent = await db.recentOpponents(ctx.userId, bracket, RECENT_OPPONENTS)
  const own = await db.ratingOf(ctx.userId, bracket)
  const opponent = pickOpponent(candidates, ctx.userId, own, recent, ctx.rng)
  if (!opponent) return { ok: true, status: 'waiting', message: 'Ingen motståndare än, ditt lag väntar. Matchen spelas automatiskt när nästa spelare skickar in ett lag.' }

  const seed = seedOf(ctx.rng)
  const result = simulatePvp({ data: ctx.data, balance: ctx.balance, teamA: checked.team, teamB: opponent.team, seed })
  const matchId = await db.recordMatch({
    kind: 'bracket', bracket, playerA: ctx.userId, playerB: opponent.userId, teamA: checked.team, teamB: opponent.team, seed,
    engineVersion: result.engineVersion, result: result.winner, events: result.events, ratingChangeA: null, ratingChangeB: null,
  })
  const opponentProfile = (await db.profileOf(opponent.userId)) ?? { userId: opponent.userId, displayName: '?', tag: 0 }
  return {
    ok: true, status: 'played', matchId, opponent: opponentProfile, reason: result.reason, ratingChange: null,
    winner: result.winner === 'a' ? 'you' : result.winner === 'b' ? 'opponent' : 'draw',
  }
}

export type ChallengeResult = Failure | { ok: true, challengeId: string, opponent: PublicProfile }

/** Sends a challenge to another player by their id (`#1452` -> 1452). No rating is involved. */
export async function sendChallenge(db: Db, ctx: Context, input: { toTag?: unknown, bracket?: unknown, team?: unknown }): Promise<ChallengeResult> {
  const bracket = typeof input.bracket === 'string' ? input.bracket : ''
  if (!isBracket(bracket)) return fail(400, 'bad-bracket', 'Okänd nivågräns.')
  const tag = typeof input.toTag === 'number' && Number.isInteger(input.toTag) ? input.toTag : NaN
  if (!Number.isFinite(tag)) return fail(400, 'bad-id', 'Ogiltigt spelar-ID.')
  const target = await db.profileByTag(tag)
  if (!target) return fail(404, 'unknown-player', `Ingen spelare har ID #${tag}.`)
  if (target.userId === ctx.userId) return fail(400, 'self', 'Du kan inte utmana dig själv.')
  const checked = validateTeam(ctx.data, ctx.balance, input.team, bracket)
  if (!checked.ok) return fail(400, 'invalid-team', 'Laget är inte giltigt.', checked.errors)
  if ((await db.countRecentChallenges(ctx.userId, ctx.now - 3600_000)) >= MAX_CHALLENGES_PER_HOUR) {
    return fail(429, 'rate-limit', `Du kan skicka högst ${MAX_CHALLENGES_PER_HOUR} utmaningar per timme.`)
  }
  if ((await db.countPendingOutgoing(ctx.userId, ctx.now)) >= MAX_PENDING_CHALLENGES) {
    return fail(429, 'too-many-pending', `Du har redan ${MAX_PENDING_CHALLENGES} obesvarade utmaningar. Vänta på svar först.`)
  }
  const id = await db.insertChallenge({
    fromUser: ctx.userId, toUser: target.userId, bracket, teamFrom: checked.team, status: 'pending', createdAt: ctx.now, expiresAt: ctx.now + CHALLENGE_EXPIRY_MS,
  })
  return { ok: true, challengeId: id, opponent: target }
}

export type RespondResult = Failure | { ok: true, status: 'declined' } | ({ ok: true, status: 'accepted' } & MatchSummary)

/** Answers a challenge: declining closes it, accepting needs the answerer's own 3 Pokémon in the same bracket; the match is then played at once. */
export async function respondChallenge(db: Db, ctx: Context, input: { challengeId?: unknown, accept?: unknown, team?: unknown }): Promise<RespondResult> {
  if (typeof input.challengeId !== 'string') return fail(400, 'bad-challenge', 'Saknar utmaning.')
  const challenge = await db.getChallenge(input.challengeId)
  if (!challenge || challenge.toUser !== ctx.userId) return fail(404, 'unknown-challenge', 'Utmaningen finns inte.')
  if (challenge.status !== 'pending') return fail(409, 'already-answered', 'Utmaningen är redan besvarad.')
  if (challenge.expiresAt <= ctx.now) {
    await db.setChallengeStatus(challenge.id, 'expired')
    return fail(410, 'expired', 'Utmaningen har gått ut.')
  }
  if (input.accept !== true) {
    await db.setChallengeStatus(challenge.id, 'declined')
    return { ok: true, status: 'declined' }
  }
  const checked = validateTeam(ctx.data, ctx.balance, input.team, challenge.bracket)
  if (!checked.ok) return fail(400, 'invalid-team', 'Laget är inte giltigt.', checked.errors)

  const seed = seedOf(ctx.rng)
  const result = simulatePvp({ data: ctx.data, balance: ctx.balance, teamA: challenge.teamFrom, teamB: checked.team, seed })
  const matchId = await db.recordMatch({
    kind: 'challenge', bracket: challenge.bracket, playerA: challenge.fromUser, playerB: ctx.userId, teamA: challenge.teamFrom, teamB: checked.team, seed,
    engineVersion: result.engineVersion, result: result.winner, events: result.events, ratingChangeA: null, ratingChangeB: null,
  }, { challengeId: challenge.id })
  const challenger = (await db.profileOf(challenge.fromUser)) ?? { userId: challenge.fromUser, displayName: '?', tag: 0 }
  return {
    ok: true, status: 'accepted', matchId, opponent: challenger, reason: result.reason, ratingChange: null,
    winner: result.winner === 'b' ? 'you' : result.winner === 'a' ? 'opponent' : 'draw',
  }
}

/** A seeded random source for the handlers outside tests. */
export const randomRng = (seed = Math.floor(Math.random() * 0xFFFFFFFF)): Rng => createRng(seed)
