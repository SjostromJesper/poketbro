// Core engine types. Pure TypeScript, no framework dependencies.
import type { BattleStatKey, GameData, StatBlock, TypeName } from '../data/types'
import type { Balance, TraitId } from './balance'
import type { Rng } from './rng'

export type { TraitId } from './balance'

export type Side = 'player' | 'enemy'
export type StatusId = 'burn' | 'poison' | 'paralysis' | 'sleep' | 'freeze'
export type BattleKind = 'wild' | 'trainer'
export type BattleResult = 'win' | 'lose' | 'fled' | 'caught'
export type Emote = '!' | '♪' | '…' | '💢' | '💤' | '♥'

export interface MoveInstance {
  move: string
  pp: number
  maxPp: number
}

/** A Pokémon in the player's possession (saved in localStorage) or a generated enemy. Stats are derived, not stored. */
export interface OwnedPokemon {
  uid: string
  speciesId: number
  nickname?: string
  level: number
  /** Total XP. */
  xp: number
  ivs: StatBlock
  nature: string
  trait: TraitId
  /** 0-255, the relationship with the player. */
  trust: number
  moves: MoveInstance[]
  heldItem?: string
  currentHp: number
  status?: StatusId
  /** Learned habits: move name -> value. These double as favorite-move progress. */
  habits: Record<string, number>
  /** The move this Pokémon loves to use (PLAN-2 1B). */
  favoriteMove?: string
  /** Battles left in which no new favorite can form (after the old one was forgotten). */
  favoriteCooldown?: number
  caughtAt: number
  originalTrainer: string
}

export type BattlerAction =
  | { kind: 'charging', move: string, remainingMs: number, semiInvulnerable: boolean }
  | { kind: 'napping', remainingMs: number }

export interface PendingNudge {
  moveIndex: number
  /** Probability mass moved onto the nudged move (0 when the nudge will be ignored, e.g. stubborn + status move). */
  strength: number
}

/** Runtime copy of a Pokémon while a battle is running. */
export interface Battler {
  uid: string
  side: Side
  teamIndex: number
  speciesId: number
  name: string
  level: number
  types: TypeName[]
  /** Final stats; `hp` is the max HP. */
  stats: StatBlock
  hp: number
  nature: string
  trait: TraitId
  trust: number
  moves: MoveInstance[]
  heldItem: string | null
  heldItemUsed: boolean
  status: StatusId | null
  /** Remaining sleep time. */
  statusMs: number
  confusionMs: number
  seeded: boolean
  protectedMs: number
  stages: Record<BattleStatKey, number>
  /** Extra crit stages (Focus Energy). */
  critBonus: number
  atb: number
  /** Fill-rate multiplier for the *current* bar (recharge moves). Reset after the bar completes. */
  fillMult: number
  action: BattlerAction | null
  habits: Record<string, number>
  /** Moves used in this battle (for habits). */
  movesUsed: Record<string, number>
  /** How many of those uses were chosen because the Pokémon followed a nudge. */
  nudgedUses: Record<string, number>
  favoriteMove: string | null
  nudgeBudget: number
  nudgesUsed: number
  pendingNudge: PendingNudge | null
  /** True once the Pokémon followed a nudge in this battle. */
  followedNudge: boolean
  endureUsed: boolean
  fainted: boolean
  /** Fractional damage/heal carried between simulation steps. */
  dotRemainder: number
  healRemainder: number
  /** uids of enemy battlers this Pokémon has been on the field against (for XP sharing). */
  facedEnemies: Set<string>
}

export interface SideState {
  battlers: Battler[]
  activeIndex: number
}

export interface Cooldowns {
  switchMs: number
  itemMs: number
  ballMs: number
}

/** A catch attempt in progress: the result is already decided, the UI plays the animation and then calls resolveCapture(). */
export interface CaptureState {
  ball: string
  shakes: number
  caught: boolean
  chance: number
}

export interface BattleState {
  kind: BattleKind
  player: SideState
  enemy: SideState
  timeMs: number
  lockMs: number
  paused: boolean
  cooldowns: Cooldowns
  runAttempts: number
  result: BattleResult | null
  nudgeRefillMs: number
  /** Set while a ball is being thrown: the battle is paused until resolveCapture(). */
  capture: CaptureState | null
}

