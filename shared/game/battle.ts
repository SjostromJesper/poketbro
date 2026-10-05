import type { StatBlock } from './races'
import { type TacticOption, tacticModifiers } from './tactics'
import type { SkillDefinition, SkillTriggerCondition } from './skills'
import { UNARMED_DAMAGE_PROFILE, type WeaponType, WEAPON_TYPE_SKILL_KEY } from './items'

export interface Combatant {
  name: string
  stats: StatBlock
  tactic: TacticOption
  /** 0-100. Give up once HP drops to or below this percent of max HP. 0 = never give up. */
  giveUpPercent: number
  /** HP to start the fight with. Defaults to max HP if omitted. */
  startingHp?: number
  skills?: SkillDefinition[]
  /** Equipped weapon's type. null/undefined = unarmed (uses the fighter's best-trained weapon skill). */
  weaponType?: WeaponType | null
  /** 0-1. Chance the equipped weapon grants a bonus swing in the same round. */
  weaponExtraAttackChance?: number
  /** The equipped weapon's own damage range. Defaults to the unarmed profile if omitted. */
  weaponMinDamage?: number
  weaponMaxDamage?: number
  /** How high the matching skill needs to be to reach weaponMaxDamage - gates effectiveness only, not durability. */
  weaponRecommendedSkill?: number
  /** The weapon's "brytvärde" - cumulative damage it can deal/take before breaking. Independent of weaponRecommendedSkill. */
  weaponBreakThreshold?: number
  /** Whether a shield is equipped at all - blocking is impossible without one. */
  hasShield?: boolean
  /** How many hits a shield can block in a single round (only relevant if hasShield). */
  shieldMaxBlocksPerRound?: number
  /** Max of the shield's absorption roll range - each block rolls between shieldMinAbsorption and this. */
  shieldAbsorption?: number
  shieldMinAbsorption?: number
  /** The skill needed to use the shield effectively - gates how close to the max you roll, not durability. */
  shieldRecommendedSkill?: number
  /** The shield's own "brytvärde" - cumulative damage it can take before breaking. Independent of shieldRecommendedSkill. */
  shieldBreakThreshold?: number
  /**
   * A second weapon in the shield-arm slot instead of a shield (dual-wielding). Mutually
   * exclusive with hasShield - the shield arm holds either a shield or an offhand weapon.
   */
  offWeaponType?: WeaponType | null
  offWeaponExtraAttackChance?: number
  offWeaponMinDamage?: number
  offWeaponMaxDamage?: number
  offWeaponRecommendedSkill?: number
  offWeaponBreakThreshold?: number
}

export type BattleLogEntryType = 'info' | 'round' | 'hit' | 'miss' | 'skill' | 'heal' | 'giveup' | 'exhaustion' | 'timeout'

export interface BattleLogEntry {
  text: string
  /** Name of the fighter this line is about (the one acting, for hit/miss/skill/heal/giveup lines). */
  actorName?: string
  type: BattleLogEntryType
  isCrit?: boolean
  isBlocked?: boolean
}

export interface BattleResult {
  winnerName: string
  loserName: string
  reason: 'ko' | 'exhaustion' | 'giveup' | 'draw'
  rounds: number
  log: BattleLogEntry[]
  aFinalHp: number
  aMaxHp: number
  bFinalHp: number
  bMaxHp: number
}

export const REASON_LABELS: Record<BattleResult['reason'], string> = {
  ko: 'knockout',
  exhaustion: 'utmattning',
  giveup: 'gav upp',
  draw: 'övertag',
}

const SAFETY_ROUND_CAP = 60
const MAX_EXTRA_ATTACK_DEPTH = 1

const BASE_FIRST_STRIKE_FLOOR = 0.55
const BASE_FIRST_STRIKE_CEILING = 0.9
const FIRST_STRIKE_DECAY = 0.12
const FIRST_STRIKE_MIN = 0.15

/**
 * Matches Lanista's real formula: HP tracks Hälsa roughly 1:1, but is capped at 5.5x
 * Strength - dumping Hälsa without any Styrka is pointless, exactly like the reference game.
 */
export function maxHealth(stats: StatBlock): number {
  const uncapped = Math.max(1, stats.health + 1)
  const strengthCap = Math.max(1, Math.round(stats.strength * 5.5))
  return Math.min(uncapped, strengthCap)
}

