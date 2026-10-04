// Every balance number for Nudge lives here, never hard-coded elsewhere. Tests and the simulator can pass a modified copy.
import type { TypeName } from '../data/types'

export type TraitId = 'loyal' | 'stubborn' | 'shy' | 'hasty' | 'calm' | 'playful' | 'proud'
export type MoveCategory = 'attack' | 'defense' | 'support'

export interface TraitDef {
  /** Swedish label and description shown in the summary screen. */
  label: string
  description: string
  /** Added to the base nudge budget. Ignored when `nudgeBudgetFixed` is set. */
  nudgeBudgetDelta: number
  nudgeBudgetFixed: number | null
  /** Stubborn: nudges on moves that deal no damage are accepted (and cost budget) but ignored. */
  ignoresNonDamagingNudges: boolean
  /** Multiplier on the trust gained when a nudge succeeds in winning the battle. */
  nudgeTrustBonusMult: number
  /** Multiplier on ATB fill speed. */
  atbMult: number
  /** Multiplier on how smart the move selection is (see `smart` in choice.ts). */
  smartMult: number
  /** 0..1: how much the weight distribution is flattened towards uniform. */
  flatten: number
  /** Prefers the highest-power move instead of the best expected damage. */
  prefersPower: boolean
  /** Exponent applied to type effectiveness when estimating damage (>1 = type matchups matter more). */
  typeWeightExponent: number
  /** Below this HP fraction the defense/support categories get `lowHpDefenseMult`. 0 = disabled. */
  lowHpThreshold: number
  lowHpDefenseMult: number
  /** Favorite move (PLAN-2 1B): multipliers on the global FAVORITE_* constants. */
  favoriteThresholdMult: number
  favoriteWeightMult: number
  /** Multiplies NUDGE_AWAY_FROM_FAVORITE_MULT (< 1 = nudging away from the favorite is even harder). */
  favoriteAwayMult: number
  /** Multiplies the margin another move needs to take over as favorite (> 1 = harder to switch). */
  favoriteSwitchMult: number
  /** How many progress points a move chosen because of a followed nudge is worth. */
  nudgedProgress: number
}

export interface Balance {
  // ---- ATB timer (5.2) ----
  ATB_MAX: number
  ATB_SPEED_OFFSET: number
  /** fill per second = ATB_K * (effectiveSpeed + ATB_SPEED_OFFSET). 400 / (80 + 100) => speed 80 acts every 2.5 s on 1x. */
  ATB_K: number
  /** Both bars pause while an action animation plays. */
  ACTION_LOCK_MS: number
  /** Shorter pause for a skipped turn (full paralysis, loafing). */
  SKIPPED_TURN_LOCK_MS: number
  /** Pause when a two-turn move starts charging. */
  CHARGE_ANNOUNCE_LOCK_MS: number
  /** Fixed simulation step; tick(dt) consumes whole steps so results do not depend on the frame rate. */
  STEP_MS: number
  PRIORITY_HEADSTART: number
  /** Priority is clamped to +-this many steps. */
  PRIORITY_CLAMP: number
  /** Fill-rate multiplier for the bar after a recharge move (Hyper Beam). */
  RECOVERY_MULTIPLIER: number
  POWER_TEMPO_SCALING: boolean
  /** With POWER_TEMPO_SCALING: next bar fills at 1 / (1 + factor * max(0, power - 60)). */
  POWER_TEMPO_FACTOR: number
  CHARGE_MOVES: Record<string, { chargeMs: number, semiInvulnerable: boolean }>
  RECHARGE_MOVES: string[]

  // ---- Choosing moves (5.3) ----
  /** Category weights by what the nature favours (increased stat). */
  CATEGORY_WEIGHTS: { attack: Record<MoveCategory, number>, defense: Record<MoveCategory, number>, support: Record<MoveCategory, number>, neutral: Record<MoveCategory, number> }
  DECREASED_CATEGORY_MULT: number
  SMART_MIN: number
  SMART_MAX: number
  INERT_MOVE_FACTOR: number
  USELESS_STATUS_FACTOR: number
  IMMUNE_FACTOR: number
  HEAL_FULL_HP_FACTOR: number
  HEAL_LOW_HP_BOOST: number
  MAXED_STAT_FACTOR: number
  /** Habits (5.5) */
  HABIT_WEIGHT: number
  HABIT_BONUS_CAP: number
  HABIT_GAIN_CAP_PER_BATTLE: number

