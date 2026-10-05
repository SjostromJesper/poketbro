// An in-memory `Db` for the tests of the server handlers.
import type { ChallengeRow, Db, EntryRow, MatchRecord, PublicProfile } from '../server/handlers'
import type { PokemonSnapshot } from '../server/snapshot'

export class MemoryDb implements Db {
  profiles: PublicProfile[] = []
  entries = new Map<string, { userId: string, bracket: string, team: PokemonSnapshot[] }>()
  ratings = new Map<string, number>()
  matches: (MatchRecord & { id: string, createdAt: number })[] = []
  challenges: ChallengeRow[] = []
  /** The clock used for `createdAt` of matches (set by the test). */
  now = 1_000_000

  addPlayer(userId: string, displayName: string, tag: number) {
    this.profiles.push({ userId, displayName, tag })
  }

  async profileOf(userId: string) { return this.profiles.find(p => p.userId === userId) ?? null }
  async profileByTag(tag: number) { return this.profiles.find(p => p.tag === tag) ?? null }
  async countRecentBracketMatches(userId: string, sinceMs: number) { return this.matches.filter(m => m.kind === 'bracket' && m.playerA === userId && m.createdAt >= sinceMs).length }
  async countRecentChallenges(userId: string, sinceMs: number) { return this.challenges.filter(c => c.fromUser === userId && c.createdAt >= sinceMs).length }
  async countPendingOutgoing(userId: string, nowMs: number) { return this.challenges.filter(c => c.fromUser === userId && c.status === 'pending' && c.expiresAt > nowMs).length }
  async ratingOf(userId: string, bracket: string) { return this.ratings.get(`${userId}:${bracket}`) ?? 1000 }
  async entriesInBracket(bracket: string, exceptUserId: string): Promise<EntryRow[]> {
    return [...this.entries.values()].filter(e => e.bracket === bracket && e.userId !== exceptUserId).map(e => ({ userId: e.userId, team: e.team, rating: this.ratings.get(`${e.userId}:${bracket}`) ?? 1000 }))
  }
  async recentOpponents(userId: string, bracket: string, count: number) {
    return this.matches.filter(m => m.kind === 'bracket' && m.bracket === bracket && (m.playerA === userId || m.playerB === userId))
      .sort((a, b) => b.createdAt - a.createdAt).slice(0, count).map(m => (m.playerA === userId ? m.playerB : m.playerA))
  }
  async saveEntry(userId: string, bracket: string, team: PokemonSnapshot[]) { this.entries.set(`${userId}:${bracket}`, { userId, bracket, team }) }
  async recordMatch(match: MatchRecord, options?: { challengeId?: string }) {
    const id = `match-${this.matches.length + 1}`
    this.matches.push({ ...match, id, createdAt: this.now })
    if (options?.challengeId) {
      const c = this.challenges.find(x => x.id === options.challengeId)!
      c.status = 'accepted'
      c.matchId = id
    }
    return id
  }
  async insertChallenge(row: Omit<ChallengeRow, 'id' | 'matchId'>) {
    const id = `challenge-${this.challenges.length + 1}`
    this.challenges.push({ ...row, id, matchId: null })
    return id
  }
  async getChallenge(id: string) { return this.challenges.find(c => c.id === id) ?? null }
  async setChallengeStatus(id: string, status: 'declined' | 'expired') { this.challenges.find(c => c.id === id)!.status = status }
}
