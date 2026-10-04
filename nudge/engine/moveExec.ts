// Executing a move: accuracy, damage, drain/recoil, secondary effects, status moves.
// Works on Battlers and pushes BattleEvents; it never decides *who* acts or when (that is battle.ts).
import type { BattleStatKey, GameData, MoveData } from '../data/types'
import type { Balance } from './balance'
import { typeBoostFor } from './choice'
import { accuracyStageMultiplier, calcDamage, critChance, stageMultiplier, typeEffectiveness } from './formulas'
import { effectivePower, isDamaging, isInert, targetsSelf } from './moves'
import { chance, pickOne, pickWeightedIndex, randInt, type Rng } from './rng'
import { applyConfusion, applyStatus, canReceiveConfusion, canReceiveStatus, cureStatus } from './status'
import type { BattleEvent, Battler, DamageSource, StatusId } from './types'

export interface ExecContext {
  rng: Rng
  balance: Balance
  data: GameData
  events: BattleEvent[]
}

export function makeStruggle(balance: Balance): MoveData {
  return {
    id: 165, name: 'struggle', displayName: 'Struggle', type: 'normal', power: balance.STRUGGLE_POWER, accuracy: null, pp: 1, priority: 0,
    damageClass: 'physical', target: 'selected-pokemon', ailment: 'none', ailmentChance: 0, critRate: 0, drain: 0, healing: 0,
    flinchChance: 0, minHits: null, maxHits: null, statChance: 0, statChanges: [],
  }
}

export function moveDataFor(ctx: Pick<ExecContext, 'data' | 'balance'>, moveName: string): MoveData {
  if (moveName === 'struggle') return makeStruggle(ctx.balance)
  const move = ctx.data.moves[moveName]
  if (!move) throw new Error(`Unknown move ${moveName}`)
  return move
}

// ---------------------------------------------------------------------------
// HP changes (shared with the engine's damage-over-time code)
// ---------------------------------------------------------------------------

export interface DamageInfo {
  effectiveness?: number
  crit?: boolean
  source: DamageSource
}

/** Applies damage, handling the high-trust endure and the Oran Berry. Returns the damage actually dealt. */
export function dealDamage(ctx: ExecContext, target: Battler, amount: number, info: DamageInfo): number {
  if (amount <= 0 || target.fainted) return 0
  const { balance, events } = ctx
  let dealt = Math.min(Math.floor(amount), target.hp)
  if (
    dealt >= target.hp && target.hp > 1 && !target.endureUsed && info.source === 'move'
    && target.trust >= balance.HIGH_TRUST_THRESHOLD && chance(ctx.rng, balance.ENDURE_CHANCE)
  ) {
    dealt = target.hp - 1
    target.endureUsed = true
    events.push({ type: 'endure', side: target.side, name: target.name })
  }
  target.hp -= dealt
  events.push({
    type: 'damage', side: target.side, name: target.name, amount: dealt, hp: target.hp, maxHp: target.stats.hp,
    effectiveness: info.effectiveness ?? 1, crit: info.crit ?? false, source: info.source,
  })
  if (target.hp <= 0) {
    target.hp = 0
    target.fainted = true
    target.action = null
    target.pendingNudge = null
    events.push({ type: 'faint', side: target.side, name: target.name, speciesId: target.speciesId })
  } else {
    checkBerry(ctx, target)
  }
  return dealt
}

export function healBattler(ctx: ExecContext, target: Battler, amount: number, source: 'move' | 'drain' | 'item' | 'berry' | 'leftovers' | 'leech-seed' | 'rest'): number {
  if (target.fainted) return 0
  const healed = Math.min(Math.floor(amount), target.stats.hp - target.hp)
  if (healed <= 0) return 0
  target.hp += healed
  ctx.events.push({ type: 'heal', side: target.side, name: target.name, amount: healed, hp: target.hp, maxHp: target.stats.hp, source })
  return healed
}

