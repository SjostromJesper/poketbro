// Buildings on the logical map. Every building has the same footprint in every theme (5 x 4 tiles, door in the middle of the
// bottom row), so collision never depends on the theme; themes draw a sprite of up to that size inside it.
import type { BuildingKind } from './themes/types'
import type { MapDef } from './types'

export type { BuildingKind }

export const BUILDING_KINDS: BuildingKind[] = ['houseA', 'houseB', 'houseC', 'houseD', 'lab', 'center', 'mart', 'gym']

export const FOOTPRINT = { w: 5, h: 4, door: 2 } as const

export interface BuildingPlacement {
  kind: BuildingKind
  /** Top-left tile of the footprint on the map. */
  x: number
  y: number
}

/** The tile of the building door on the map. */
export function doorOf(placement: BuildingPlacement): { x: number, y: number } {
  return { x: placement.x + FOOTPRINT.door, y: placement.y + FOOTPRINT.h - 1 }
}

export function buildingAt(map: Pick<MapDef, 'buildings'>, tx: number, ty: number): { placement: BuildingPlacement, dx: number, dy: number } | null {
  for (const placement of map.buildings ?? []) {
    const dx = tx - placement.x
    const dy = ty - placement.y
    if (dx >= 0 && dy >= 0 && dx < FOOTPRINT.w && dy < FOOTPRINT.h) return { placement, dx, dy }
  }
  return null
}
