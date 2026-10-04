import { gameData } from '../data'
import { BALANCE, withBalance, type Balance, type TraitId } from '../engine/balance'
import { BattleEngine } from '../engine/battle'
import { createPokemon } from '../engine/pokemon'
import { createRng, type Rng } from '../engine/rng'
import type { BattleEvent, BattleKind, OwnedPokemon } from '../engine/types'

export const data = gameData
export { BALANCE, withBalance }

export function speciesId(name: string): number {
  const species = Object.values(data.species).find(s => s.name === name)
  if (!species) throw new Error(`no species ${name}`)
  return species.id
}

export interface MonOptions {
  moves?: string[]
  trait?: TraitId
  trust?: number
  nature?: string
  heldItem?: string
  iv?: number
}

/** A Pokémon with fixed IVs (all 15 by default), a neutral nature and the 'loyal' trait so tests are not random. */
export function mon(name: string, level: number, options: MonOptions = {}): OwnedPokemon {
  const iv = options.iv ?? 15
  return createPokemon({
    data, balance: BALANCE, rng: createRng(level * 31 + speciesId(name)),
    speciesId: speciesId(name), level,
    trust: options.trust ?? 120,
    trait: options.trait ?? 'loyal',
    nature: options.nature ?? 'hardy',
    ivs: { hp: iv, attack: iv, defense: iv, spAttack: iv, spDefense: iv, speed: iv },
    moves: options.moves,
    heldItem: options.heldItem,
  })
}

export interface EngineOptions {
  seed?: number
  kind?: BattleKind
  balance?: Balance
  badges?: number
  rng?: Rng
}

export function engineFor(player: OwnedPokemon[], enemy: OwnedPokemon[], options: EngineOptions = {}): BattleEngine {
  return new BattleEngine({
    player, enemy, kind: options.kind ?? 'wild', rng: options.rng ?? createRng(options.seed ?? 1),
    balance: options.balance ?? BALANCE, data, badges: options.badges ?? 0,
  })
}

/** Advance `ms` of game time in 16 ms frames (like the UI would) and collect all events. */
export function advance(engine: BattleEngine, ms: number, frameMs = 16): BattleEvent[] {
  const events: BattleEvent[] = []
  for (let elapsed = 0; elapsed < ms && !engine.finished; elapsed += frameMs) events.push(...engine.tick(frameMs))
  return events
}

/** Advance until `predicate` is true (checked after every frame) or `maxMs` passed. Returns the collected events. */
export function advanceUntil(engine: BattleEngine, predicate: (events: BattleEvent[]) => boolean, maxMs = 120000): BattleEvent[] {
  const events: BattleEvent[] = []
  for (let elapsed = 0; elapsed < maxMs && !engine.finished; elapsed += 16) {
    events.push(...engine.tick(16))
    if (predicate(events)) break
  }
  return events
}

export function constRng(value: number): Rng {
  return { next: () => value }
}

/** An Rng that plays back `values` in order, then repeats `fallback`. */
export function scriptedRng(values: number[], fallback = 0.5): Rng {
  let i = 0
  return { next: () => (i < values.length ? values[i++] : fallback) }
}

export const ofType = <T extends BattleEvent['type']>(events: BattleEvent[], type: T) =>
  events.filter((e): e is Extract<BattleEvent, { type: T }> => e.type === type)