function maxRounds(stats: StatBlock): number {
  return 10 + Math.floor(stats.endurance / 4)
}

/**
 * Linear fit through two real battle reports for the same character/weapon: sitting
 * exactly at a weapon's skill requirement (proficiency 1.0) gave a ~45% hit rate; pushing
 * to 157% of it (proficiency 1.57) gave ~62%. No plateau has been observed yet - this is
 * a straight line through those two points, not a guessed curve.
 */
function weaponProficiencyAccuracy(skill: number, recommendedSkill: number): number {
  const proficiency = recommendedSkill > 0 ? skill / recommendedSkill : 1
  return 0.15 + proficiency * 0.3
}

function hitChance(attackerSkill: number, defenderEvasion: number, weaponRecommendedSkill: number): number {
  const base = weaponProficiencyAccuracy(attackerSkill, weaponRecommendedSkill)
  const chance = base - defenderEvasion * 0.003
  return Math.min(0.95, Math.max(0.15, chance))
}

function critChance(attackerSkill: number): number {
  return Math.min(0.35, 0.05 + attackerSkill * 0.002)
}

/**
 * A shield's own "rekommenderad skill" is a genuinely separate stat from its brytvärde:
 * a better shield demands more Sköld-skill to use well, and even more to reach its full
 * potential. No real margin is confirmed yet - guessed at 40% above the recommendation,
 * mirroring the same margin the wiki suggested for weapons reaching full accuracy.
 */
const SHIELD_CEILING_MARGIN = 1.4

function shieldSkillProficiency(shieldSkill: number, recommendedSkill: number): number {
  if (recommendedSkill <= 0) return 1
  const ceilingSkill = recommendedSkill * SHIELD_CEILING_MARGIN
  return Math.min(1, shieldSkill / ceilingSkill)
}

/**
 * Blocking is NOT guaranteed - a third real report (same skill, 40, as the one that went
 * 4/4) came back 2/4 against a different, weapon-wielding opponent, with the other 2 hits
 * landing completely unmitigated ("klarar inte att undvika och parera", no shield
 * mentioned at all). Pooled across all three reports: 11/13 successful blocks (~85%) -
 * high, but real misses happen. High baseline picked to land in that ballpark; the actual
 * shape (does skill matter much in this range? does the attacker's weapon type matter -
 * the two misses both came from a thrust weapon) is unconfirmed with this little data.
 *
 * It's a contest, not just the defender's own stats - the attacker's own weapon skill
 * makes their swing harder to intercept. No real data isolates this effect yet either;
 * the coefficient just mirrors the size of the evasion term in hitChance.
 */
function blockChance(defender: FighterState, attackerSkill: number): number {
  if (!defender.hasShield) return 0
  const base = Math.min(0.95, 0.65 + defender.stats.shieldSkill * 0.004 + defender.stats.endurance * 0.003)
  return Math.max(0.05, base - attackerSkill * 0.003)
}

/**
 * Parrying with a weapon (main-arm fallback, or an offhand weapon in a dual-wield setup)
 * instead of a shield. No real data confirms this shape at all yet - mirrors blockChance's
 * curve as a placeholder, using the parrying weapon's own skill, contested the same way
 * against the attacker's skill.
 */
function parryChance(weaponSkill: number, attackerSkill: number): number {
  const base = Math.min(0.7, 0.3 + weaponSkill * 0.006)
  return Math.max(0.05, base - attackerSkill * 0.003)
}

/**
 * How much a successful block absorbs, though - that DOES vary per hit even within the
 * same match (the same shield absorbed a full hit once and only partially three other
 * times), so this rolls a min-max range (like a weapon's damage roll) rather than a flat
 * number, with the skill-effectiveness ceiling raising how close to the max you can roll.
 */
function rollShieldAbsorptionAmount(defender: FighterState): number {
  const proficiency = shieldSkillProficiency(defender.stats.shieldSkill, defender.shieldRecommendedSkill)
  const ceiling = defender.shieldMinAbsorption + (defender.shieldAbsorption - defender.shieldMinAbsorption) * proficiency
  const rolled = defender.shieldMinAbsorption + Math.random() * (ceiling - defender.shieldMinAbsorption)
  return Math.max(0, Math.round(rolled))
}

