import { type BattleLogEntry, type Combatant, type FighterState, checkGiveUp, makeFighterState, performAttack } from './battle'

export interface FighterOutcome {
  name: string
  finalHp: number
  maxHp: number
  /** Gave up and was removed from the fight, but survived (as opposed to being knocked out). */
  fled: boolean
}

export interface GroupBattleResult {
  log: BattleLogEntry[]
  winningSide: 'a' | 'b' | 'draw'
  rounds: number
  aOutcomes: FighterOutcome[]
  bOutcomes: FighterOutcome[]
}

const SAFETY_ROUND_CAP = 40

interface Slot {
  fighter: FighterState
  /** Gave up earlier this fight - out of the target pool and can't act again, but not KO'd. */
  retired: boolean
}

function isDown(slot: Slot): boolean {
  return slot.retired || slot.fighter.hp <= 0
}

function isSideDefeated(side: Slot[]): boolean {
  return side.every(isDown)
}

function pickTarget(side: Slot[]): FighterState | null {
  const living = side.filter(s => !isDown(s))
  if (living.length === 0) return null
  return living[Math.floor(Math.random() * living.length)].fighter
}

function outcomes(side: Slot[]): FighterOutcome[] {
  return side.map(s => ({ name: s.fighter.name, finalHp: s.fighter.hp, maxHp: s.fighter.maxHp, fled: s.retired && s.fighter.hp > 0 }))
}

/**
 * N-vs-M group combat, for party adventures - simulateBattle in battle.ts stays
 * untouched and keeps driving all 1v1 duels (gladiatorskolan/arenan/duels). This
 * reuses simulateBattle's per-individual mechanics as-is (makeFighterState,
 * performAttack already takes arbitrary attacker/defender FighterState objects,
 * checkGiveUp) - only the outer turn order, target selection, and per-side win
 * conditions are new.
 *
 * Turn order is recomputed every round: every still-able fighter on both sides,
 * sorted by initiative (random tie-break), each taking their full turn (including
 * dual-wield off-hand swings, exactly like solo battles) against a RANDOMLY chosen
 * living enemy - no tactical targeting (tank/aggro/lowest-HP) for v1. Giving up
 * only retires that one individual (removed from the target pool, can't act
 * again) rather than ending the whole fight - a side loses once everyone on it is
 * either knocked out or has fled.
 */
export function simulateGroupBattle(sideACombatants: Combatant[], sideBCombatants: Combatant[]): GroupBattleResult {
  const sideA: Slot[] = sideACombatants.map(c => ({ fighter: makeFighterState(c), retired: false }))
  const sideB: Slot[] = sideBCombatants.map(c => ({ fighter: makeFighterState(c), retired: false }))

  const log: BattleLogEntry[] = [
    {
      text: `${sideA.map(s => s.fighter.name).join(', ')} möter ${sideB.map(s => s.fighter.name).join(', ')}.`,
      type: 'info',
    },
  ]

  function finish(winningSide: 'a' | 'b' | 'draw', round: number): GroupBattleResult {
    return { log, winningSide, rounds: round, aOutcomes: outcomes(sideA), bOutcomes: outcomes(sideB) }
  }

  if (isSideDefeated(sideA) || isSideDefeated(sideB)) {
    return finish(isSideDefeated(sideA) ? 'b' : 'a', 0)
  }

  let round = 0
  while (round < SAFETY_ROUND_CAP) {
    round += 1
    for (const slot of [...sideA, ...sideB]) {
      if (isDown(slot)) continue
      slot.fighter.mainArmSpent = false
      slot.fighter.offArmActionsUsed = 0
    }

    log.push({ text: `-- Runda ${round} --`, type: 'round' })

    const turnOrder = [
      ...sideA.filter(s => !isDown(s)).map(slot => ({ slot, opposing: sideB })),
      ...sideB.filter(s => !isDown(s)).map(slot => ({ slot, opposing: sideA })),
    ].sort((x, y) => {
      const ix = x.slot.fighter.stats.initiative * x.slot.fighter.mods.initiativeMult
      const iy = y.slot.fighter.stats.initiative * y.slot.fighter.mods.initiativeMult
      return iy - ix || Math.random() - 0.5
    })

    for (const { slot, opposing } of turnOrder) {
      if (isDown(slot)) continue // may have been knocked out earlier this same round

      const target = pickTarget(opposing)
      if (!target) break // opposing side already wiped out mid-round

      performAttack(slot.fighter, target, log)

      const targetSlot = [...sideA, ...sideB].find(s => s.fighter === target)
      if (targetSlot && !isDown(targetSlot) && checkGiveUp(targetSlot.fighter, log)) {
        targetSlot.retired = true
      }

      if (isSideDefeated(sideA)) return finish('b', round)
      if (isSideDefeated(sideB)) return finish('a', round)
    }

    for (const slot of [...sideA, ...sideB]) {
      if (isDown(slot)) continue
      slot.fighter.roundsLeft -= 1
    }

    const aExhausted = sideA.every(s => isDown(s) || s.fighter.roundsLeft <= 0)
    const bExhausted = sideB.every(s => isDown(s) || s.fighter.roundsLeft <= 0)
    if (aExhausted && bExhausted) {
      log.push({ text: 'Båda sidor är helt utmattade.', type: 'exhaustion' })
      return finish('draw', round)
    }
    if (aExhausted) {
      log.push({ text: `${sideA.map(s => s.fighter.name).join(', ')} är helt utmattade och ger upp.`, type: 'exhaustion' })
      return finish('b', round)
    }
    if (bExhausted) {
      log.push({ text: `${sideB.map(s => s.fighter.name).join(', ')} är helt utmattade och ger upp.`, type: 'exhaustion' })
      return finish('a', round)
    }
  }

  const aHp = sideA.reduce((sum, s) => sum + s.fighter.hp, 0)
  const bHp = sideB.reduce((sum, s) => sum + s.fighter.hp, 0)
  log.push({ text: 'Striden drar ut på tiden.', type: 'timeout' })
  return finish(aHp >= bHp ? 'a' : 'b', round)
}