function checkBerry(ctx: ExecContext, battler: Battler): void {
  if (battler.heldItem !== 'oran-berry' || battler.heldItemUsed || battler.fainted) return
  if (battler.hp > battler.stats.hp * ctx.balance.ORAN_BERRY_THRESHOLD) return
  battler.heldItemUsed = true
  ctx.events.push({ type: 'held-item', side: battler.side, name: battler.name, item: 'oran-berry' })
  healBattler(ctx, battler, ctx.balance.ORAN_BERRY_HEAL, 'berry')
}

export function changeStage(ctx: ExecContext, battler: Battler, stat: BattleStatKey, change: number): void {
  const before = battler.stages[stat]
  const after = Math.max(-6, Math.min(6, before + change))
  battler.stages[stat] = after
  ctx.events.push({ type: 'stat-change', side: battler.side, name: battler.name, stat, delta: after - before, stage: after })
}

// ---------------------------------------------------------------------------
// Status infliction
// ---------------------------------------------------------------------------

function inflictAilment(ctx: ExecContext, target: Battler, ailment: string): boolean {
  const { rng, balance, events } = ctx
  switch (ailment) {
    case 'paralysis': case 'burn': case 'poison': case 'sleep': case 'freeze': {
      const status = ailment as StatusId
      if (!canReceiveStatus(target, status)) return false
      applyStatus(target, status, rng, balance)
      events.push({ type: 'status', side: target.side, name: target.name, status })
      return true
    }
    case 'unknown': // Tri Attack
      return inflictAilment(ctx, target, pickOne(rng, ['burn', 'paralysis', 'freeze']))
    case 'confusion':
      if (!canReceiveConfusion(target)) return false
      applyConfusion(target, rng, balance)
      events.push({ type: 'status', side: target.side, name: target.name, status: 'confusion' })
      return true
    case 'leech-seed':
      if (target.seeded || target.types.includes('grass') || target.fainted) return false
      target.seeded = true
      events.push({ type: 'status', side: target.side, name: target.name, status: 'leech-seed' })
      return true
    default:
      return false
  }
}

const IMPLEMENTED_AILMENTS = new Set(['paralysis', 'burn', 'poison', 'sleep', 'freeze', 'unknown', 'confusion', 'leech-seed'])

// ---------------------------------------------------------------------------
// Accuracy
// ---------------------------------------------------------------------------

function isSemiInvulnerable(target: Battler): boolean {
  return target.action?.kind === 'charging' && target.action.semiInvulnerable
}

function accuracyRoll(ctx: ExecContext, user: Battler, target: Battler, move: MoveData): boolean {
  const { rng, balance } = ctx
  if (balance.OHKO_MOVES.includes(move.name)) {
    if (user.level < target.level) return false
    return rng.next() < ((move.accuracy ?? 30) + user.level - target.level) / 100
  }
  if (move.accuracy == null) return true
  const stage = user.stages.accuracy - target.stages.evasion
  return rng.next() < (move.accuracy / 100) * accuracyStageMultiplier(stage)
}

// ---------------------------------------------------------------------------
// The entry point
// ---------------------------------------------------------------------------

/** Executes `moveName` by `user` against `target`. PP and ATB bookkeeping are the caller's job. */
export function executeMove(ctx: ExecContext, user: Battler, target: Battler, moveName: string): void {
  const { events, balance } = ctx
  const move = moveDataFor(ctx, moveName)
  user.movesUsed[move.name] = (user.movesUsed[move.name] ?? 0) + 1
  if (move.name !== 'protect' && move.name !== 'detect') user.protectedMs = 0
  events.push({ type: 'move-used', side: user.side, name: user.name, move: move.name, moveName: move.displayName, moveType: move.type })

  if (isInert(move, balance)) {
    events.push({ type: 'unsupported', side: user.side, name: user.name, moveName: move.displayName })
    return
  }
  if (isDamaging(move)) executeDamagingMove(ctx, user, target, move)
  else executeStatusMove(ctx, user, target, move)
}

function applyMoveStatChanges(ctx: ExecContext, user: Battler, target: Battler, move: MoveData): void {
  const onUser = targetsSelf(move) || ctx.balance.USER_STAT_CHANGE_MOVES.includes(move.name)
  const subject = onUser ? user : target
  if (subject.fainted && subject !== user) return
  for (const change of move.statChanges) changeStage(ctx, subject, change.stat, change.change)
}