  // ---- Nudge (5.4) ----
  NUDGE_BUDGET_BASE: number
  NUDGE_CURVE: number[]
  NUDGE_TRUST_MIN_MULT: number
  NUDGE_TRUST_MAX_MULT: number
  NUDGE_MAX_STRENGTH: number
  NUDGE_ALLOWED_WHILE_PAUSED: boolean
  /** Optional slow refill of the budget during long battles (off by default). */
  NUDGE_REFILL_ENABLED: boolean
  NUDGE_REFILL_MS: number

  // ---- Favorite move (PLAN-2 1B) ----
  /** Habit points a move needs to become a favorite candidate. */
  FAVORITE_THRESHOLD: number
  FAVORITE_MIN_TRUST: number
  /** Weight multiplier for the favorite in choice.ts (after nature and smartness). */
  FAVORITE_WEIGHT_MULT: number
  /** ATB the next bar starts with after the favorite was used. */
  FAVORITE_ATB_HEADSTART: number
  /** Small damage bonus for the favorite (1 = off). */
  FAVORITE_POWER_MULT: number
  /** Nudging towards the favorite does not use up nudge budget (and does not step up the nudge curve). */
  FAVORITE_NUDGE_FREE: boolean
  /** Nudge strength multiplier for nudging towards any other move while the favorite is usable. */
  NUDGE_AWAY_FROM_FAVORITE_MULT: number
  /** Another move takes over when it has THRESHOLD * this much more progress than the favorite. */
  FAVORITE_SWITCH_FACTOR: number
  /** At/above this trust a Pokémon does not use a favorite that cannot hurt the target. */
  FAVORITE_SMART_TRUST: number
  FAVORITE_FORGET_TRUST_PENALTY: number
  /** Battles after losing a favorite (forgetting it) during which no new favorite can form. */
  FAVORITE_COOLDOWN_BATTLES: number

  // ---- Traits (4.1) ----
  TRAITS: Record<TraitId, TraitDef>

  // ---- Obedience & trust (5.6, 4.2) ----
  OBEDIENCE_BASE_CAP: number
  OBEDIENCE_PER_BADGE: number
  /** Multiplier on (level - cap) / (level + cap). */
  OBEDIENCE_CHANCE_SCALE: number
  OBEDIENCE_OUTCOME_WEIGHTS: { loaf: number, random: number, nap: number }
  NAP_MS: number
  LOW_TRUST_THRESHOLD: number
  LOW_TRUST_LOAF_CHANCE: number
  HIGH_TRUST_THRESHOLD: number
  /** Chance to survive a lethal hit with 1 HP (once per battle). */
  ENDURE_CHANCE: number
  HIGH_TRUST_CRIT_BONUS: number
  TRUST_START_STARTER: number
  TRUST_START_WILD: number
  TRUST_START_TRAINER: number
  TRUST_MAX: number
  TRUST_PER_100_STEPS: number
  TRUST_LEVEL_UP: number
  TRUST_WIN: number
  TRUST_CENTER: number
  TRUST_BERRY: number
  TRUST_FAINT: number
  TRUST_NUDGE_WIN: number

  // ---- Damage (5.7) ----
  STAB: number
  CRIT_MULT: number
  CRIT_CHANCE_BY_STAGE: number[]
  DAMAGE_RANDOM_MIN: number
  /** Gen 3 multi-hit distribution for 2-5 hit moves: hits -> probability weight. */
  MULTI_HIT_WEIGHTS: number[]
  /** Damaging moves without a fixed power: assumed power (move name -> power). */
  VARIABLE_POWER: Record<string, number>
  /** Fixed-damage moves: 'level' = user's level, number = flat damage. */
  FIXED_DAMAGE: Record<string, 'level' | number>
  OHKO_MOVES: string[]
  /** Damaging moves whose listed stat changes apply to the user (Overheat, Superpower, ...) instead of the target. */
  USER_STAT_CHANGE_MOVES: string[]
  STRUGGLE_POWER: number
  STRUGGLE_RECOIL_FRACTION: number