export interface BattleConfig {
  player: OwnedPokemon[]
  enemy: OwnedPokemon[]
  kind: BattleKind
  rng: Rng
  balance: Balance
  data: GameData
  /** Number of badges the player owns (obedience cap). */
  badges?: number
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export type DamageSource = 'move' | 'recoil' | 'status' | 'confusion' | 'leech-seed' | 'struggle'
export type NudgeResult = 'accepted' | 'replaced' | 'same-move' | 'exhausted' | 'unavailable'

export type BattleEvent =
  | { type: 'send-out', side: Side, name: string, teamIndex: number, speciesId: number, forced: boolean }
  | { type: 'move-chosen', side: Side, name: string, move: string, moveName: string, followedNudge: boolean | null, favorite: boolean }
  | { type: 'emote', side: Side, emote: Emote }
  | { type: 'charge-start', side: Side, name: string, move: string, moveName: string, ms: number }
  | { type: 'move-used', side: Side, name: string, move: string, moveName: string, moveType: TypeName }
  | { type: 'miss', side: Side, name: string, moveName: string }
  | { type: 'no-effect', side: Side, name: string, reason: 'immune' | 'failed' | 'inert' | 'protected' | 'unaffected' }
  | { type: 'damage', side: Side, name: string, amount: number, hp: number, maxHp: number, effectiveness: number, crit: boolean, source: DamageSource }
  | { type: 'multi-hit', side: Side, name: string, hits: number }
  | { type: 'heal', side: Side, name: string, amount: number, hp: number, maxHp: number, source: 'move' | 'drain' | 'item' | 'berry' | 'leftovers' | 'leech-seed' | 'rest' }
  | { type: 'status', side: Side, name: string, status: StatusId | 'confusion' | 'leech-seed' | 'protect' }
  | { type: 'effect', side: Side, name: string, effect: 'focus-energy' | 'haze' | 'rest' | 'belly-drum' }
  | { type: 'status-cured', side: Side, name: string, status: StatusId | 'confusion', reason: 'timeout' | 'item' | 'thaw' | 'wake' | 'move' }
  | { type: 'status-skip', side: Side, name: string, reason: 'paralysis' | 'confusion-hurt' }
  | { type: 'stat-change', side: Side, name: string, stat: BattleStatKey, delta: number, stage: number }
  | { type: 'flinch', side: Side, name: string }
  | { type: 'faint', side: Side, name: string }
  | { type: 'endure', side: Side, name: string }
  | { type: 'disobey', side: Side, name: string, outcome: 'loaf' | 'random' | 'nap' }
  | { type: 'nudge', result: NudgeResult, moveIndex: number, remaining: number }
  | { type: 'held-item', side: Side, name: string, item: string }
  | { type: 'item-used', side: Side, name: string, item: string }
  | { type: 'switch', side: Side, fromName: string, toName: string, teamIndex: number }
  | { type: 'capture', ball: string, name: string, shakes: number, caught: boolean, chance: number }
  | { type: 'capture-result', name: string, shakes: number, caught: boolean }
  | { type: 'run', success: boolean }
  | { type: 'unsupported', side: Side, name: string, moveName: string }
  | { type: 'battle-end', result: BattleResult }

// ---------------------------------------------------------------------------
// Player actions and results
// ---------------------------------------------------------------------------

export type PlayerAction =
  | { type: 'ball', ball?: string }
  | { type: 'item', item: string, targetIndex: number }
  | { type: 'run' }
  | { type: 'switch', teamIndex: number }

export interface ActionResult {
  accepted: boolean
  reason?: 'finished' | 'cooldown' | 'invalid' | 'not-wild' | 'fainted' | 'no-effect' | 'capturing'
  events: BattleEvent[]
}

export interface NudgeOutcome {
  result: NudgeResult
  /** Nudges left for the active Pokémon. */
  remaining: number
  events: BattleEvent[]
}

/** What happened to one party member, for the game layer to apply after the battle. */
export interface PartyUpdate {
  uid: string
  currentHp: number
  status: StatusId | null
  moves: MoveInstance[]
  /** null when the held item was consumed in battle. */
  heldItem: string | null
  fainted: boolean
  participated: boolean
  movesUsed: Record<string, number>
  /** Uses that happened because a nudge was followed (they count extra for habits). */
  nudgedMoves: Record<string, number>
  followedNudge: boolean
  trait: TraitId
}

export interface BattleOutcome {
  result: BattleResult
  party: PartyUpdate[]
  /** uid -> XP gained from this battle. */
  xp: Record<string, number>
  defeated: { speciesId: number, level: number }[]
  /** Set when a wild Pokémon was caught. */
  caught: OwnedPokemon | null
}

export interface MoveChoice {
  moveIndex: number
  move: string
  category: 'attack' | 'defense' | 'support'
  /** Relative weight before normalisation. */
  weight: number
  pAuto: number
  pFinal: number
  /** Estimated damage (attack moves), for the debug overlay. */
  expectedDamage: number
  /** This move is the Pokémon's favorite. */
  favorite: boolean
  /** The favorite multiplier that was applied to its weight (1 = none, e.g. when it would have no effect). */
  favoriteMult: number
}

export interface ChoiceDebug {
  moves: MoveChoice[]
  smart: number
  nudgeStrength: number
  nudgedMoveIndex: number | null
  categoryWeights: Record<'attack' | 'defense' | 'support', number>
  struggle: boolean
}