/**
 * Damage comes from the weapon's own min-max range, not the attacker's stats directly.
 * The matching weapon skill determines how much of that range is reachable: below the
 * weapon's recommended skill, the ceiling scales down proportionally - at or above it,
 * the full max is in play. Strength then adds a flat bonus on top of the roll (matching
 * Lanista: "vapnets basvärde + ett tillägg baserat på din styrka"), diminishing once it
 * reaches the weapon's own damage potential ("effekten av styrka avtar efter att man
 * nått vapnets skadepotential") - capped at the weapon's own max damage.
 */
function rollWeaponDamage(attacker: FighterState, slot: WeaponSlot): number {
  const skill = slotWeaponSkill(attacker, slot)
  const { minDamage, maxDamage, recommendedSkill } = slotWeaponRange(attacker, slot)
  const proficiency = recommendedSkill > 0 ? Math.min(1, skill / recommendedSkill) : 1
  const ceiling = minDamage + (maxDamage - minDamage) * proficiency
  const rolled = minDamage + Math.random() * (ceiling - minDamage)
  const strengthBonus = Math.min(maxDamage, attacker.stats.strength * 0.09)
  return Math.max(1, Math.round(rolled + strengthBonus))
}

export interface FighterState {
  name: string
  stats: StatBlock
  mods: ReturnType<typeof tacticModifiers>
  hp: number
  maxHp: number
  roundsLeft: number
  giveUpAt: number
  skills: SkillDefinition[]
  skillTriggerCounts: Record<string, number>
  weaponType: WeaponType | null
  weaponExtraAttackChance: number
  weaponMinDamage: number
  weaponMaxDamage: number
  weaponRecommendedSkill: number
  hasShield: boolean
  shieldMaxBlocksPerRound: number
  shieldAbsorption: number
  shieldMinAbsorption: number
  shieldRecommendedSkill: number
  offWeaponType: WeaponType | null
  offWeaponExtraAttackChance: number
  offWeaponMinDamage: number
  offWeaponMaxDamage: number
  offWeaponRecommendedSkill: number
  /** True once the main (weapon) arm has attacked or been forced to parry this round. */
  mainArmSpent: boolean
  /** Actions used this round by the shield-arm item (shield blocks, or an offhand weapon's swings/parries). */
  offArmActionsUsed: number
  offArmMaxActionsPerRound: number
  /** False once a broken shield leaves the shield-arm with nothing at all - no fallback fists for a shield. */
  offArmExists: boolean
  /** Cumulative damage dealt/absorbed by each item this fight, versus its own brytvärde. Once used >= threshold, the item breaks for the rest of the fight. */
  mainWeaponBreakThreshold: number
  mainWeaponDurabilityUsed: number
  mainWeaponBroken: boolean
  offWeaponBreakThreshold: number
  offWeaponDurabilityUsed: number
  offWeaponBroken: boolean
  shieldBreakThreshold: number
  shieldDurabilityUsed: number
  shieldBroken: boolean
}

type WeaponSlot = 'main' | 'off'

