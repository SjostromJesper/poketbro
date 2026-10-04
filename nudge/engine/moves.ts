// Move classification and static helpers.
import type { MoveData } from '../data/types'
import type { Balance, MoveCategory } from './balance'

/** Move targets that affect the user (or its side) instead of the opponent. */
const SELF_TARGETS = new Set(['user', 'user-and-allies', 'users-field', 'ally'])

/** Status ailments the engine implements. */
export const SUPPORTED_AILMENTS = new Set(['paralysis', 'sleep', 'freeze', 'burn', 'poison', 'confusion', 'leech-seed', 'protect', 'unknown'])

/** Status moves with a hand-written effect in moveExec.ts. */
export const SPECIAL_STATUS_MOVES = new Set(['focus-energy', 'haze', 'rest', 'belly-drum', 'protect', 'detect'])

export function targetsSelf(move: MoveData): boolean {
  return SELF_TARGETS.has(move.target)
}

export function isDamaging(move: MoveData): boolean {
  return move.damageClass !== 'status'
}

/** True when a damaging move has a way to deal damage in the engine (fixed power, fixed damage or OHKO). */
export function hasDamageModel(move: MoveData, balance: Balance): boolean {
  return move.power != null
    || move.name in balance.VARIABLE_POWER
    || move.name in balance.FIXED_DAMAGE
    || balance.OHKO_MOVES.includes(move.name)
}

/** Status/odd moves whose effect is not implemented in the MVP: they can be used but do nothing. */
export function isInert(move: MoveData, balance: Balance): boolean {
  if (isDamaging(move)) return !hasDamageModel(move, balance)
  if (SPECIAL_STATUS_MOVES.has(move.name)) return false
  if (move.statChanges.length > 0 || move.healing > 0) return false
  return !SUPPORTED_AILMENTS.has(move.ailment)
}

export function classifyMove(move: MoveData, balance: Balance): MoveCategory {
  if (isDamaging(move) && hasDamageModel(move, balance)) return 'attack'
  if (isDamaging(move)) return 'support'
  if (targetsSelf(move) || move.healing > 0) return 'defense'
  if (move.ailment === 'protect') return 'defense'
  return 'support'
}

export function effectivePower(move: MoveData, balance: Balance): number | null {
  return move.power ?? balance.VARIABLE_POWER[move.name] ?? null
}

export function isChargeMove(move: MoveData, balance: Balance): boolean {
  return move.name in balance.CHARGE_MOVES
}

export function isRechargeMove(move: MoveData, balance: Balance): boolean {
  return balance.RECHARGE_MOVES.includes(move.name)
}