function executeDamagingMove(ctx: ExecContext, user: Battler, target: Battler, move: MoveData): void {
  const { rng, balance, data, events } = ctx
  const isStruggle = move.name === 'struggle'

  if (target.protectedMs > 0) {
    events.push({ type: 'no-effect', side: target.side, name: target.name, reason: 'protected' })
    return
  }
  if (move.name === 'dream-eater' && target.status !== 'sleep') {
    events.push({ type: 'no-effect', side: target.side, name: target.name, reason: 'failed' })
    return
  }
  if (isSemiInvulnerable(target) || !accuracyRoll(ctx, user, target, move)) {
    events.push({ type: 'miss', side: user.side, name: user.name, moveName: move.displayName })
    return
  }
  const effectiveness = typeEffectiveness(move.type, target.types, data.typeChart)
  if (effectiveness === 0) {
    events.push({ type: 'no-effect', side: target.side, name: target.name, reason: 'immune' })
    return
  }

  const ohko = balance.OHKO_MOVES.includes(move.name)
  const fixed = balance.FIXED_DAMAGE[move.name]
  const power = effectivePower(move, balance) ?? 0
  const physical = move.damageClass === 'physical'

  let hits = 1
  if (move.minHits != null && move.maxHits != null) {
    hits = move.minHits === move.maxHits
      ? move.minHits
      : move.minHits + Math.max(0, pickWeightedIndex(rng, balance.MULTI_HIT_WEIGHTS))
  }

  const critExtra = user.trust >= balance.HIGH_TRUST_THRESHOLD ? balance.HIGH_TRUST_CRIT_BONUS : 0
  let total = 0
  let landed = 0
  for (let i = 0; i < hits && !target.fainted; i++) {
    let damage: number
    let crit = false
    if (ohko) {
      damage = target.hp
    } else if (fixed !== undefined) {
      damage = fixed === 'level' ? user.level : fixed
    } else {
      crit = rng.next() < critChance(move.critRate + user.critBonus, critExtra, balance)
      const attackStage = physical ? user.stages.attack : user.stages.spAttack
      const defenseStage = physical ? target.stages.defense : target.stages.spDefense
      const attackBase = physical ? user.stats.attack : user.stats.spAttack
      const defenseBase = physical ? target.stats.defense : target.stats.spDefense
      damage = calcDamage({
        level: user.level,
        power,
        attack: attackBase * stageMultiplier(crit ? Math.max(0, attackStage) : attackStage),
        defense: defenseBase * stageMultiplier(crit ? Math.min(0, defenseStage) : defenseStage),
        stab: user.types.includes(move.type),
        effectiveness,
        crit,
        burned: physical && user.status === 'burn',
        random: balance.DAMAGE_RANDOM_MIN + rng.next() * (1 - balance.DAMAGE_RANDOM_MIN),
        other: typeBoostFor(user, move, balance) * (user.favoriteMove === move.name ? balance.FAVORITE_POWER_MULT : 1),
      }, balance)
    }
    total += dealDamage(ctx, target, damage, { effectiveness, crit, source: isStruggle ? 'struggle' : 'move' })
    landed++
  }
  if (landed > 1) events.push({ type: 'multi-hit', side: user.side, name: user.name, hits: landed })

  // Drain / recoil.
  if (total > 0) {
    if (isStruggle) {
      dealDamage(ctx, user, Math.max(1, Math.floor(user.stats.hp * balance.STRUGGLE_RECOIL_FRACTION)), { source: 'recoil' })
    } else if (move.drain > 0) {
      healBattler(ctx, user, Math.max(1, Math.floor((total * move.drain) / 100)), 'drain')
    } else if (move.drain < 0) {
      dealDamage(ctx, user, Math.max(1, Math.floor((total * -move.drain) / 100)), { source: 'recoil' })
    }
  }

  // Secondary effects only when the move connected.
  if (total <= 0) return
  if (move.type === 'fire' && target.status === 'freeze') {
    cureStatus(target)
    events.push({ type: 'status-cured', side: target.side, name: target.name, status: 'freeze', reason: 'thaw' })
  }
  if (!target.fainted && move.ailment !== 'none' && move.ailmentChance > 0 && IMPLEMENTED_AILMENTS.has(move.ailment)) {
    if (chance(rng, move.ailmentChance / 100)) inflictAilment(ctx, target, move.ailment)
  }
  if (!target.fainted && move.flinchChance > 0 && chance(rng, move.flinchChance / 100)) {
    target.atb *= balance.FLINCH_ATB_FACTOR
    events.push({ type: 'flinch', side: target.side, name: target.name })
  }
  if (move.statChanges.length > 0 && (move.statChance === 0 || chance(rng, move.statChance / 100))) {
    applyMoveStatChanges(ctx, user, target, move)
  }
}