export function makeFighterState(combatant: Combatant): FighterState {
  const maxHp = maxHealth(combatant.stats)
  const startHp = Math.min(maxHp, Math.max(0, combatant.startingHp ?? maxHp))
  const giveUpAt = Math.floor(maxHp * (Math.min(100, Math.max(0, combatant.giveUpPercent)) / 100))
  return {
    name: combatant.name,
    stats: combatant.stats,
    mods: tacticModifiers(combatant.tactic),
    hp: startHp,
    maxHp,
    roundsLeft: maxRounds(combatant.stats),
    giveUpAt,
    skills: combatant.skills ?? [],
    skillTriggerCounts: {},
    weaponType: combatant.weaponType ?? null,
    weaponExtraAttackChance: combatant.weaponExtraAttackChance ?? 0,
    weaponMinDamage: combatant.weaponMinDamage ?? UNARMED_DAMAGE_PROFILE.minDamage,
    weaponMaxDamage: combatant.weaponMaxDamage ?? UNARMED_DAMAGE_PROFILE.maxDamage,
    weaponRecommendedSkill: combatant.weaponRecommendedSkill ?? UNARMED_DAMAGE_PROFILE.recommendedSkill,
    hasShield: combatant.hasShield ?? false,
    shieldMaxBlocksPerRound: combatant.shieldMaxBlocksPerRound ?? 1,
    shieldAbsorption: combatant.shieldAbsorption ?? 0,
    shieldMinAbsorption: combatant.shieldMinAbsorption ?? 0,
    shieldRecommendedSkill: combatant.shieldRecommendedSkill ?? 0,
    offWeaponType: combatant.offWeaponType ?? null,
    offWeaponExtraAttackChance: combatant.offWeaponExtraAttackChance ?? 0,
    offWeaponMinDamage: combatant.offWeaponMinDamage ?? 0,
    offWeaponMaxDamage: combatant.offWeaponMaxDamage ?? 0,
    offWeaponRecommendedSkill: combatant.offWeaponRecommendedSkill ?? 0,
    mainArmSpent: false,
    offArmActionsUsed: 0,
    offArmMaxActionsPerRound: combatant.hasShield
      ? (combatant.shieldMaxBlocksPerRound ?? 1)
      : (combatant.offWeaponType ? 1 : 0),
    offArmExists: Boolean(combatant.hasShield || combatant.offWeaponType),
    mainWeaponBreakThreshold: combatant.weaponType ? (combatant.weaponBreakThreshold ?? Infinity) : Infinity,
    mainWeaponDurabilityUsed: 0,
    mainWeaponBroken: false,
    offWeaponBreakThreshold: combatant.offWeaponType ? (combatant.offWeaponBreakThreshold ?? Infinity) : Infinity,
    offWeaponDurabilityUsed: 0,
    offWeaponBroken: false,
    shieldBreakThreshold: combatant.hasShield ? (combatant.shieldBreakThreshold ?? Infinity) : Infinity,
    shieldDurabilityUsed: 0,
    shieldBroken: false,
  }
}

function slotWeaponSkill(fighter: FighterState, slot: WeaponSlot): number {
  if (slot === 'off' && fighter.offWeaponType && !fighter.offWeaponBroken) return fighter.stats[WEAPON_TYPE_SKILL_KEY[fighter.offWeaponType]]
  return effectiveWeaponSkill(fighter)
}

/** A broken item falls back to the unarmed profile - "you fight with just your fists" for that arm. */
function slotWeaponRange(fighter: FighterState, slot: WeaponSlot) {
  if (slot === 'off') {
    if (fighter.offWeaponBroken) return { minDamage: UNARMED_DAMAGE_PROFILE.minDamage, maxDamage: UNARMED_DAMAGE_PROFILE.maxDamage, recommendedSkill: UNARMED_DAMAGE_PROFILE.recommendedSkill }
    return { minDamage: fighter.offWeaponMinDamage, maxDamage: fighter.offWeaponMaxDamage, recommendedSkill: fighter.offWeaponRecommendedSkill }
  }
  if (fighter.mainWeaponBroken) return { minDamage: UNARMED_DAMAGE_PROFILE.minDamage, maxDamage: UNARMED_DAMAGE_PROFILE.maxDamage, recommendedSkill: UNARMED_DAMAGE_PROFILE.recommendedSkill }
  return { minDamage: fighter.weaponMinDamage, maxDamage: fighter.weaponMaxDamage, recommendedSkill: fighter.weaponRecommendedSkill }
}

function slotExtraAttackChance(fighter: FighterState, slot: WeaponSlot): number {
  if (slot === 'off') return fighter.offWeaponBroken ? 0 : fighter.offWeaponExtraAttackChance
  return fighter.mainWeaponBroken ? 0 : fighter.weaponExtraAttackChance
}

/** Unarmed/unresolved/broken weapon falls back to whichever weapon skill the fighter trained highest. */
function effectiveWeaponSkill(fighter: FighterState): number {
  if (fighter.weaponType && !fighter.mainWeaponBroken) return fighter.stats[WEAPON_TYPE_SKILL_KEY[fighter.weaponType]]
  return Math.max(
    fighter.stats.swordSkill,
    fighter.stats.axeSkill,
    fighter.stats.thrustSkill,
    fighter.stats.hammerSkill,
    fighter.stats.chainSkill,
  )
}

