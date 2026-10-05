// What happens in the battle scene after a battle (PLAN-3 2): a list of steps the UI plays one press at a time.
// The engine and `applyBattleOutcome` produce the results as data; this module turns them into steps. Pure TypeScript.
//
// State is updated atomically when the sequence is built (XP, levels, trust, habits, favorites are applied to the party at once),
// so closing the page in the middle never leaves a half-applied battle. Only the choices still open (which move to forget,
// nickname) are applied when confirmed.
import type { GameData, StatKey } from '../data/types'
import { STAT_KEYS } from '../data/types'
import type { Balance } from '../engine/balance'
import { calcStats, xpForLevel } from '../engine/formulas'
import { displayNameOf, speciesOf } from '../engine/pokemon'
import { applyBattleOutcome, type LevelUpInfo, type OutcomeApplication } from '../engine/progression'
import type { BattleOutcome, OwnedPokemon } from '../engine/types'
import type { JingleId } from './audio-manifest'
import type { SpriteKey } from './sprites'
import { STAT_LABELS_SV, trustHearts } from './summary'

export interface StatChange {
  stat: StatKey
  label: string
  before: number
  after: number
  delta: number
}

export type SequenceStep =
  /** One or more lines of text, one press per line. `bar` fills an XP bar while the text is shown. */
  | { type: 'message', lines: string[], speaker?: string, portrait?: SpriteKey, jingle?: JingleId, bar?: XpBar }
  /** An XP bar filling on its own (after a level-up), no press needed. */
  | { type: 'xpBar', bar: XpBar }
  /** The level-up panel: first the gains, then the new totals. */
  | { type: 'levelUp', uid: string, name: string, level: number, changes: StatChange[] }
  /** The player chooses which move to forget for `move` (or none). */
  | { type: 'moveReplace', uid: string, move: string }
  | { type: 'favorite', uid: string, move: string, previous?: string }
  | { type: 'nickname', uid: string }

export interface XpBar {
  uid: string
  name: string
  level: number
  /** Percent of the level (0-100). */
  from: number
  to: number
}

function xpPercent(data: GameData, balance: Balance, pokemon: Pick<OwnedPokemon, 'speciesId' | 'xp' | 'level'>, level = pokemon.level, xp = pokemon.xp): number {
  if (level >= balance.MAX_LEVEL) return 100
  const growth = data.species[pokemon.speciesId].growthRate
  const base = xpForLevel(data.growthRates, growth, level)
  const next = xpForLevel(data.growthRates, growth, level + 1)
  return Math.max(0, Math.min(100, ((xp - base) / (next - base)) * 100))
}

/** Stats of a Pokémon at a given level (for the level-up panel). */
export function statsAtLevel(data: GameData, pokemon: OwnedPokemon, level: number) {
  return calcStats(speciesOf(data, pokemon), pokemon.ivs, level, data.natures[pokemon.nature])
}

export function statChanges(data: GameData, pokemon: OwnedPokemon, fromLevel: number, toLevel: number): StatChange[] {
  const before = statsAtLevel(data, pokemon, fromLevel)
  const after = statsAtLevel(data, pokemon, toLevel)
  return STAT_KEYS.map(stat => ({ stat, label: STAT_LABELS_SV[stat], before: before[stat], after: after[stat], delta: after[stat] - before[stat] }))
}

export interface ExperienceResult {
  steps: SequenceStep[]
  application: OutcomeApplication
}

/**
 * Applies the finished battle to the party and returns the steps for XP, level-ups, new moves, trust and favorites,
 * one participant at a time. `party` is mutated (see the note at the top).
 */
export function applyAndNarrate(data: GameData, balance: Balance, party: OwnedPokemon[], outcome: BattleOutcome): ExperienceResult {
  const before = new Map(party.map(p => [p.uid, { level: p.level, xp: p.xp, hearts: trustHearts(p.trust, balance) }]))
  const application = applyBattleOutcome(data, balance, party, outcome)
  const steps: SequenceStep[] = []

  for (const update of outcome.party) {
    const pokemon = party.find(p => p.uid === update.uid)
    const was = before.get(update.uid)
    const gained = outcome.xp[update.uid] ?? 0
    if (!pokemon || !was) continue
    const name = displayNameOf(data, pokemon)
    const info = application.levelUps.find(l => l.uid === pokemon.uid)
    const finalPct = xpPercent(data, balance, pokemon)

    if (gained > 0) {
      const reachedNew = !!info
      steps.push({
        type: 'message',
        lines: [`${name} fick ${gained} XP!`],
        bar: { uid: pokemon.uid, name, level: was.level, from: xpPercent(data, balance, pokemon, was.level, was.xp), to: reachedNew ? 100 : finalPct },
      })
      if (info) steps.push(...levelSteps(data, balance, pokemon, name, info, finalPct))
    }

    if (trustHearts(pokemon.trust, balance) > was.hearts) steps.push({ type: 'message', lines: [`${name} litar mer på dig nu!`] })
    for (const fav of application.favorites.filter(f => f.uid === pokemon.uid)) {
      steps.push({ type: 'favorite', uid: fav.uid, move: fav.move, previous: fav.previous })
    }
  }
  return { steps, application }
}

function levelSteps(data: GameData, balance: Balance, pokemon: OwnedPokemon, name: string, info: LevelUpInfo, finalPct: number): SequenceStep[] {
  const steps: SequenceStep[] = []
  const species = speciesOf(data, pokemon)
  const moveName = (move: string) => data.moves[move]?.displayName ?? move
  for (let level = info.from + 1; level <= info.to; level++) {
    steps.push({ type: 'message', lines: [`${name} nådde nivå ${level}!`], jingle: 'levelUp' })
    steps.push({ type: 'levelUp', uid: pokemon.uid, name, level, changes: statChanges(data, pokemon, level - 1, level) })
    const atLevel = (move: string) => species.levelUpMoves.some(e => e.level === level && e.move === move)
    for (const move of info.learned.filter(atLevel)) steps.push({ type: 'message', lines: [`${name} lärde sig ${moveName(move)}!`] })
    for (const move of info.pendingMoves.filter(atLevel)) {
      steps.push({ type: 'message', lines: [`${name} vill lära sig ${moveName(move)}, men kan bara ha ${balance.MAX_MOVES} moves.`] })
      steps.push({ type: 'moveReplace', uid: pokemon.uid, move })
    }
    steps.push({ type: 'xpBar', bar: { uid: pokemon.uid, name, level, from: 0, to: level < info.to ? 100 : finalPct } })
  }
  return steps
}

