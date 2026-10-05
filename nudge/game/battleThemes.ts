// Which battle backdrop belongs to which place (pure; the canvas painting is in BattleBackdrop.vue).
import { FOOTPRINT, type BuildingPlacement } from './buildings'
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

// ---------------------------------------------------------------------------
// Backdrop maps: each backdrop is a small map drawn with the active graphics theme
// ---------------------------------------------------------------------------

export const BACKDROP_COLS = 20
export const BACKDROP_ROWS = 8
/** Number of tile rows at the top that are sky (painted as a gradient, the theme draws the rest). */
export const SKY_ROWS: Record<BattleTheme, number> = { meadow: 2, forest: 0, town: 0, indoor: 0, gym: 0 }

export interface BackdropMap {
  tiles: string[]
  indoor?: boolean
  floor?: 'wood' | 'stone'
  buildings?: BuildingPlacement[]
}

function stamp(rows: string[], x: number, y: number, door: number): void {
  for (let dy = 0; dy < FOOTPRINT.h; dy++) {
    const row = rows[y + dy].split('')
    for (let dx = 0; dx < FOOTPRINT.w; dx++) row[x + dx] = dy === 0 ? 'R' : dy === FOOTPRINT.h - 1 && dx === door ? 'D' : 'W'
    rows[y + dy] = row.join('')
  }
}

/** The tile map behind a battle. The theme decides how trees, houses, floors and walls look. */
export function backdropMap(theme: BattleTheme): BackdropMap {
  const blank = (char: string) => char.repeat(BACKDROP_COLS)
  const rows = Array.from({ length: BACKDROP_ROWS }, () => blank('.'))
  switch (theme) {
    case 'meadow':
      rows[2] = blank('#')
      rows[3] = blank('#')
      return { tiles: rows }
    case 'forest':
      for (let y = 0; y < 4; y++) rows[y] = blank('#')
      return { tiles: rows }
    case 'town': {
      const buildings: BuildingPlacement[] = [
        { kind: 'houseA', x: 0, y: 0 }, { kind: 'center', x: 5, y: 0 }, { kind: 'houseC', x: 10, y: 0 }, { kind: 'mart', x: 15, y: 0 },
      ]
      for (const b of buildings) stamp(rows, b.x, b.y, FOOTPRINT.door)
      return { tiles: rows, buildings }
    }
    case 'indoor':
    case 'gym': {
      const tiles = Array.from({ length: BACKDROP_ROWS }, (_, y) => (y < 2 ? blank('#') : blank('F')))
      return { tiles, indoor: true, floor: theme === 'gym' ? 'stone' : 'wood' }
    }
  }
}
