// Status effects in ATB form: application rules, timers and damage over time.
import type { TypeName } from '../data/types'
import type { Balance } from './balance'
import { randInt, type Rng } from './rng'
import type { BattleEvent, Battler, StatusId } from './types'

const STATUS_IMMUNE_TYPES: Record<StatusId, TypeName[]> = {
  burn: ['fire'],
  poison: ['poison', 'steel'],
  paralysis: ['electric'],
  freeze: ['ice'],
  sleep: [],
}

export function canReceiveStatus(target: Battler, status: StatusId): boolean {
  if (target.fainted || target.status) return false
  return !STATUS_IMMUNE_TYPES[status].some(type => target.types.includes(type))
}

export function canReceiveConfusion(target: Battler): boolean {
  return !target.fainted && target.confusionMs <= 0
}

/** Sets the status (caller has already checked canReceiveStatus). Sleep gets its duration here. */
export function applyStatus(target: Battler, status: StatusId, rng: Rng, balance: Balance): void {
  target.status = status
  if (status === 'sleep') target.statusMs = randInt(rng, balance.SLEEP_MS_RANGE[0], balance.SLEEP_MS_RANGE[1])
  if (status === 'paralysis') {
    // A paralysed Pokémon fills its bar slower, which the ATB code reads from `status` directly.
  }
}

export function applyConfusion(target: Battler, rng: Rng, balance: Balance): void {
  target.confusionMs = randInt(rng, balance.CONFUSION_MS_RANGE[0], balance.CONFUSION_MS_RANGE[1])
}

export function cureStatus(target: Battler): void {
  target.status = null
  target.statusMs = 0
}

/** Counts down timed states (sleep, freeze thaw chance, confusion, protect, nap). */
export function tickTimedStates(target: Battler, dtMs: number, rng: Rng, balance: Balance, events: BattleEvent[]): void {
  if (target.fainted) return
  if (target.status === 'sleep') {
    target.statusMs -= dtMs
    if (target.statusMs <= 0) {
      cureStatus(target)
      events.push({ type: 'status-cured', side: target.side, name: target.name, status: 'sleep', reason: 'wake' })
    }
  } else if (target.status === 'freeze') {
    if (rng.next() < (balance.FREEZE_THAW_PER_SEC * dtMs) / 1000) {
      cureStatus(target)
      events.push({ type: 'status-cured', side: target.side, name: target.name, status: 'freeze', reason: 'thaw' })
    }
  }
  if (target.confusionMs > 0) {
    target.confusionMs -= dtMs
    if (target.confusionMs <= 0) {
      target.confusionMs = 0
      events.push({ type: 'status-cured', side: target.side, name: target.name, status: 'confusion', reason: 'timeout' })
    }
  }
  if (target.protectedMs > 0) target.protectedMs = Math.max(0, target.protectedMs - dtMs)
  if (target.action?.kind === 'napping') {
    target.action.remainingMs -= dtMs
    if (target.action.remainingMs <= 0) target.action = null
  }
}

/** Fraction of max HP lost per second from burn/poison (0 when none). */
export function statusDamagePerSecond(target: Battler, balance: Balance): number {
  if (target.status === 'burn') return balance.BURN_PCT_PER_SEC
  if (target.status === 'poison') return balance.POISON_PCT_PER_SEC
  return 0
}
