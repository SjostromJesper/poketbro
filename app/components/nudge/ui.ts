// Presentation helpers shared by the Nudge components.
import type { BattleStatKey, TypeName } from '~~/nudge/data/types'
import type { StatusId } from '~~/nudge/engine/types'

export const TYPE_COLORS: Record<TypeName, string> = {
  normal: '#a8a878', fire: '#f08030', water: '#6890f0', electric: '#f8d030', grass: '#78c850', ice: '#98d8d8',
  fighting: '#c03028', poison: '#a040a0', ground: '#e0c068', flying: '#a890f0', psychic: '#f85888', bug: '#a8b820',
  rock: '#b8a038', ghost: '#705898', dragon: '#7038f8', dark: '#705848', steel: '#b8b8d0', fairy: '#ee99ac',
}

export const TYPE_LABELS: Record<TypeName, string> = {
  normal: 'Normal', fire: 'Eld', water: 'Vatten', electric: 'El', grass: 'Gräs', ice: 'Is', fighting: 'Strid', poison: 'Gift',
  ground: 'Mark', flying: 'Flyg', psychic: 'Psyko', bug: 'Insekt', rock: 'Sten', ghost: 'Spöke', dragon: 'Drake', dark: 'Mörker',
  steel: 'Stål', fairy: 'Fe',
}

export const STATUS_LABELS: Record<StatusId, { short: string, color: string, title: string }> = {
  burn: { short: 'BRN', color: '#f08030', title: 'Brännskada' },
  poison: { short: 'PSN', color: '#a040a0', title: 'Förgiftad' },
  paralysis: { short: 'PAR', color: '#d8b800', title: 'Förlamad' },
  sleep: { short: 'SLP', color: '#7a8aa8', title: 'Sover' },
  freeze: { short: 'FRZ', color: '#58b8d8', title: 'Fryst' },
}

export const STAT_NAMES: Record<BattleStatKey, string> = {
  attack: 'Atk', defense: 'Def', spAttack: 'SpA', spDefense: 'SpD', speed: 'Spe', accuracy: 'Acc', evasion: 'Eva',
}

export const CATEGORY_LABELS = { attack: 'Attack', defense: 'Försvar', support: 'Stöd' } as const

export function hpColor(pct: number): string {
  if (pct > 50) return '#48c048'
  if (pct > 20) return '#e8c020'
  return '#e04040'
}