function executeStatusMove(ctx: ExecContext, user: Battler, target: Battler, move: MoveData): void {
  const { rng, balance, data, events } = ctx
  const self = targetsSelf(move)

  switch (move.name) {
    case 'focus-energy':
      user.critBonus = 2
      events.push({ type: 'effect', side: user.side, name: user.name, effect: 'focus-energy' })
      return
    case 'haze':
      for (const battler of [user, target]) for (const stat of Object.keys(battler.stages) as BattleStatKey[]) battler.stages[stat] = 0
      events.push({ type: 'effect', side: user.side, name: user.name, effect: 'haze' })
      return
    case 'rest':
      if (user.hp >= user.stats.hp && !user.status) {
        events.push({ type: 'no-effect', side: user.side, name: user.name, reason: 'failed' })
        return
      }
      cureStatus(user)
      healBattler(ctx, user, user.stats.hp, 'rest')
      user.status = 'sleep'
      user.statusMs = balance.SLEEP_MS_RANGE[0]
      events.push({ type: 'effect', side: user.side, name: user.name, effect: 'rest' })
      return
    case 'belly-drum':
      if (user.hp <= user.stats.hp / 2 || user.stages.attack >= 6) {
        events.push({ type: 'no-effect', side: user.side, name: user.name, reason: 'failed' })
        return
      }
      dealDamage(ctx, user, Math.floor(user.stats.hp / 2), { source: 'recoil' })
      user.stages.attack = 6
      events.push({ type: 'effect', side: user.side, name: user.name, effect: 'belly-drum' })
      return
    case 'protect': case 'detect':
      user.protectedMs = balance.PROTECT_MS
      events.push({ type: 'status', side: user.side, name: user.name, status: 'protect' })
      return
    default:
      break
  }

  if (!self) {
    if (target.protectedMs > 0) {
      events.push({ type: 'no-effect', side: target.side, name: target.name, reason: 'protected' })
      return
    }
    if (isSemiInvulnerable(target) || !accuracyRoll(ctx, user, target, move)) {
      events.push({ type: 'miss', side: user.side, name: user.name, moveName: move.displayName })
      return
    }
    if (move.type === 'electric' && typeEffectiveness(move.type, target.types, data.typeChart) === 0) {
      events.push({ type: 'no-effect', side: target.side, name: target.name, reason: 'immune' })
      return
    }
  }

  let didSomething = false
  if (IMPLEMENTED_AILMENTS.has(move.ailment) && !self) {
    didSomething = inflictAilment(ctx, target, move.ailment)
    if (!didSomething && move.statChanges.length === 0) {
      events.push({ type: 'no-effect', side: target.side, name: target.name, reason: 'unaffected' })
      return
    }
  }
  if (move.statChanges.length > 0) {
    applyMoveStatChanges(ctx, user, target, move)
    didSomething = true
  }
  if (move.healing > 0) {
    const healed = healBattler(ctx, user, Math.max(1, Math.floor((user.stats.hp * move.healing) / 100)), 'move')
    if (healed > 0) didSomething = true
  }
  if (!didSomething) events.push({ type: 'no-effect', side: user.side, name: user.name, reason: 'failed' })
}