function tryTriggerSkill(fighter: FighterState, condition: SkillTriggerCondition): SkillDefinition | null {
  for (const skill of fighter.skills) {
    if (skill.triggerCondition !== condition) continue
    const count = fighter.skillTriggerCounts[skill.id] ?? 0
    if (skill.maxTriggers !== null && count >= skill.maxTriggers) continue
    if (Math.random() < skill.triggerChance) {
      fighter.skillTriggerCounts[skill.id] = count + 1
      return skill
    }
  }
  return null
}

/** Applies a triggered skill's effect. Returns flat bonus damage to fold into the current attack (0 for non-damage effects). */
function applySkillEffect(skill: SkillDefinition, owner: FighterState, opponent: FighterState, log: BattleLogEntry[], extraAttackDepth: number): number {
  if (skill.effect === 'bonus_damage') {
    log.push({ text: `${owner.name} utlöser ${skill.name}!`, actorName: owner.name, type: 'skill' })
    return skill.effectValue
  }
  if (skill.effect === 'heal_self') {
    const amount = Math.max(1, Math.round(owner.maxHp * skill.effectValue))
    owner.hp = Math.min(owner.maxHp, owner.hp + amount)
    log.push({
      text: `${owner.name} utlöser ${skill.name} och läker ${amount} liv (${owner.hp}/${owner.maxHp}).`,
      actorName: owner.name,
      type: 'heal',
    })
    return 0
  }
  if (skill.effect === 'extra_attack' && extraAttackDepth < MAX_EXTRA_ATTACK_DEPTH) {
    log.push({ text: `${owner.name} utlöser ${skill.name} och anfaller igen!`, actorName: owner.name, type: 'skill' })
    performSwing(owner, opponent, log, extraAttackDepth + 1, 'main')
  }
  return 0
}

type DefenseKind = 'shield' | 'off-parry' | 'main-parry' | 'none'

/**
 * Priority matches how a real fighter defends: try the shield-arm first (a shield block,
 * or - dual-wielding - a parry with the offhand weapon, using up that arm's own action).
 * Only if the shield-arm has nothing left does the main weapon-arm step in to parry,
 * which spends its one action for the round and costs it that round's attack entirely.
 */
function resolveDefense(defender: FighterState): DefenseKind {
  const offHandAvailable = defender.offArmExists && defender.offArmActionsUsed < defender.offArmMaxActionsPerRound
  if (offHandAvailable) {
    defender.offArmActionsUsed += 1
    return defender.hasShield ? 'shield' : 'off-parry'
  }
  if (!defender.mainArmSpent) {
    defender.mainArmSpent = true
    return 'main-parry'
  }
  return 'none'
}

/**
 * Every weapon and shield has a "brytvärde": once it has absorbed that much cumulative
 * damage from blocking/parrying in a single fight, it breaks and that arm falls back to
 * bare fists (or, for a shield, no defense at all) for the rest of the fight. Only
 * defensive use wears gear - swinging a weapon to attack doesn't damage it, only using
 * it (or a shield) to stop a blow does. The exact wear-per-block formula (full damage
 * absorbed) is our own guess, unvalidated against real data like the block/parry chance
 * formulas above.
 *
 * State changes apply immediately (so the rest of this same swing sees the new broken
 * status), but returns whether it just broke rather than logging directly - the caller
 * pushes that log line after the swing's own hit/miss line, so the story reads as
 * "hit for N damage - and that blow shattered the shield", not the other way around.
 */
function applyWear(fighter: FighterState, item: 'main' | 'off' | 'shield', amount: number): boolean {
  if (amount <= 0) return false
  if (item === 'main') {
    if (fighter.mainWeaponBroken) return false
    fighter.mainWeaponDurabilityUsed += amount
    if (fighter.mainWeaponDurabilityUsed >= fighter.mainWeaponBreakThreshold) {
      fighter.mainWeaponBroken = true
      return true
    }
  } else if (item === 'off') {
    if (fighter.offWeaponBroken) return false
    fighter.offWeaponDurabilityUsed += amount
    if (fighter.offWeaponDurabilityUsed >= fighter.offWeaponBreakThreshold) {
      fighter.offWeaponBroken = true
      return true
    }
  } else {
    if (fighter.shieldBroken) return false
    fighter.shieldDurabilityUsed += amount
    if (fighter.shieldDurabilityUsed >= fighter.shieldBreakThreshold) {
      fighter.shieldBroken = true
      fighter.offArmExists = false
      return true
    }
  }
  return false
}

