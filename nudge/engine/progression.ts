// What happens to a Pokémon after a battle: HP/PP/status, XP and level-ups, new moves, evolution, habits and trust (4.2, 4.3, 5.5, 5.9).
import type { GameData } from '../data/types'
import type { Balance } from './balance'
import { levelForXp, xpForLevel } from './formulas'
import { maxHpOf, newMoveInstance, speciesOf } from './pokemon'
import type { BattleOutcome, OwnedPokemon } from './types'

export interface LevelUpInfo {
  uid: string
  from: number
  to: number
  /** Moves learned automatically (there was a free slot). */
  learned: string[]
  /** Moves the Pokémon wants to learn but has no free slot for: the UI asks which move to forget. */
  pendingMoves: string[]
  /** Set when a level-based evolution is now available. */
  evolveTo: number | null
}

export interface OutcomeApplication {
  levelUps: LevelUpInfo[]
}

export function addTrust(pokemon: OwnedPokemon, delta: number, balance: Balance): void {
  pokemon.trust = Math.max(0, Math.min(balance.TRUST_MAX, Math.round(pokemon.trust + delta)))
}

export function rescaleHpAfterStatChange(data: GameData, pokemon: OwnedPokemon, oldMaxHp: number): void {
  const gained = maxHpOf(data, pokemon) - oldMaxHp
  pokemon.currentHp = Math.max(0, Math.min(maxHpOf(data, pokemon), pokemon.currentHp + Math.max(0, gained)))
}

/** Learnable level-up moves granted at exactly `level` that the Pokémon does not know yet. */
export function movesLearnedAtLevel(data: GameData, pokemon: OwnedPokemon, level: number): string[] {
  const species = speciesOf(data, pokemon)
  const known = new Set(pokemon.moves.map(m => m.move))
  return species.levelUpMoves.filter(e => e.level === level && data.moves[e.move] && !known.has(e.move)).map(e => e.move)
}

export function pendingEvolution(data: GameData, pokemon: OwnedPokemon): number | null {
  const species = speciesOf(data, pokemon)
  const evolution = species.evolutions.find(e => pokemon.level >= e.minLevel && data.species[e.to])
  return evolution?.to ?? null
}

/** Replaces move slot `replaceIndex` (or appends when there is room and replaceIndex is null). Habits for a forgotten move are dropped. */
export function learnMove(data: GameData, pokemon: OwnedPokemon, moveName: string, replaceIndex: number | null, balance: Balance): void {
  if (pokemon.moves.some(m => m.move === moveName)) return
  const instance = newMoveInstance(data, moveName)
  if (replaceIndex === null) {
    if (pokemon.moves.length < balance.MAX_MOVES) pokemon.moves.push(instance)
    return
  }
  const forgotten = pokemon.moves[replaceIndex]
  if (forgotten) delete pokemon.habits[forgotten.move]
  pokemon.moves[replaceIndex] = instance
}

export function evolvePokemon(data: GameData, pokemon: OwnedPokemon, toSpeciesId: number): void {
  const oldMax = maxHpOf(data, pokemon)
  pokemon.speciesId = toSpeciesId
  rescaleHpAfterStatChange(data, pokemon, oldMax)
}

/** Grants XP and processes every level gained. Mutates the Pokémon. */
export function grantXp(data: GameData, balance: Balance, pokemon: OwnedPokemon, amount: number): LevelUpInfo | null {
  if (amount <= 0 || pokemon.level >= balance.MAX_LEVEL) return null
  const species = speciesOf(data, pokemon)
  const oldMax = maxHpOf(data, pokemon)
  const from = pokemon.level
  pokemon.xp += amount
  const to = levelForXp(data.growthRates, species.growthRate, pokemon.xp, balance.MAX_LEVEL)
  if (to === from) return null

  const learned: string[] = []
  const pendingMoves: string[] = []
  for (let level = from + 1; level <= to; level++) {
    pokemon.level = level
    addTrust(pokemon, balance.TRUST_LEVEL_UP, balance)
    for (const move of movesLearnedAtLevel(data, pokemon, level)) {
      if (pokemon.moves.length < balance.MAX_MOVES) {
        learnMove(data, pokemon, move, null, balance)
        learned.push(move)
      } else {
        pendingMoves.push(move)
      }
    }
  }
  pokemon.level = to
  rescaleHpAfterStatChange(data, pokemon, oldMax)
  return { uid: pokemon.uid, from, to, learned, pendingMoves, evolveTo: pendingEvolution(data, pokemon) }
}

/** Applies a finished battle to the player's party (in place). */
export function applyBattleOutcome(data: GameData, balance: Balance, party: OwnedPokemon[], outcome: BattleOutcome): OutcomeApplication {
  const levelUps: LevelUpInfo[] = []
  const won = outcome.result === 'win'
  for (const update of outcome.party) {
    const pokemon = party.find(p => p.uid === update.uid)
    if (!pokemon) continue
    pokemon.currentHp = update.currentHp
    pokemon.status = update.status ?? undefined
    pokemon.moves = update.moves.map(m => ({ ...m }))
    if (update.heldItem === null) delete pokemon.heldItem

    if (update.fainted) addTrust(pokemon, balance.TRUST_FAINT, balance)

    if (won && !update.fainted && update.participated) {
      addTrust(pokemon, balance.TRUST_WIN, balance)
      for (const [move, used] of Object.entries(update.movesUsed)) {
        if (move === 'struggle' || !pokemon.moves.some(m => m.move === move)) continue
        pokemon.habits[move] = (pokemon.habits[move] ?? 0) + Math.min(used, balance.HABIT_GAIN_CAP_PER_BATTLE)
      }
      if (update.followedNudge) {
        addTrust(pokemon, balance.TRUST_NUDGE_WIN * balance.TRAITS[pokemon.trait].nudgeTrustBonusMult, balance)
      }
    }

    const gained = outcome.xp[pokemon.uid] ?? 0
    const info = grantXp(data, balance, pokemon, gained)
    if (info) levelUps.push(info)
  }
  return { levelUps }
}

/** Pokémon Center: full HP, no status, full PP, +1 trust. */
export function healPokemon(data: GameData, balance: Balance, pokemon: OwnedPokemon, withTrust = true): void {
  pokemon.currentHp = maxHpOf(data, pokemon)
  pokemon.status = undefined
  for (const move of pokemon.moves) move.pp = move.maxPp
  if (withTrust) addTrust(pokemon, balance.TRUST_CENTER, balance)
}

export { xpForLevel }
