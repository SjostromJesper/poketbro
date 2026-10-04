// Helpers for the opponent side. Enemy Pokémon choose moves with the same algorithm as the player's (choice.ts), just without
// nudges or obedience checks, so all that is needed here is generating them.
import type { GameData } from '../data/types'
import type { Balance } from './balance'
import { createPokemon } from './pokemon'
import type { Rng } from './rng'
import type { OwnedPokemon } from './types'

export interface EnemyOptions {
  data: GameData
  balance: Balance
  rng: Rng
  speciesId: number
  level: number
  /** Explicit move set (trainer teams); defaults to the usual learnset at that level. */
  moves?: string[]
  heldItem?: string
}

export function createWildPokemon(options: EnemyOptions): OwnedPokemon {
  return createPokemon({ ...options, trust: options.balance.TRUST_START_WILD, originalTrainer: 'wild' })
}

export function createTrainerPokemon(options: EnemyOptions & { trainerName: string }): OwnedPokemon {
  return createPokemon({ ...options, trust: options.balance.TRUST_START_TRAINER, originalTrainer: options.trainerName })
}
