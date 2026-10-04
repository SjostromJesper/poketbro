// Which battle backdrop belongs to which place (pure; the canvas painting is in BattleBackdrop.vue).
import { getMap } from './maps'

export type BattleTheme = 'meadow' | 'forest' | 'town' | 'indoor' | 'gym'

export const BATTLE_THEMES: BattleTheme[] = ['meadow', 'forest', 'town', 'indoor', 'gym']

/** Backdrop for a battle fought on the given map. Unknown maps get the meadow. */
export function themeForMap(mapId: string): BattleTheme {
  let map
  try {
    map = getMap(mapId)
  } catch {
    return 'meadow'
  }
  if (map.indoor) return mapId.includes('gym') ? 'gym' : 'indoor'
  if (mapId === 'skogen') return 'forest'
  if (map.buildings?.length) return 'town'
  return 'meadow'
}
