// Everything the summary screen shows about a Pokémon, as plain data (so it can be tested without a UI).
import type { GameData, MoveData, StatKey, TypeName } from '../data/types'
import { STAT_KEYS } from '../data/types'
import type { Balance, MoveCategory } from '../engine/balance'
import { natureCategoryWeights } from '../engine/choice'
import { favoriteThreshold } from '../engine/favorite'
import { xpForLevel } from '../engine/formulas'
import { classifyMove, isInert } from '../engine/moves'
import { displayNameOf, speciesOf, statsOf } from '../engine/pokemon'
import type { OwnedPokemon } from '../engine/types'

export const STAT_LABELS_SV: Record<StatKey, string> = {
  hp: 'HP', attack: 'Attack', defense: 'Försvar', spAttack: 'Spec.attack', spDefense: 'Spec.försvar', speed: 'Snabbhet',
}

export const CATEGORY_LABELS_SV: Record<MoveCategory, string> = { attack: 'attacker', defense: 'försvarsmoves', support: 'stödmoves' }

/** Number of small hearts shown as progress towards a favorite. */
export const PROGRESS_HEARTS = 5

export interface StatLine {
  stat: StatKey
  label: string
  value: number
  /** +1 = raised by the nature, -1 = lowered. */
  nature: -1 | 0 | 1
}

export interface MoveLine {
  name: string
  type: TypeName
  category: MoveCategory
  damageClass: MoveData['damageClass']
  power: number | null
  accuracy: number | null
  pp: number
  maxPp: number
  /** Short effect descriptions in Swedish. */
  effects: string[]
  habit: number
  /** True for the Pokémon's favorite move (shown with a ♥). */
  favorite: boolean
  /** 0..HEARTS filled small hearts showing progress towards becoming a favorite. */
  progressHearts: number
}

export interface SummaryView {
  uid: string
  name: string
  speciesName: string
  speciesId: number
  types: TypeName[]
  level: number
  xp: number
  /** XP into the current level / XP needed for the next one (null at the level cap). */
  xpProgress: { current: number, needed: number } | null
  hp: number
  maxHp: number
  stats: StatLine[]
  nature: { name: string, label: string, increased: StatKey | null, decreased: StatKey | null, preference: Record<MoveCategory, number>, text: string }
  trait: { id: string, label: string, description: string }
  trust: number
  /** 0..5 filled hearts. */
  hearts: number
  heldItem: string | null
  moves: MoveLine[]
  /** Top habits, most used first. */
  habits: { move: string, name: string, value: number }[]
  /** Display name of the favorite move, if the Pokémon has one. */
  favourite: string | null
  /** Progress needed for a move to become a favorite (for the progress hearts). */
  favoriteThreshold: number
  /** True while forgetting favorites is blocked after a recent loss. */
  favoriteCooldown: number
  originalTrainer: string
}

export function trustHearts(trust: number, balance: Balance): number {
  return Math.max(0, Math.min(5, Math.ceil((trust / balance.TRUST_MAX) * 5)))
}

/** Swedish one-liners about what a move does beyond plain damage. */
export function describeMoveEffects(move: MoveData, balance: Balance): string[] {
  const effects: string[] = []
  const statSv: Record<string, string> = {
    attack: 'Attack', defense: 'Försvar', spAttack: 'Spec.attack', spDefense: 'Spec.försvar', speed: 'Snabbhet', accuracy: 'Träffsäkerhet', evasion: 'Undvikande',
  }
  const ailmentSv: Record<string, string> = {
    paralysis: 'förlamning', sleep: 'sömn', freeze: 'frysning', burn: 'brännskada', poison: 'gift', confusion: 'förvirring', 'leech-seed': 'Leech Seed',
  }
  if (isInert(move, balance)) effects.push('Effekten är inte implementerad ännu.')
  if (move.priority > 0) effects.push('Snabb: nästa ATB-bar startar med försprång.')
  if (move.priority < 0) effects.push('Långsam: nästa ATB-bar startar med handikapp.')
  if (move.name in balance.CHARGE_MOVES) effects.push('Laddar innan den slår till.')
  if (balance.RECHARGE_MOVES.includes(move.name)) effects.push('Kräver återhämtning efteråt.')
  if (move.minHits && move.maxHits) effects.push(move.minHits === move.maxHits ? `Slår ${move.minHits} gånger.` : `Slår ${move.minHits}-${move.maxHits} gånger.`)
  if (move.drain > 0) effects.push(`Läker ${move.drain} % av skadan.`)
  if (move.drain < 0) effects.push(`Rekyl: ${-move.drain} % av skadan.`)
  if (move.healing > 0) effects.push(`Läker ${move.healing} % av maxlivet.`)
  if (move.critRate > 0) effects.push('Hög chans till kritisk träff.')
  if (move.ailment in ailmentSv) {
    const chance = move.damageClass === 'status' || move.ailmentChance === 0 ? '' : `${move.ailmentChance} % chans: `
    effects.push(`${chance}orsakar ${ailmentSv[move.ailment]}.`)
  }
  if (move.flinchChance > 0) effects.push(`${move.flinchChance} % chans att skrämma motståndaren.`)
  for (const change of move.statChanges) {
    const self = move.target === 'user' || balance.USER_STAT_CHANGE_MOVES.includes(move.name)
    const chance = move.damageClass !== 'status' && move.statChance > 0 && move.statChance < 100 ? `${move.statChance} % chans: ` : ''
    const direction = change.change > 0 ? 'höjer' : 'sänker'
    effects.push(`${chance}${direction} ${self ? 'egen' : 'motståndarens'} ${statSv[change.stat]} ${Math.abs(change.change)} steg.`)
  }
  return effects
}