  // ---- Status effects in ATB form (5.7) ----
  BURN_PCT_PER_SEC: number
  POISON_PCT_PER_SEC: number
  LEECH_SEED_PCT_PER_SEC: number
  BURN_PHYSICAL_MULT: number
  /** Paralysis halves the ATB *fill rate* (not just the speed stat, which the +100 offset would mute). */
  PARALYSIS_FILL_MULT: number
  PARALYSIS_FULL_CHANCE: number
  SLEEP_MS_RANGE: [number, number]
  FREEZE_THAW_PER_SEC: number
  CONFUSION_MS_RANGE: [number, number]
  CONFUSION_SELF_HIT_CHANCE: number
  CONFUSION_SELF_POWER: number
  /** A flinch multiplies the target's current ATB by this. */
  FLINCH_ATB_FACTOR: number
  PROTECT_MS: number

  // ---- Held items (7) ----
  QUICK_CLAW_ATB_MULT: number
  TYPE_BOOST_MULT: number
  TYPE_BOOST_ITEMS: Record<string, TypeName>
  ORAN_BERRY_HEAL: number
  ORAN_BERRY_THRESHOLD: number
  LEFTOVERS_PCT_PER_SEC: number

  // ---- Player actions (5.1, 5.8) ----
  SWITCH_COOLDOWN_MS: number
  SEND_OUT_LOCK_MS: number
  ITEM_COOLDOWN_MS: number
  ITEM_LOCK_MS: number
  BALL_COOLDOWN_MS: number
  /** Catch-rate multiplier per ball item. */
  BALL_BONUS: Record<string, number>
  /** Catch-rate multiplier by status condition of the target. */
  STATUS_CAPTURE_BONUS: Record<string, number>
  /** Pokémon below this level are easier to catch: bonus = max(1, (REF - level) / 10), capped. */
  CAPTURE_LEVEL_REF: number
  CAPTURE_LEVEL_BONUS_MAX: number
  /** ATB the wild Pokémon gains when a catch attempt fails (the price of a failed throw). */
  CAPTURE_FAIL_ATB_BONUS: number
  RUN_LOCK_MS: number
  POTION_HEAL: number

  // ---- Rewards (5.9) ----
  TRAINER_XP_MULT: number
  /** Global multiplier on all battle XP (pacing knob on top of the Gen 3 formula). */
  XP_MULTIPLIER: number
  MAX_LEVEL: number
  MAX_MOVES: number
  BLACKOUT_MONEY_LOSS: number

  // ---- Overworld / game (6, 7) ----
  ENCOUNTER_RATE: number
  WALK_STEP_MS: number
  RUN_STEP_MS: number
  SIGHT_DEFAULT: number
  STARTING_MONEY: number
  TRAINER_MONEY_PER_LEVEL: number
  IV_MAX: number
  SPEED_MULTIPLIERS: number[]
}

