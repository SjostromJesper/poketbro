// Creating Pokémon and turning them into battle-ready Battlers.
import type { BattleStatKey, GameData, SpeciesData, StatBlock } from '../data/types'
import type { Balance, TraitId } from './balance'
import { calcStats, randomIvs, randomNatureName, randomTrait, xpForLevel } from './formulas'
import { randomUid, type Rng } from './rng'
import type { Battler, MoveInstance, OwnedPokemon, Side } from './types'

export function emptyStages(): Record<BattleStatKey, number> {
  return { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0, accuracy: 0, evasion: 0 }
}

export function speciesOf(data: GameData, pokemon: Pick<OwnedPokemon, 'speciesId'>): SpeciesData {
  const species = data.species[pokemon.speciesId]
  if (!species) throw new Error(`Unknown species ${pokemon.speciesId}`)
  return species
}

export function displayNameOf(data: GameData, pokemon: OwnedPokemon): string {
  return pokemon.nickname?.trim() || speciesOf(data, pokemon).displayName
}

export function statsOf(data: GameData, pokemon: OwnedPokemon): StatBlock {
  return calcStats(speciesOf(data, pokemon), pokemon.ivs, pokemon.level, data.natures[pokemon.nature])
}

export function maxHpOf(data: GameData, pokemon: OwnedPokemon): number {
  return statsOf(data, pokemon).hp
}

export function newMoveInstance(data: GameData, moveName: string): MoveInstance {
  const move = data.moves[moveName]
  if (!move) throw new Error(`Unknown move ${moveName}`)
  return { move: moveName, pp: move.pp, maxPp: move.pp }
}

/** The (up to `maxMoves`) most recently learnable level-up moves at `level`, like a wild Pokémon of that level would know. */
export function defaultMovesAtLevel(data: GameData, species: SpeciesData, level: number, maxMoves: number): MoveInstance[] {
  const known: string[] = []
  for (const entry of species.levelUpMoves) {
    if (entry.level > level) break
    if (!data.moves[entry.move]) continue
    const existing = known.indexOf(entry.move)
    if (existing >= 0) known.splice(existing, 1)
    known.push(entry.move)
  }
  return known.slice(-maxMoves).map(name => newMoveInstance(data, name))
}

export interface CreatePokemonOptions {
  data: GameData
  balance: Balance
  rng: Rng
  speciesId: number
  level: number
  trust: number
  originalTrainer?: string
  caughtAt?: number
  nature?: string
  trait?: TraitId
  ivs?: StatBlock
  moves?: string[]
  heldItem?: string
  nickname?: string
}

export function createPokemon(options: CreatePokemonOptions): OwnedPokemon {
  const { data, balance, rng, speciesId, level } = options
  const species = data.species[speciesId]
  if (!species) throw new Error(`Unknown species ${speciesId}`)
  const nature = options.nature ?? randomNatureName(rng, data)
  const ivs = options.ivs ?? randomIvs(rng, balance.IV_MAX)
  const moves = options.moves
    ? options.moves.slice(0, balance.MAX_MOVES).map(name => newMoveInstance(data, name))
    : defaultMovesAtLevel(data, species, level, balance.MAX_MOVES)
  const pokemon: OwnedPokemon = {
    uid: randomUid(rng),
    speciesId,
    nickname: options.nickname,
    level,
    xp: xpForLevel(data.growthRates, species.growthRate, level),
    ivs,
    nature,
    trait: options.trait ?? randomTrait(rng, balance),
    trust: options.trust,
    moves,
    heldItem: options.heldItem,
    currentHp: 1,
    habits: {},
    caughtAt: options.caughtAt ?? 0,
    originalTrainer: options.originalTrainer ?? 'wild',
  }
  pokemon.currentHp = maxHpOf(data, pokemon)
  return pokemon
}

export function nudgeBudgetFor(trait: TraitId, balance: Balance): number {
  const def = balance.TRAITS[trait]
  return def.nudgeBudgetFixed ?? Math.max(0, balance.NUDGE_BUDGET_BASE + def.nudgeBudgetDelta)
}

export function createBattler(data: GameData, balance: Balance, pokemon: OwnedPokemon, side: Side, teamIndex: number): Battler {
  const species = speciesOf(data, pokemon)
  const stats = statsOf(data, pokemon)
  return {
    uid: pokemon.uid,
    side,
    teamIndex,
    speciesId: pokemon.speciesId,
    name: displayNameOf(data, pokemon),
    level: pokemon.level,
    types: [...species.types],
    stats,
    hp: Math.max(0, Math.min(stats.hp, pokemon.currentHp)),
    nature: pokemon.nature,
    trait: pokemon.trait,
    trust: pokemon.trust,
    moves: pokemon.moves.map(m => ({ ...m })),
    heldItem: pokemon.heldItem ?? null,
    heldItemUsed: false,
    status: pokemon.status ?? null,
    statusMs: 0,
    confusionMs: 0,
    seeded: false,
    protectedMs: 0,
    stages: emptyStages(),
    critBonus: 0,
    atb: 0,
    fillMult: 1,
    action: null,
    habits: { ...pokemon.habits },
    movesUsed: {},
    nudgedUses: {},
    favoriteMove: pokemon.favoriteMove && pokemon.moves.some(m => m.move === pokemon.favoriteMove) ? pokemon.favoriteMove : null,
    nudgeBudget: nudgeBudgetFor(pokemon.trait, balance),
    nudgesUsed: 0,
    pendingNudge: null,
    followedNudge: false,
    endureUsed: false,
    fainted: pokemon.currentHp <= 0,
    dotRemainder: 0,
    healRemainder: 0,
    facedEnemies: new Set(),
  }
}
