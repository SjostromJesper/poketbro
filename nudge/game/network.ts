// The logic behind the computer's network menu (PLAN-4 2.7): who can be in a team, how a team is put together, and what the results say. Pure TypeScript.
import type { OwnedPokemon } from '../engine/types'
import { formatPlayer } from './account'
import { bracketLabel, bracketRange, fitsBracket, TEAM_SIZE } from '../server/brackets'
import type { MatchSummary, RespondResult, SubmitResult, ChallengeResult } from '../server/handlers'

export interface Eligibility {
  ok: boolean
  /** Why the Pokémon cannot be picked (shown greyed out). */
  reason?: string
}

/** Whether a Pokémon may be in a team for the bracket: its level must be inside the range. */
export function eligibility(pokemon: Pick<OwnedPokemon, 'level'>, bracket: string): Eligibility {
  const range = bracketRange(bracket)
  if (!range) return { ok: false, reason: 'Okänd nivågräns' }
  if (fitsBracket(pokemon.level, bracket)) return { ok: true }
  return { ok: false, reason: pokemon.level < range.min ? `För låg nivå (kräver ${range.min}-${range.max})` : `För hög nivå (max ${range.max})` }
}

/** How many of the Pokémon fit the bracket (for the bracket list). */
export function eligibleCount(pokemon: Pick<OwnedPokemon, 'level'>[], bracket: string): number {
  return pokemon.filter(p => eligibility(p, bracket).ok).length
}

/** Adds or removes a Pokémon from the selection. The line-up is the order they are picked in. Returns the new selection (max 3). */
export function toggleSelection(selection: string[], uid: string): string[] {
  if (selection.includes(uid)) return selection.filter(id => id !== uid)
  return selection.length >= TEAM_SIZE ? selection : [...selection, uid]
}

/** Moves the Pokémon at `index` one step up (-1) or down (+1) in the line-up. */
export function moveInSelection(selection: string[], index: number, step: -1 | 1): string[] {
  const target = index + step
  if (index < 0 || index >= selection.length || target < 0 || target >= selection.length) return selection
  const next = [...selection]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

export interface ServerError {
  ok: false
  code?: string
  message: string
  errors?: string[]
}

/** All the lines to show for an error from the server: the message and every reason the team was refused. */
export function errorLines(error: ServerError): string[] {
  return [error.message, ...(error.errors ?? [])]
}

export type OpponentLike = { displayName: string, tag: number }

/** "Du vann mot Anna #1452!" and the like. */
export function matchHeadline(summary: Pick<MatchSummary, 'winner' | 'opponent' | 'reason'>): string {
  const who = formatPlayer(summary.opponent)
  if (summary.winner === 'you') return `Du vann mot ${who}!`
  if (summary.winner === 'opponent') return `Du förlorade mot ${who}.`
  return `Oavgjort mot ${who}.`
}

export function ratingText(change: number | null): string {
  if (change === null) return ''
  return change > 0 ? `Rating +${change}` : change < 0 ? `Rating ${change}` : 'Rating oförändrad'
}

/** The lines the computer shows after sending in a team to a bracket. */
export function submitLines(result: SubmitResult): string[] {
  if (!result.ok) return errorLines(result)
  if (result.status === 'waiting') return [result.message]
  return [matchHeadline(result), result.reason === 'timeout' ? 'Tiden tog slut: den med mest HP kvar vann.' : '', ratingText(result.ratingChange)].filter(Boolean)
}

export function challengeSentLines(result: ChallengeResult): string[] {
  if (!result.ok) return errorLines(result)
  return [`Utmaningen skickades till ${formatPlayer(result.opponent)}.`, 'Den ligger i hens inkorg i sju dagar.']
}

export function respondLines(result: RespondResult): string[] {
  if (!result.ok) return errorLines(result)
  if (result.status === 'declined') return ['Du avböjde utmaningen.']
  return [matchHeadline(result), 'Resultatet och reprisen ligger i din inkorg.']
}

export const OFFLINE_MESSAGE = 'Datorn får ingen kontakt med nätverket.'

export interface InboxChallenge {
  id: string
  from: OpponentLike
  bracket: string
  createdAt: number
  expiresAt: number
}

export interface InboxMatch {
  id: string
  kind: 'bracket' | 'challenge'
  bracket: string
  createdAt: number
  opponent: OpponentLike
  /** From the player's own point of view. */
  outcome: 'win' | 'loss' | 'draw'
  ratingChange: number | null
}

export function describeInboxChallenge(c: InboxChallenge): string {
  return `${formatPlayer(c.from)} utmanar dig (${bracketLabel(c.bracket)})`
}

export function describeInboxMatch(m: InboxMatch): string {
  const result = m.outcome === 'win' ? 'Vinst mot' : m.outcome === 'loss' ? 'Förlust mot' : 'Oavgjort mot'
  return `${m.kind === 'bracket' ? 'Bracket' : 'Utmaning'} ${bracketLabel(m.bracket)}: ${result} ${formatPlayer(m.opponent)}${m.ratingChange !== null ? ` (${ratingText(m.ratingChange)})` : ''}`
}

/** The result of a match row from the point of view of `userId`. */
export function outcomeFor(result: 'a' | 'b' | 'draw', playerA: string, userId: string): 'win' | 'loss' | 'draw' {
  if (result === 'draw') return 'draw'
  const aWon = result === 'a'
  return (playerA === userId) === aWon ? 'win' : 'loss'
}

/** How many new things the player has to look at: challenges waiting, and results that came in after they last looked. */
export function unseenCount(challenges: { createdAt: number }[], matches: { createdAt: number }[], lastSeenAt: number): number {
  return challenges.length + matches.filter(m => m.createdAt > lastSeenAt).length
}