export function buildSummary(data: GameData, balance: Balance, pokemon: OwnedPokemon): SummaryView {
  const species = speciesOf(data, pokemon)
  const stats = statsOf(data, pokemon)
  const nature = data.natures[pokemon.nature]
  const traitDef = balance.TRAITS[pokemon.trait]

  const weights = natureCategoryWeights(pokemon.nature, data, balance)
  const total = weights.attack + weights.defense + weights.support
  const preference: Record<MoveCategory, number> = { attack: weights.attack / total, defense: weights.defense / total, support: weights.support / total }
  const ordered = (Object.keys(preference) as MoveCategory[]).sort((a, b) => preference[b] - preference[a])
  const nearEven = preference[ordered[0]] - preference[ordered[2]] < 0.08
  const text = nearEven
    ? 'Ingen särskild stil: den väljer ganska jämnt mellan attacker, försvar och stöd.'
    : `Föredrar ${CATEGORY_LABELS_SV[ordered[0]]} (${Math.round(preference[ordered[0]] * 100)} %), därefter ${CATEGORY_LABELS_SV[ordered[1]]} (${Math.round(preference[ordered[1]] * 100)} %).`

  const nextXp = pokemon.level >= balance.MAX_LEVEL ? null : xpForLevel(data.growthRates, species.growthRate, pokemon.level + 1)
  const currentLevelXp = xpForLevel(data.growthRates, species.growthRate, pokemon.level)
  const habits = Object.entries(pokemon.habits)
    .filter(([move, value]) => value > 0 && data.moves[move])
    .sort((a, b) => b[1] - a[1])
    .map(([move, value]) => ({ move, name: data.moves[move].displayName, value }))

  return {
    uid: pokemon.uid,
    name: displayNameOf(data, pokemon),
    speciesName: species.displayName,
    speciesId: species.id,
    types: species.types,
    level: pokemon.level,
    xp: pokemon.xp,
    xpProgress: nextXp === null ? null : { current: Math.max(0, pokemon.xp - currentLevelXp), needed: nextXp - currentLevelXp },
    hp: pokemon.currentHp,
    maxHp: stats.hp,
    stats: STAT_KEYS.map(stat => ({
      stat,
      label: STAT_LABELS_SV[stat],
      value: stats[stat],
      nature: nature?.increased === stat && nature.decreased !== stat ? 1 : nature?.decreased === stat && nature.increased !== stat ? -1 : 0,
    })),
    nature: {
      name: pokemon.nature,
      label: nature?.displayName ?? pokemon.nature,
      increased: nature?.increased ?? null,
      decreased: nature?.decreased ?? null,
      preference,
      text,
    },
    trait: { id: pokemon.trait, label: traitDef.label, description: traitDef.description },
    trust: pokemon.trust,
    hearts: trustHearts(pokemon.trust, balance),
    heldItem: pokemon.heldItem ?? null,
    moves: pokemon.moves.map((instance) => {
      const move = data.moves[instance.move]
      return {
        name: move.displayName,
        type: move.type,
        category: classifyMove(move, balance),
        damageClass: move.damageClass,
        power: move.power,
        accuracy: move.accuracy,
        pp: instance.pp,
        maxPp: instance.maxPp,
        effects: describeMoveEffects(move, balance),
        habit: pokemon.habits[instance.move] ?? 0,
        favorite: pokemon.favoriteMove === instance.move,
        progressHearts: Math.min(PROGRESS_HEARTS, Math.floor(((pokemon.habits[instance.move] ?? 0) / favoriteThreshold(pokemon.trait, balance)) * PROGRESS_HEARTS)),
      }
    }),
    habits,
    favourite: pokemon.favoriteMove && data.moves[pokemon.favoriteMove] ? data.moves[pokemon.favoriteMove].displayName : null,
    favoriteThreshold: favoriteThreshold(pokemon.trait, balance),
    favoriteCooldown: pokemon.favoriteCooldown ?? 0,
    originalTrainer: pokemon.originalTrainer,
  }
}