function breakMessage(fighter: FighterState, item: 'main' | 'off' | 'shield'): BattleLogEntry {
  if (item === 'main') return { text: `${fighter.name}s vapen går sönder! ${fighter.name} slåss nu med bara nävarna.`, actorName: fighter.name, type: 'info' }
  if (item === 'off') return { text: `${fighter.name}s andra vapen går sönder! Den handen slåss nu med bara näven.`, actorName: fighter.name, type: 'info' }
  return { text: `${fighter.name}s sköld går i bitar och kan inte längre användas!`, actorName: fighter.name, type: 'info' }
}

function performSwing(attacker: FighterState, defender: FighterState, log: BattleLogEntry[], extraAttackDepth: number, slot: WeaponSlot): void {
  let pendingBonus = 0
  const alwaysSkill = tryTriggerSkill(attacker, 'always')
  if (alwaysSkill) pendingBonus += applySkillEffect(alwaysSkill, attacker, defender, log, extraAttackDepth)

  const atkSkill = slotWeaponSkill(attacker, slot) * attacker.mods.accuracyMult
  const { recommendedSkill } = slotWeaponRange(attacker, slot)
  const evasion = defender.stats.evasion * defender.mods.evasionMult
  const didHit = Math.random() < hitChance(atkSkill, evasion, recommendedSkill)

  if (!didHit) {
    log.push({ text: `${attacker.name} attackerar ${defender.name} men missar.`, actorName: attacker.name, type: 'miss' })
    const evadeSkill = tryTriggerSkill(defender, 'on_evade')
    if (evadeSkill) applySkillEffect(evadeSkill, defender, attacker, log, extraAttackDepth)
  } else {
    let damage = Math.max(1, Math.round(rollWeaponDamage(attacker, slot) * attacker.mods.damageMult))

    const isCrit = Math.random() < critChance(atkSkill)
    if (isCrit) damage = Math.round(damage * 1.6)

    // Defense CAN fail - see blockChance's comment for the real report that disproved
    // "always succeeds". A shield rolls its absorption from a min-max range when it does
    // succeed (see rollShieldAbsorptionAmount); a weapon parry (main-arm fallback, or an
    // offhand weapon) still uses a flat amount based on the parrying weapon's own min
    // damage - no real data yet to build a range for that case, unlike the shield's.
    // Wear only applies on a SUCCESSFUL defense - a failed attempt never actually made
    // contact, so it shouldn't cost durability. This is also what makes "deliberately
    // train your offhand weapon low so it parries less and lasts longer" a real tradeoff
    // rather than a no-op, matching the strategy described for dual-wielders.
    const defenseKind = resolveDefense(defender)
    const rawIncoming = damage
    let isBlocked = false
    let defenderBrokenItem: 'main' | 'off' | 'shield' | null = null
    if (defenseKind === 'shield') {
      isBlocked = Math.random() < blockChance(defender, atkSkill)
      if (isBlocked) {
        const absorbed = rollShieldAbsorptionAmount(defender)
        damage = Math.max(0, damage - absorbed)
        if (applyWear(defender, 'shield', rawIncoming)) defenderBrokenItem = 'shield'
      }
    } else if (defenseKind === 'off-parry' || defenseKind === 'main-parry') {
      const parrySkill = defenseKind === 'off-parry' ? slotWeaponSkill(defender, 'off') : effectiveWeaponSkill(defender)
      isBlocked = Math.random() < parryChance(parrySkill, atkSkill)
      const parryingArm = defenseKind === 'off-parry' ? 'off' : 'main'
      if (isBlocked) {
        const parryAbsorption = defenseKind === 'off-parry' ? defender.offWeaponMinDamage : defender.weaponMinDamage
        damage = Math.max(0, damage - parryAbsorption)
        if (applyWear(defender, parryingArm, rawIncoming)) defenderBrokenItem = parryingArm
      }
    }

    damage = Math.max(0, Math.round(damage * defender.mods.damageTakenMult)) + pendingBonus

    const onHitSkill = tryTriggerSkill(attacker, 'on_hit')
    if (onHitSkill) damage += applySkillEffect(onHitSkill, attacker, defender, log, extraAttackDepth)

    if (isCrit) {
      const critSkill = tryTriggerSkill(attacker, 'on_critical')
      if (critSkill) damage += applySkillEffect(critSkill, attacker, defender, log, extraAttackDepth)
    }

    damage = Math.max(isBlocked ? 0 : 1, damage)
    defender.hp = Math.max(0, defender.hp - damage)
    const defenseVerb = defenseKind === 'shield' ? 'blockerar' : 'parerar'
    const defenseTag = defenseKind === 'shield' ? 'blockerad' : 'parerad'

    if (isBlocked && damage === 0) {
      log.push({
        text: `${defender.name} ${defenseVerb} ${attacker.name}s attack fullständigt. Ingen skada tränger igenom.`,
        actorName: attacker.name,
        type: 'hit',
        isCrit,
        isBlocked,
      })
    } else {
      const tags = [isCrit ? 'kritisk träff' : null, isBlocked ? defenseTag : null].filter(Boolean).join(', ')
      log.push({
        text: `${attacker.name} träffar ${defender.name} för ${damage} skada${tags ? ` (${tags})` : ''} (${defender.hp}/${defender.maxHp} kvar).`,
        actorName: attacker.name,
        type: 'hit',
        isCrit,
        isBlocked,
      })
    }

    // Break notices land after the hit line - the story is "hit for N damage, and that
    // blow finished off the shield/weapon", not the other way around.
    if (defenderBrokenItem) log.push(breakMessage(defender, defenderBrokenItem))

    if (isBlocked) {
      const blockSkill = tryTriggerSkill(defender, 'on_block')
      if (blockSkill) applySkillEffect(blockSkill, defender, attacker, log, extraAttackDepth)
    }

    if (defenseKind === 'main-parry' && defender.hp > 0) {
      log.push({
        text: `${defender.name}s vapenarm är upptagen efter pareringen och hinner inte anfalla denna runda.`,
        actorName: defender.name,
        type: 'info',
      })
    }
  }

  if (
    defender.hp > 0
    && extraAttackDepth < MAX_EXTRA_ATTACK_DEPTH
    && slotExtraAttackChance(attacker, slot) > 0
    && Math.random() < slotExtraAttackChance(attacker, slot)
  ) {
    log.push({ text: `${attacker.name}s vapen ger en extra attack!`, actorName: attacker.name, type: 'skill' })
    performSwing(attacker, defender, log, extraAttackDepth + 1, slot)
  }
}

