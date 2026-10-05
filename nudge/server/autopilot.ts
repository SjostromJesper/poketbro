// An online match, simulated on the server (PLAN-4 2.3-2.4): both teams play on autopilot, no nudges and no actions. The same code runs in the game
// (tests, replays of the log) and in the Edge Functions, so a seed and two teams always give the same result and event log.
import type { GameData } from '../data/types'
import type { Balance } from '../engine/balance'
import { BattleEngine } from '../engine/battle'
import { ENGINE_VERSION } from '../engine/version'
import { createRng } from '../engine/rng'
import type { Battler, BattleEvent } from '../engine/types'
import { buildTeam, type PokemonSnapshot } from './snapshot'

export type MatchWinner = 'a' | 'b' | 'draw'

export interface FighterOutcome {
  uid: string
  speciesId: number
  name: string
  finalHp: number
  maxHp: number
}

export interface PvpResult {
  winner: MatchWinner
  /** `faint`: one side ran out of Pokémon. `timeout`: the time limit decided by the HP that was left. */
  reason: 'faint' | 'timeout'
  durationMs: number
  /** Share of the team's total HP that is left (0..1). */
  hpShareA: number
  hpShareB: number
  engineVersion: string
  events: BattleEvent[]
  teamA: FighterOutcome[]
  teamB: FighterOutcome[]
}

const outcomes = (battlers: Battler[]): FighterOutcome[] => battlers.map(b => ({ uid: b.uid, speciesId: b.speciesId, name: b.name, finalHp: Math.max(0, b.hp), maxHp: b.stats.hp }))
const share = (list: FighterOutcome[]) => {
  const max = list.reduce((sum, f) => sum + f.maxHp, 0)
  return max > 0 ? list.reduce((sum, f) => sum + f.finalHp, 0) / max : 0
}

/**
 * Plays team A against team B (both validated snapshots, in lineup order). Side A is the engine's "player" side, B the "enemy" side.
 * After `PVP_MAX_BATTLE_MS` of battle time the side with the larger share of HP left wins; exactly equal is a draw.
 */
export function simulatePvp(options: { data: GameData, balance: Balance, teamA: PokemonSnapshot[], teamB: PokemonSnapshot[], seed: number }): PvpResult {
  const { data, balance } = options
  const engine = new BattleEngine({
    player: buildTeam(data, balance, options.teamA),
    enemy: buildTeam(data, balance, options.teamB),
    kind: 'pvp',
    rng: createRng(options.seed),
    balance,
    data,
    badges: 0,
  })
  const events: BattleEvent[] = []
  const step = balance.STEP_MS
  let elapsed = 0
  // Real time does not matter here: the engine is driven in its own steps until it ends or the time limit is reached.
  while (!engine.finished && engine.state.timeMs < balance.PVP_MAX_BATTLE_MS && elapsed < balance.PVP_MAX_BATTLE_MS * 4) {
    events.push(...engine.tick(step))
    elapsed += step
  }
  const teamA = outcomes(engine.state.player.battlers)
  const teamB = outcomes(engine.state.enemy.battlers)
  const hpShareA = share(teamA)
  const hpShareB = share(teamB)
  let winner: MatchWinner
  let reason: PvpResult['reason'] = 'faint'
  if (engine.state.result === 'win') winner = 'a'
  else if (engine.state.result === 'lose') winner = 'b'
  else {
    reason = 'timeout'
    winner = hpShareA > hpShareB ? 'a' : hpShareB > hpShareA ? 'b' : 'draw'
  }
  return { winner, reason, durationMs: engine.state.timeMs, hpShareA, hpShareB, engineVersion: ENGINE_VERSION, events, teamA, teamB }
}
