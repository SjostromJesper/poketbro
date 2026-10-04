// Pure formulas: stats, damage, type effectiveness, XP, capture.
import { STAT_KEYS, type GameData, type GrowthRates, type NatureData, type SpeciesData, type StatBlock, type StatKey, type TypeChart, type TypeName } from '../data/types'
import type { Balance, TraitId } from './balance'
import { pickOne, randInt, type Rng } from './rng'

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export function natureMultiplier(nature: NatureData | undefined, stat: StatKey): number {
  if (!nature || stat === 'hp') return 1
  if (nature.increased === stat && nature.decreased !== stat) return 1.1
  if (nature.decreased === stat && nature.increased !== stat) return 0.9
  return 1
}

/** Standard Gen 3+ stat formula (no EVs in the MVP). */
export function calcStat(base: number, iv: number, level: number, stat: StatKey, nature: NatureData | undefined): number {
  const core = Math.floor(((2 * base + iv) * level) / 100)
  if (stat === 'hp') return core + level + 10
  return Math.floor((core + 5) * natureMultiplier(nature, stat))
}

export function calcStats(species: SpeciesData, ivs: StatBlock, level: number, nature: NatureData | undefined): StatBlock {
  const result = {} as StatBlock
  for (const stat of STAT_KEYS) result[stat] = calcStat(species.baseStats[stat], ivs[stat], level, stat, nature)
  return result
}

/** Stat stage multiplier for attack/defense/spAttack/spDefense/speed: +1 = x1.5, -1 = x0.67, ... */
export function stageMultiplier(stage: number): number {
  const s = Math.max(-6, Math.min(6, stage))
  return s >= 0 ? (2 + s) / 2 : 2 / (2 - s)
}

/** Accuracy/evasion stage multiplier (3+s)/3. */
export function accuracyStageMultiplier(stage: number): number {
  const s = Math.max(-6, Math.min(6, stage))
  return s >= 0 ? (3 + s) / 3 : 3 / (3 - s)
}

// ---------------------------------------------------------------------------
// Type effectiveness and damage
// ---------------------------------------------------------------------------

export function typeEffectiveness(moveType: TypeName, defenderTypes: readonly TypeName[], chart: TypeChart): number {
  let multiplier = 1
  const row = chart[moveType]
  for (const type of defenderTypes) multiplier *= row?.[type] ?? 1
  return multiplier
}

export interface DamageParams {
  level: number
  power: number
  attack: number
  defense: number
  stab: boolean
  effectiveness: number
  crit: boolean
  /** Physical attacker is burned. */
  burned: boolean
  /** Random factor in [DAMAGE_RANDOM_MIN, 1]. */
  random: number
  /** Everything else (held item boosts, ...). */
  other: number
}

export function calcDamage(p: DamageParams, balance: Balance): number {
  if (p.effectiveness === 0) return 0
  const defense = Math.max(1, p.defense)
  const levelFactor = Math.floor((2 * p.level) / 5 + 2)
  let damage = Math.floor(Math.floor((levelFactor * p.power * p.attack) / defense) / 50) + 2
  if (p.crit) damage *= balance.CRIT_MULT
  damage *= p.random
  if (p.stab) damage *= balance.STAB
  damage *= p.effectiveness
  if (p.burned) damage *= balance.BURN_PHYSICAL_MULT
  damage *= p.other
  return Math.max(1, Math.floor(damage))
}

export function critChance(stage: number, extra: number, balance: Balance): number {
  const table = balance.CRIT_CHANCE_BY_STAGE
  const base = table[Math.max(0, Math.min(table.length - 1, stage))]
  return Math.min(1, base + extra)
}

// ---------------------------------------------------------------------------
// Experience
// ---------------------------------------------------------------------------

/** Total XP needed to *be* level `level`. */
export function xpForLevel(growthRates: GrowthRates, rate: string, level: number): number {
  const table = growthRates[rate]
  const clamped = Math.max(1, Math.min(100, level))
  return table?.[clamped] ?? 0
}