/**
 * A fighter's "turn" this round: swing with the main-hand weapon if it hasn't already
 * been spent (attacking earlier this round, or forced into a parry while defending
 * earlier this round), then also swing the offhand weapon if dual-wielding and it still
 * has an action left. If the opponent's earlier attack this round missed entirely, no
 * arm was ever spent on defense - so a dual-wielder gets both weapons back.
 */
export function performAttack(attacker: FighterState, defender: FighterState, log: BattleLogEntry[], extraAttackDepth = 0): void {
  if (!attacker.mainArmSpent) {
    attacker.mainArmSpent = true
    performSwing(attacker, defender, log, extraAttackDepth, 'main')
  }
  if (defender.hp <= 0) return
  if (attacker.offWeaponType !== null && attacker.offArmActionsUsed < attacker.offArmMaxActionsPerRound) {
    attacker.offArmActionsUsed += 1
    performSwing(attacker, defender, log, extraAttackDepth, 'off')
  }
}

export function checkGiveUp(fighter: FighterState, log: BattleLogEntry[]): boolean {
  if (fighter.giveUpAt > 0 && fighter.hp > 0 && fighter.hp <= fighter.giveUpAt) {
    log.push({
      text: `${fighter.name} ger upp (nådde ${fighter.hp}/${fighter.maxHp}, under gränsen ${fighter.giveUpAt}).`,
      actorName: fighter.name,
      type: 'giveup',
    })
    return true
  }
  return false
}

