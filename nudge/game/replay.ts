// Replays of online matches (PLAN-4 2.8): the saved event log is played back step by step. The log is *read*, the battle is not simulated again, so old replays
// keep working when the engine changes. This module keeps the picture of the battle (who is out, HP, status) up to date from the events. Pure TypeScript.
import type { GameData, TypeName } from '../data/types'
import type { Balance } from '../engine/balance'
import { buildTeam, type PokemonSnapshot } from '../server/snapshot'
import type { BattleEvent, Side, StatusId } from '../engine/types'
import type { MatchWinner } from '../server/autopilot'
import { maxHpOf } from '../engine/pokemon'

export interface ReplayMember {
  speciesId: number
  name: string
  level: number
  types: TypeName[]
  hp: number
  maxHp: number
  status: StatusId | null
  fainted: boolean
}

export interface ReplaySide {
  team: ReplayMember[]
  /** Index of the Pokémon that is out (-1 before the first send-out). */
  active: number
}

export interface ReplayState {
  player: ReplaySide
  enemy: ReplaySide
  /** How many events have been played, and how many there are. */
  index: number
  total: number
  winner: MatchWinner | null
}

const STATUSES: string[] = ['burn', 'poison', 'paralysis', 'sleep', 'freeze']

/** How long (ms, at 1x) an event stays on screen before the next one. Moves and hits take longer than small notes. */
export function eventDelay(event: BattleEvent): number {
  switch (event.type) {
    case 'send-out': return 900
    case 'move-used': return 800
    case 'damage': return 600
    case 'faint': return 1100
    case 'heal': return 500
    case 'emote': case 'move-chosen': case 'nudge': case 'held-item': return 80
    case 'battle-end': return 1200
    default: return 450
  }
}

export class ReplayPlayer {
  readonly state: ReplayState
  private position = 0

  constructor(private readonly events: BattleEvent[], teamA: PokemonSnapshot[], teamB: PokemonSnapshot[], data: GameData, balance: Balance, winner: MatchWinner) {
    const side = (snaps: PokemonSnapshot[]): ReplaySide => ({
      active: -1,
      team: buildTeam(data, balance, snaps).map((p): ReplayMember => {
        const species = data.species[p.speciesId]
        const max = maxHpOf(data, p)
        return { speciesId: p.speciesId, name: p.nickname || species.displayName, level: p.level, types: species.types, hp: max, maxHp: max, status: null, fainted: false }
      }),
    })
    this.state = { player: side(teamA), enemy: side(teamB), index: 0, total: events.length, winner: null }
    this.winnerOfMatch = winner
  }

  private readonly winnerOfMatch: MatchWinner

  get done(): boolean {
    return this.position >= this.events.length
  }

  private member(side: Side, name: string): ReplayMember | undefined {
    const s = this.state[side]
    const active = s.team[s.active]
    return active && (active.name === name || !name) ? active : s.team.find(m => m.name === name && !m.fainted)
  }

  /** Plays the next event: updates the picture and returns the event (null at the end). */
  next(): BattleEvent | null {
    const event = this.events[this.position]
    if (!event) return null
    this.position++
    this.state.index = this.position
    this.apply(event)
    return event
  }

  /** Plays everything that is left (the "Hoppa till slutet" button). */
  skipToEnd(): void {
    while (this.next()) { /* apply all */ }
  }

  private apply(event: BattleEvent): void {
    switch (event.type) {
      case 'send-out': {
        this.state[event.side].active = event.teamIndex
        break
      }
      case 'damage':
      case 'heal': {
        const m = this.member(event.side, event.name)
        if (m) {
          m.maxHp = event.maxHp
          m.hp = Math.max(0, event.hp)
        }
        break
      }
      case 'faint': {
        const m = this.member(event.side, event.name)
        if (m) {
          m.hp = 0
          m.fainted = true
          m.status = null
        }
        break
      }
      case 'status': {
        const m = this.member(event.side, event.name)
        if (m && STATUSES.includes(event.status)) m.status = event.status as StatusId
        break
      }
      case 'status-cured': {
        const m = this.member(event.side, event.name)
        if (m && STATUSES.includes(event.status)) m.status = null
        break
      }
      case 'battle-end':
        this.state.winner = this.winnerOfMatch
        break
      default:
        break
    }
    if (this.done && this.state.winner === null) this.state.winner = this.winnerOfMatch
  }
}
