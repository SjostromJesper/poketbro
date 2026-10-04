// Shared data types for the Nudge game. Pure TypeScript, no framework dependencies.

export const TYPE_NAMES = [
  'normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison', 'ground',
  'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy',
] as const
export type TypeName = typeof TYPE_NAMES[number]

export const STAT_KEYS = ['hp', 'attack', 'defense', 'spAttack', 'spDefense', 'speed'] as const
export type StatKey = typeof STAT_KEYS[number]
export type StatBlock = Record<StatKey, number>

/** Stats that can be raised/lowered with stages during a battle. */
export const BATTLE_STAT_KEYS = ['attack', 'defense', 'spAttack', 'spDefense', 'speed', 'accuracy', 'evasion'] as const
export type BattleStatKey = typeof BATTLE_STAT_KEYS[number]

export type DamageClass = 'physical' | 'special' | 'status'

export interface SpeciesData {
  id: number
  /** English identifier, e.g. "bulbasaur". */
  name: string
  /** Name shown in the UI (Swedish if PokeAPI has one, otherwise English). */
  displayName: string
  types: TypeName[]
  baseStats: StatBlock
  baseExp: number
  captureRate: number
  growthRate: string
  sprites: { front: string, back: string, icon: string }
  /** URL of the Pokémon's cry (PokeAPI `cries`, legacy preferred). Empty when missing. */
  cry: string
  /** Level-up learnset in the firered-leafgreen version group, sorted by level. */
  levelUpMoves: { level: number, move: string }[]
  /** Moves the species can learn from a TM (move names). */
  tmMoves: string[]
  /** Level-based evolutions only (MVP). */
  evolutions: { to: number, minLevel: number }[]
}

export interface MoveData {
  id: number
  /** English identifier, e.g. "razor-leaf". */
  name: string
  displayName: string
  type: TypeName
  power: number | null
  accuracy: number | null
  pp: number
  priority: number
  damageClass: DamageClass
  target: string
  /** PokeAPI ailment name ("none", "paralysis", "leech-seed", ...). */
  ailment: string
  ailmentChance: number
  critRate: number
  /** Positive = drain (heal % of damage), negative = recoil. */
  drain: number
  /** Percent of the user's max HP healed. */
  healing: number
  flinchChance: number
  minHits: number | null
  maxHits: number | null
  /** Chance (percent) that the stat changes apply for damaging moves; 0 = always (status moves). */
  statChance: number
  statChanges: { stat: BattleStatKey, change: number }[]
}

export interface NatureData {
  name: string
  displayName: string
  increased: StatKey | null
  decreased: StatKey | null
}

export interface ItemData {
  name: string
  displayName: string
  sprite: string
}

/** attacker type -> defender type -> multiplier (only entries that differ from 1). */
export type TypeChart = Record<TypeName, Partial<Record<TypeName, number>>>

/** growth rate name -> cumulative XP needed to *reach* level N (index = level, index 0 unused). */
export type GrowthRates = Record<string, number[]>

/** Everything the engine and game layer need to look up, loaded once from the generated JSON files. */
export interface GameData {
  species: Record<number, SpeciesData>
  moves: Record<string, MoveData>
  typeChart: TypeChart
  natures: Record<string, NatureData>
  growthRates: GrowthRates
  items: Record<string, ItemData>
}