export function simulateBattle(a: Combatant, b: Combatant): BattleResult {
  const fighterA = makeFighterState(a)
  const fighterB = makeFighterState(b)
  const log: BattleLogEntry[] = [
    {
      text: `${fighterA.name} (HP ${fighterA.hp}/${fighterA.maxHp}) möter ${fighterB.name} (HP ${fighterB.hp}/${fighterB.maxHp}).`,
      type: 'info',
    },
  ]

  function finish(winner: FighterState, loser: FighterState, reason: BattleResult['reason'], round: number): BattleResult {
    return {
      winnerName: winner.name,
      loserName: loser.name,
      reason,
      rounds: round,
      log,
      aFinalHp: fighterA.hp,
      aMaxHp: fighterA.maxHp,
      bFinalHp: fighterB.hp,
      bMaxHp: fighterB.maxHp,
    }
  }

  if (fighterA.hp <= 0 || fighterB.hp <= 0) {
    const winner = fighterA.hp > 0 ? fighterA : fighterB
    const loser = winner === fighterA ? fighterB : fighterA
    log.push({ text: `${loser.name} är redan medvetslös och förlorar utan strid.`, actorName: loser.name, type: 'info' })
    return finish(winner, loser, 'ko', 0)
  }

  // Initiative decides who is FAVORED to strike first each round. Every round the favored
  // fighter wins that roll, their odds decay a bit; once the underdog breaks through and
  // strikes first, the odds reset back to the initiative-based baseline.
  const aInit = fighterA.stats.initiative * fighterA.mods.initiativeMult
  const bInit = fighterB.stats.initiative * fighterB.mods.initiativeMult
  const favored = aInit >= bInit ? fighterA : fighterB
  const underdog = favored === fighterA ? fighterB : fighterA
  const initiativeGap = Math.abs(aInit - bInit)
  const baseFirstStrikeChance = Math.min(BASE_FIRST_STRIKE_CEILING, Math.max(BASE_FIRST_STRIKE_FLOOR, 0.6 + initiativeGap * 0.004))
  let firstStrikeChance = baseFirstStrikeChance

  let round = 0
  while (round < SAFETY_ROUND_CAP) {
    round += 1
    fighterA.mainArmSpent = false
    fighterA.offArmActionsUsed = 0
    fighterB.mainArmSpent = false
    fighterB.offArmActionsUsed = 0

    const favoredGoesFirst = Math.random() < firstStrikeChance
    const first = favoredGoesFirst ? favored : underdog
    const second = first === fighterA ? fighterB : fighterA

    firstStrikeChance = favoredGoesFirst
      ? Math.max(FIRST_STRIKE_MIN, firstStrikeChance - FIRST_STRIKE_DECAY)
      : baseFirstStrikeChance

    log.push({ text: `-- Runda ${round} --`, type: 'round' })

    performAttack(first, second, log)
    if (second.hp <= 0) {
      return finish(first, second, 'ko', round)
    }
    if (checkGiveUp(second, log)) {
      return finish(first, second, 'giveup', round)
    }

    performAttack(second, first, log)
    if (first.hp <= 0) {
      return finish(second, first, 'ko', round)
    }
    if (checkGiveUp(first, log)) {
      return finish(second, first, 'giveup', round)
    }

    fighterA.roundsLeft -= 1
    fighterB.roundsLeft -= 1

    if (fighterA.roundsLeft <= 0 && fighterB.roundsLeft <= 0) {
      const winner = fighterA.hp >= fighterB.hp ? fighterA : fighterB
      const loser = winner === fighterA ? fighterB : fighterA
      log.push({ text: `Båda gladiatorerna är utmattade. ${winner.name} står kvar på fötterna.`, type: 'exhaustion' })
      return finish(winner, loser, 'exhaustion', round)
    }
    if (fighterA.roundsLeft <= 0) {
      log.push({ text: `${fighterA.name} är helt utmattad och ger upp.`, actorName: fighterA.name, type: 'exhaustion' })
      return finish(fighterB, fighterA, 'exhaustion', round)
    }
    if (fighterB.roundsLeft <= 0) {
      log.push({ text: `${fighterB.name} är helt utmattad och ger upp.`, actorName: fighterB.name, type: 'exhaustion' })
      return finish(fighterA, fighterB, 'exhaustion', round)
    }
  }

  const winner = fighterA.hp >= fighterB.hp ? fighterA : fighterB
  const loser = winner === fighterA ? fighterB : fighterA
  log.push({ text: `Striden drar ut på tiden. ${winner.name} vinner på övertag.`, type: 'timeout' })
  return finish(winner, loser, 'draw', round)
}