export function levelForXp(growthRates: GrowthRates, rate: string, xp: number, maxLevel: number): number {
  let level = 1
  while (level < maxLevel && xp >= xpForLevel(growthRates, rate, level + 1)) level++
  return level
}

/** Gen 3 style: floor(a * b * L / (7 * s)), a = 1.5 against trainers. */
export function xpYield(baseExp: number, defeatedLevel: number, isTrainer: boolean, participants: number, balance: Balance): number {
  const a = isTrainer ? balance.TRAINER_XP_MULT : 1
  return Math.max(1, Math.floor((a * baseExp * defeatedLevel * balance.XP_MULTIPLIER) / (7 * Math.max(1, participants))))
}

// ---------------------------------------------------------------------------
// Capture (Gen 3/4 style with shake checks)
// ---------------------------------------------------------------------------

export interface CaptureParams {
  maxHp: number
  hp: number
  /** Species capture rate (3-255). */
  captureRate: number
  ballBonus: number
  status: string | null
  level: number
}

/** The catch value `a`; 255 or more is an automatic catch. */
export function captureValue(p: CaptureParams, balance: Balance): number {
  const base = ((3 * p.maxHp - 2 * p.hp) * p.captureRate * p.ballBonus) / (3 * p.maxHp)
  const statusBonus = (p.status && balance.STATUS_CAPTURE_BONUS[p.status]) || 1
  const levelBonus = Math.min(balance.CAPTURE_LEVEL_BONUS_MAX, Math.max(1, (balance.CAPTURE_LEVEL_REF - p.level) / 10))
  return base * statusBonus * levelBonus
}

/** Per-check threshold: a random 0-65535 below `b` passes the check. */
export function captureShakeThreshold(a: number): number {
  return 1048560 / Math.sqrt(Math.sqrt(16711680 / Math.max(1, a)))
}

/** The theoretical probability of catching: all four checks pass, (b / 65536)^4. */
export function captureChance(p: CaptureParams, balance: Balance): number {
  const a = captureValue(p, balance)
  if (a >= 255) return 1
  return Math.pow(Math.min(1, captureShakeThreshold(a) / 65536), 4)
}

export interface CaptureResult {
  caught: boolean
  /** Shakes shown before the result (0-3); 3 when caught. */
  shakes: 0 | 1 | 2 | 3
  /** Theoretical catch probability (for the debug overlay). */
  chance: number
}

export function rollCapture(rng: Rng, p: CaptureParams, balance: Balance): CaptureResult {
  const a = captureValue(p, balance)
  const chance = captureChance(p, balance)
  if (a >= 255) return { caught: true, shakes: 3, chance }
  const b = captureShakeThreshold(a)
  let passed = 0
  for (let i = 0; i < 4; i++) {
    if (randInt(rng, 0, 65535) < b) passed++
    else return { caught: false, shakes: Math.min(3, passed) as 0 | 1 | 2 | 3, chance }
  }
  return { caught: true, shakes: 3, chance }
}

/** Gen 3 flee formula: F = floor(A * 128 / B) + 30 * attempts; success if F > 255 or a 0-255 roll is below F. */
export function fleeSucceeds(rng: Rng, playerSpeed: number, enemySpeed: number, attempts: number): boolean {
  const f = Math.floor((playerSpeed * 128) / Math.max(1, enemySpeed)) + 30 * attempts
  if (f > 255) return true
  return randInt(rng, 0, 255) < f
}

// ---------------------------------------------------------------------------
// Random generation helpers
// ---------------------------------------------------------------------------

export function randomIvs(rng: Rng, max: number): StatBlock {
  const ivs = {} as StatBlock
  for (const stat of STAT_KEYS) ivs[stat] = randInt(rng, 0, max)
  return ivs
}

export function randomNatureName(rng: Rng, data: GameData): string {
  return pickOne(rng, Object.keys(data.natures))
}

export function randomTrait(rng: Rng, balance: Balance): TraitId {
  return pickOne(rng, Object.keys(balance.TRAITS) as TraitId[])
}
