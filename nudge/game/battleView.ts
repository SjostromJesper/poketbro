// A plain-object snapshot of a running battle for the UI (and the debug overlay). Pure TypeScript.
import type { StatusId } from '../engine/types'
import type { BattleStatKey, TypeName } from '../data/types'
import { atbFillPerSecond, effectiveSpeed } from '../engine/atb'
import type { BattleEngine } from '../engine/battle'
import type { TraitId } from '../engine/balance'
import { classifyMove } from '../engine/moves'
import type { BattleResult, ChoiceDebug, Side } from '../engine/types'

export interface MoveView {
  index: number
  move: string
  name: string
  type: TypeName
  pp: number
  maxPp: number
  power: number | null
  category: 'attack' | 'defense' | 'support'
  usable: boolean
  /** The move that the next choice is nudged towards. */
  pending: boolean
  /** The Pokémon's favorite move: shown with a ♥, and nudging towards it is free. */
  favorite: boolean
}

export interface BattlerView {
  side: Side
  uid: string
  teamIndex: number
  name: string
  speciesId: number
  level: number
  types: TypeName[]
  sprite: { front: string, back: string, icon: string }
  hp: number
  maxHp: number
  hpPct: number
  atb: number
  atbPct: number
  fillPerSec: number
  effectiveSpeed: number
  status: StatusId | null
  confused: boolean
  seeded: boolean
  protectedNow: boolean
  napping: boolean
  fainted: boolean
  charging: { move: string, moveName: string, remainingMs: number } | null
  trait: TraitId
  nature: string
  trust: number
  heldItem: string | null
  stages: { stat: BattleStatKey, stage: number }[]
  moves: MoveView[]
  /** Habit progress per move (debug overlay). */
  habits: Record<string, number>
  nudge: { budget: number, used: number, remaining: number, pending: { moveIndex: number, strength: number } | null }
}

export interface TeamMemberView {
  teamIndex: number
  name: string
  speciesId: number
  level: number
  icon: string
  hp: number
  maxHp: number
  fainted: boolean
  active: boolean
  status: StatusId | null
}

export interface BattleView {
  kind: 'wild' | 'trainer' | 'pvp'
  player: BattlerView
  enemy: BattlerView
  team: TeamMemberView[]
  enemyTeamSize: number
  enemyRemaining: number
  result: BattleResult | null
  lockMs: number
  cooldowns: { switchMs: number, itemMs: number, ballMs: number }
  timeMs: number
  /** True while a thrown ball is being animated: everything is paused and the buttons are greyed out. */
  capturing: boolean
  /** Theoretical catch chance (0-1) per ball item for the current wild Pokémon, for the debug overlay. */
  captureChances: Record<string, number> | null
  debug?: { player: ChoiceDebug, enemy: ChoiceDebug }
}

function battlerView(engine: BattleEngine, side: Side): BattlerView {
  const b = engine.active(side)
  const { data, balance } = engine
  const species = data.species[b.speciesId]
  const pending = b.pendingNudge
  return {
    side,
    uid: b.uid,
    teamIndex: b.teamIndex,
    name: b.name,
    speciesId: b.speciesId,
    level: b.level,
    types: b.types,
    sprite: species.sprites,
    hp: b.hp,
    maxHp: b.stats.hp,
    hpPct: b.stats.hp > 0 ? Math.max(0, Math.min(100, (b.hp / b.stats.hp) * 100)) : 0,
    atb: b.atb,
    atbPct: Math.max(0, Math.min(100, (b.atb / balance.ATB_MAX) * 100)),
    fillPerSec: atbFillPerSecond(b, balance),
    effectiveSpeed: effectiveSpeed(b, balance),
    status: b.status,
    confused: b.confusionMs > 0,
    seeded: b.seeded,
    protectedNow: b.protectedMs > 0,
    napping: b.action?.kind === 'napping',
    fainted: b.fainted,
    charging: b.action?.kind === 'charging'
      ? { move: b.action.move, moveName: data.moves[b.action.move]?.displayName ?? b.action.move, remainingMs: Math.max(0, b.action.remainingMs) }
      : null,
    trait: b.trait,
    nature: b.nature,
    trust: b.trust,
    heldItem: b.heldItem && !b.heldItemUsed ? b.heldItem : null,
    stages: (Object.entries(b.stages) as [BattleStatKey, number][]).filter(([, stage]) => stage !== 0).map(([stat, stage]) => ({ stat, stage })),
    moves: b.moves.map((instance, index) => {
      const move = data.moves[instance.move]
      return {
        index,
        move: instance.move,
        name: move.displayName,
        type: move.type,
        pp: instance.pp,
        maxPp: instance.maxPp,
        power: move.power,
        category: classifyMove(move, balance),
        usable: instance.pp > 0,
        pending: pending?.moveIndex === index,
        favorite: b.favoriteMove === instance.move,
      }
    }),
    habits: { ...b.habits },
    nudge: {
      budget: b.nudgeBudget,
      used: b.nudgesUsed,
      remaining: Math.max(0, b.nudgeBudget - b.nudgesUsed),
      pending: pending ? { moveIndex: pending.moveIndex, strength: pending.strength } : null,
    },
  }
}

export function buildBattleView(engine: BattleEngine, includeDebug = false): BattleView {
  const { state, data } = engine
  const view: BattleView = {
    kind: state.kind,
    player: battlerView(engine, 'player'),
    enemy: battlerView(engine, 'enemy'),
    team: state.player.battlers.map(b => ({
      teamIndex: b.teamIndex,
      name: b.name,
      speciesId: b.speciesId,
      level: b.level,
      icon: data.species[b.speciesId].sprites.icon,
      hp: b.hp,
      maxHp: b.stats.hp,
      fainted: b.fainted,
      active: b.teamIndex === state.player.activeIndex,
      status: b.status,
    })),
    enemyTeamSize: state.enemy.battlers.length,
    enemyRemaining: state.enemy.battlers.filter(b => !b.fainted).length,
    result: state.result,
    lockMs: state.lockMs,
    cooldowns: { ...state.cooldowns },
    timeMs: state.timeMs,
    capturing: state.capture !== null,
    captureChances: state.kind === 'wild'
      ? Object.fromEntries(Object.keys(engine.balance.BALL_BONUS).map(ball => [ball, engine.captureChance(ball)]))
      : null,
  }
  if (includeDebug) view.debug = { player: engine.debugChoice('player'), enemy: engine.debugChoice('enemy') }
  return view
}
