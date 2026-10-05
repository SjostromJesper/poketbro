// The ladders (PLAN-4 2.9): how placement works and how a ladder page and the player's own row are described. `rankLadder` is the reference for what the SQL functions
// in 0017_nudge_standings.sql compute on the server, and it is what the tests check the rules against. Pure TypeScript.
import { formatPlayer } from './account'
import { ELO } from '../server/elo'

export const LADDER_PAGE_SIZE = 50

export interface LadderRow {
  userId: string
  displayName: string
  tag: number
  rating: number
  games: number
  wins: number
  losses: number
  draws: number
  /** The place (equal ratings share one); null = not placed (fewer than 3 matches). */
  rank: number | null
  /** The 1-based position in the list: placed players first, then the others. */
  position: number
}

export type RawRow = Omit<LadderRow, 'rank' | 'position'>

/** Orders and ranks a ladder the way the server does: players with at least 3 matches by rating (`rank()`: ties share a place), the rest after them. */
export function rankLadder(rows: RawRow[]): LadderRow[] {
  const placed = (r: RawRow) => r.games >= ELO.MIN_GAMES_FOR_PLACING
  const sorted = [...rows].sort((a, b) => Number(placed(b)) - Number(placed(a)) || b.rating - a.rating || b.games - a.games || (a.userId < b.userId ? -1 : 1))
  const out: LadderRow[] = []
  let rank = 0
  sorted.forEach((row, i) => {
    if (placed(row)) {
      const previous = out[i - 1]
      rank = previous && previous.rank !== null && previous.rating === row.rating ? previous.rank : i + 1
    }
    out.push({ ...row, rank: placed(row) ? rank : null, position: i + 1 })
  })
  return out
}

/** The ladder page (0-based) a list position is on. */
export function pageOfPosition(position: number, pageSize = LADDER_PAGE_SIZE): number {
  return Math.max(0, Math.floor((position - 1) / pageSize))
}

export const rankLabel = (row: Pick<LadderRow, 'rank'>): string => (row.rank === null ? 'Ej placerad' : `#${row.rank}`)

export function recordText(row: Pick<LadderRow, 'wins' | 'losses' | 'draws'>): string {
  return `${row.wins} vinster, ${row.losses} förluster, ${row.draws} oavgjorda`
}

/** The lines above the ladder: the player's own placement, rating and record, or that they have no matches yet. */
export function describeMine(row: LadderRow | null, placedPlayers = 0): string[] {
  if (!row || row.games === 0) return ['Inga matcher än.']
  const place = row.rank === null
    ? `Ej placerad (${ELO.MIN_GAMES_FOR_PLACING - row.games > 0 ? `${ELO.MIN_GAMES_FOR_PLACING - row.games} match${ELO.MIN_GAMES_FOR_PLACING - row.games > 1 ? 'er' : ''} till` : 'snart'})`
    : `Din placering: ${row.rank}${placedPlayers ? ` av ${placedPlayers}` : ''}`
  return [place, `Rating ${row.rating} · ${recordText(row)}`]
}

export const ladderLine = (row: LadderRow): string => `${rankLabel(row)}  ${formatPlayer(row)}  ${row.rating}  (${row.games} matcher)`