export const BALANCE: Balance = {
  ATB_MAX: 1000,
  ATB_SPEED_OFFSET: 100,
  ATB_K: 400 / 180,
  ACTION_LOCK_MS: 700,
  SKIPPED_TURN_LOCK_MS: 400,
  CHARGE_ANNOUNCE_LOCK_MS: 500,
  STEP_MS: 50,
  PRIORITY_HEADSTART: 300,
  PRIORITY_CLAMP: 3,
  RECOVERY_MULTIPLIER: 0.5,
  POWER_TEMPO_SCALING: false,
  POWER_TEMPO_FACTOR: 0.004,
  CHARGE_MOVES: {
    'solar-beam': { chargeMs: 1800, semiInvulnerable: false },
    'skull-bash': { chargeMs: 1500, semiInvulnerable: false },
    'sky-attack': { chargeMs: 2000, semiInvulnerable: false },
    'razor-wind': { chargeMs: 1500, semiInvulnerable: false },
    'fly': { chargeMs: 1800, semiInvulnerable: true },
    'dig': { chargeMs: 1800, semiInvulnerable: true },
    'bounce': { chargeMs: 1800, semiInvulnerable: true },
    'dive': { chargeMs: 1800, semiInvulnerable: true },
  },
  RECHARGE_MOVES: ['hyper-beam', 'giga-impact', 'blast-burn', 'frenzy-plant', 'hydro-cannon', 'rock-wrecker', 'roar-of-time'],

  CATEGORY_WEIGHTS: {
    attack: { attack: 0.78, defense: 0.09, support: 0.13 },
    defense: { attack: 0.45, defense: 0.35, support: 0.2 },
    support: { attack: 0.45, defense: 0.13, support: 0.42 },
    neutral: { attack: 0.62, defense: 0.19, support: 0.19 },
  },
  DECREASED_CATEGORY_MULT: 0.75,
  SMART_MIN: 0.15,
  SMART_MAX: 1,
  INERT_MOVE_FACTOR: 0.03,
  USELESS_STATUS_FACTOR: 0.05,
  IMMUNE_FACTOR: 0.02,
  HEAL_FULL_HP_FACTOR: 0.05,
  HEAL_LOW_HP_BOOST: 6,
  MAXED_STAT_FACTOR: 0.05,
  HABIT_WEIGHT: 0.15,
  HABIT_BONUS_CAP: 0.5,
  HABIT_GAIN_CAP_PER_BATTLE: 5,

  NUDGE_BUDGET_BASE: 3,
  NUDGE_CURVE: [0.7, 0.5, 0.3, 0.2, 0.1],
  NUDGE_TRUST_MIN_MULT: 0.5,
  NUDGE_TRUST_MAX_MULT: 1.2,
  NUDGE_MAX_STRENGTH: 0.95,
  NUDGE_ALLOWED_WHILE_PAUSED: true,
  NUDGE_REFILL_ENABLED: false,
  NUDGE_REFILL_MS: 30000,

  FAVORITE_THRESHOLD: 20,
  FAVORITE_MIN_TRUST: 150,
  FAVORITE_WEIGHT_MULT: 2,
  FAVORITE_ATB_HEADSTART: 100,
  FAVORITE_POWER_MULT: 1.1,
  FAVORITE_NUDGE_FREE: true,
  NUDGE_AWAY_FROM_FAVORITE_MULT: 0.8,
  FAVORITE_SWITCH_FACTOR: 1.5,
  FAVORITE_SMART_TRUST: 200,
  FAVORITE_FORGET_TRUST_PENALTY: 10,
  FAVORITE_COOLDOWN_BATTLES: 10,

  TRAITS: {
    loyal: {
      label: 'Lojal',
      description: 'Lyssnar gärna på dig: +2 nudges per strid.',
      nudgeBudgetDelta: 2, nudgeBudgetFixed: null, ignoresNonDamagingNudges: false, nudgeTrustBonusMult: 1,
      atbMult: 1, smartMult: 1, flatten: 0, prefersPower: false, typeWeightExponent: 1, lowHpThreshold: 0, lowHpDefenseMult: 1,
      favoriteThresholdMult: 1, favoriteWeightMult: 1, favoriteAwayMult: 1, favoriteSwitchMult: 1, nudgedProgress: 3,
    },
    stubborn: {
      label: 'Envis',
      description: 'Bara 1 nudge per strid, och ignorerar nudges på moves som inte gör skada.',
      nudgeBudgetDelta: 0, nudgeBudgetFixed: 1, ignoresNonDamagingNudges: true, nudgeTrustBonusMult: 1,
      atbMult: 1, smartMult: 1, flatten: 0, prefersPower: false, typeWeightExponent: 1, lowHpThreshold: 0, lowHpDefenseMult: 1,
      favoriteThresholdMult: 0.75, favoriteWeightMult: 1, favoriteAwayMult: 1, favoriteSwitchMult: 2.5, nudgedProgress: 2,
    },
    shy: {
      label: 'Skygg',
      description: 'Under 30 % HP väljer den mycket oftare försvars- och stödmoves.',
      nudgeBudgetDelta: 0, nudgeBudgetFixed: null, ignoresNonDamagingNudges: false, nudgeTrustBonusMult: 1,
      atbMult: 1, smartMult: 1, flatten: 0, prefersPower: false, typeWeightExponent: 1, lowHpThreshold: 0.3, lowHpDefenseMult: 4,
      favoriteThresholdMult: 1, favoriteWeightMult: 1, favoriteAwayMult: 1, favoriteSwitchMult: 1, nudgedProgress: 2,
    },
    hasty: {
      label: 'Hetsig',
      description: 'Föredrar den starkaste moven, och ATB fylls 5 % snabbare. Lite sämre på att välja smart.',
      nudgeBudgetDelta: 0, nudgeBudgetFixed: null, ignoresNonDamagingNudges: false, nudgeTrustBonusMult: 1,
      atbMult: 1.05, smartMult: 0.6, flatten: 0, prefersPower: true, typeWeightExponent: 1, lowHpThreshold: 0, lowHpDefenseMult: 1,
      favoriteThresholdMult: 1, favoriteWeightMult: 1, favoriteAwayMult: 1, favoriteSwitchMult: 1, nudgedProgress: 2,
    },
    calm: {
      label: 'Lugn',
      description: 'Väljer extra smart, och typfördelar väger tyngre.',
      nudgeBudgetDelta: 0, nudgeBudgetFixed: null, ignoresNonDamagingNudges: false, nudgeTrustBonusMult: 1,
      atbMult: 1, smartMult: 1.3, flatten: 0, prefersPower: false, typeWeightExponent: 1.5, lowHpThreshold: 0, lowHpDefenseMult: 1,
      favoriteThresholdMult: 1, favoriteWeightMult: 1, favoriteAwayMult: 1, favoriteSwitchMult: 1, nudgedProgress: 2,
    },
    playful: {
      label: 'Lekfull',
      description: 'Mer slumpmässiga val, men +1 nudge per strid.',
      nudgeBudgetDelta: 1, nudgeBudgetFixed: null, ignoresNonDamagingNudges: false, nudgeTrustBonusMult: 1,
      atbMult: 1, smartMult: 0.8, flatten: 0.5, prefersPower: false, typeWeightExponent: 1, lowHpThreshold: 0, lowHpDefenseMult: 1,
      favoriteThresholdMult: 1.5, favoriteWeightMult: 0.75, favoriteAwayMult: 1, favoriteSwitchMult: 0.6, nudgedProgress: 2,
    },
    proud: {
      label: 'Stolt',
      description: '2 nudges per strid, men en lyckad nudge ger dubbelt så mycket förtroende.',
      nudgeBudgetDelta: 0, nudgeBudgetFixed: 2, ignoresNonDamagingNudges: false, nudgeTrustBonusMult: 2,
      atbMult: 1, smartMult: 1, flatten: 0, prefersPower: false, typeWeightExponent: 1, lowHpThreshold: 0, lowHpDefenseMult: 1,
      favoriteThresholdMult: 0.7, favoriteWeightMult: 1.25, favoriteAwayMult: 0.85, favoriteSwitchMult: 1.2, nudgedProgress: 2,
    },
  },

  OBEDIENCE_BASE_CAP: 15,
  OBEDIENCE_PER_BADGE: 10,
  OBEDIENCE_CHANCE_SCALE: 1,
  OBEDIENCE_OUTCOME_WEIGHTS: { loaf: 0.5, random: 0.3, nap: 0.2 },
  NAP_MS: 3000,
  LOW_TRUST_THRESHOLD: 60,
  LOW_TRUST_LOAF_CHANCE: 0.08,
  HIGH_TRUST_THRESHOLD: 200,
  ENDURE_CHANCE: 0.25,
  HIGH_TRUST_CRIT_BONUS: 0.04,
  TRUST_START_STARTER: 120,
  TRUST_START_WILD: 50,
  TRUST_START_TRAINER: 150,
  TRUST_MAX: 255,
  TRUST_PER_100_STEPS: 1,
  TRUST_LEVEL_UP: 3,
  TRUST_WIN: 2,
  TRUST_CENTER: 1,
  TRUST_BERRY: 5,
  TRUST_FAINT: -5,
  TRUST_NUDGE_WIN: 1,

  STAB: 1.5,
  CRIT_MULT: 1.5,
  CRIT_CHANCE_BY_STAGE: [1 / 16, 1 / 8, 1 / 4, 1 / 3, 1 / 2],
  DAMAGE_RANDOM_MIN: 0.85,
  MULTI_HIT_WEIGHTS: [3, 3, 1, 1],
  VARIABLE_POWER: {
    'return': 80, 'frustration': 80, 'low-kick': 60, 'magnitude': 70, 'flail': 50, 'reversal': 50, 'present': 40, 'spit-up': 60,
  },
  FIXED_DAMAGE: { 'seismic-toss': 'level', 'night-shade': 'level', 'dragon-rage': 40, 'sonic-boom': 20 },
  OHKO_MOVES: ['fissure', 'guillotine', 'horn-drill', 'sheer-cold'],
  USER_STAT_CHANGE_MOVES: ['overheat', 'superpower', 'metal-claw', 'meteor-mash', 'steel-wing', 'ancient-power', 'silver-wind', 'rapid-spin'],
  STRUGGLE_POWER: 50,
  STRUGGLE_RECOIL_FRACTION: 0.25,

  BURN_PCT_PER_SEC: 0.02,
  POISON_PCT_PER_SEC: 0.025,
  LEECH_SEED_PCT_PER_SEC: 0.03,
  BURN_PHYSICAL_MULT: 0.5,
  PARALYSIS_FILL_MULT: 0.5,
  PARALYSIS_FULL_CHANCE: 0.25,
  SLEEP_MS_RANGE: [3000, 7000],
  FREEZE_THAW_PER_SEC: 0.2,
  CONFUSION_MS_RANGE: [4000, 8000],
  CONFUSION_SELF_HIT_CHANCE: 0.33,
  CONFUSION_SELF_POWER: 40,
  FLINCH_ATB_FACTOR: 0.5,
  PROTECT_MS: 1500,

  QUICK_CLAW_ATB_MULT: 1.1,
  TYPE_BOOST_MULT: 1.2,
  TYPE_BOOST_ITEMS: { 'silk-scarf': 'normal', 'charcoal': 'fire', 'mystic-water': 'water' },
  ORAN_BERRY_HEAL: 10,
  ORAN_BERRY_THRESHOLD: 0.5,
  LEFTOVERS_PCT_PER_SEC: 0.006,

  SWITCH_COOLDOWN_MS: 8000,
  SEND_OUT_LOCK_MS: 1200,
  ITEM_COOLDOWN_MS: 4000,
  ITEM_LOCK_MS: 900,
  BALL_COOLDOWN_MS: 3000,
  BALL_BONUS: { 'poke-ball': 1, 'great-ball': 1.5, 'ultra-ball': 2 },
  STATUS_CAPTURE_BONUS: { sleep: 2, freeze: 2, paralysis: 1.5, poison: 1.5, burn: 1.5 },
  CAPTURE_LEVEL_REF: 30,
  CAPTURE_LEVEL_BONUS_MAX: 2,
  CAPTURE_FAIL_ATB_BONUS: 200,
  RUN_LOCK_MS: 600,
  POTION_HEAL: 20,

  TRAINER_XP_MULT: 1.5,
  XP_MULTIPLIER: 1.5,
  MAX_LEVEL: 100,
  MAX_MOVES: 4,
  BLACKOUT_MONEY_LOSS: 0.5,

  ENCOUNTER_RATE: 0.1,
  WALK_STEP_MS: 150,
  RUN_STEP_MS: 90,
  SIGHT_DEFAULT: 4,
  STARTING_MONEY: 500,
  TRAINER_MONEY_PER_LEVEL: 40,
  IV_MAX: 31,
  SPEED_MULTIPLIERS: [1, 2, 3],
}

/** Shallow-merge helper for tests and simulations. */
export function withBalance(overrides: Partial<Balance>): Balance {
  return { ...BALANCE, ...overrides }
}
