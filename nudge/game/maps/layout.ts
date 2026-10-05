// The sizes of all maps and the helper that joins two of them with a road. Sizes are in one place so a road on one map can land at the right
// spot of the next one whichever is built first.
import type { MusicId } from '../audio-manifest'
import type { BuildingKind } from '../buildings'
import { room, type MapBuilder } from '../mapBuilder'

/** [width, height] of every outdoor/indoor map of the world. */
export const SIZES: Record<string, [number, number]> = {
  hemstad: [30, 24], hemhus: [9, 7], proflab: [12, 9],
  route1: [22, 46], skogen: [30, 42],
  gruss: [36, 28], gruss_center: [11, 9], gruss_mart: [9, 8], gruss_gym: [13, 15], gruss_hus1: [8, 6],
  route2: [38, 40],
  manberget_1: [32, 26], manberget_2: [28, 22], manberget_3: [24, 20],
  route3: [42, 30],
  hamn: [40, 30], hamn_center: [11, 9], hamn_mart: [11, 9], hamn_gym: [13, 15], hamn_hus1: [8, 6], hamn_hus2: [8, 6],
  route4: [34, 36], kraftverket_1: [30, 24], kraftverket_2: [26, 20],
  gnistby: [36, 26], gnistby_center: [11, 9], gnistby_mart: [9, 8], gnistby_gym: [13, 15], gnistby_hus1: [8, 6], gnistby_hus2: [8, 6],
  route5: [32, 42], spoktornet_1: [22, 18], spoktornet_2: [22, 18], spoktornet_3: [22, 18],
  route6: [42, 34], blomstad: [36, 28], blomstad_center: [11, 9], blomstad_mart: [9, 8], blomstad_gym: [13, 15], blomstad_hus1: [8, 6],
  vildmarken: [46, 44],
}

export type Side = 'n' | 's' | 'e' | 'w'

export interface RoadOptions {
  width?: number
  requiresBadges?: number
  /** The road is closed until the player has a Pokémon of their own. */
  requiresStarter?: boolean
  blockedDialog?: string[]
}

/**
 * A road leaving map `m` over its edge `side`, `width` tiles wide starting at `pos` (x for n/s, y for e/w), arriving in `to` at `toPos` on the
 * opposite edge, one tile inside it. The edge tiles become path (so the road is walkable) and warps.
 */
export function road(m: MapBuilder, side: Side, pos: number, to: string, toPos: number, options: RoadOptions = {}): void {
  const width = options.width ?? 2
  const [tw, th] = SIZES[to]
  for (let i = 0; i < width; i++) {
    const extra = { ...(options.requiresBadges ? { requiresBadges: options.requiresBadges } : {}), ...(options.requiresStarter ? { requires: 'starter' as const } : {}), ...(options.blockedDialog ? { blockedDialog: options.blockedDialog } : {}) }
    if (side === 'n') {
      m.fill(pos + i, 0, 1, 2, 'path')
      m.warp(pos + i, 0, to, toPos + i, th - 2, { facing: 'up', ...extra })
    } else if (side === 's') {
      m.fill(pos + i, m.height - 2, 1, 2, 'path')
      m.warp(pos + i, m.height - 1, to, toPos + i, 1, { facing: 'down', ...extra })
    } else if (side === 'w') {
      m.fill(0, pos + i, 2, 1, 'path')
      m.warp(0, pos + i, to, tw - 2, toPos + i, { facing: 'left', ...extra })
    } else {
      m.fill(m.width - 2, pos + i, 2, 1, 'path')
      m.warp(m.width - 1, pos + i, to, 1, toPos + i, { facing: 'right', ...extra })
    }
  }
}

/**
 * A building on `outdoor` with a room behind its door. Returns the room's builder (add NPCs and furniture, then `.build()`); the room's
 * exit mat leads back to the tile right below the door, the door leads to the tile above the mat.
 */
export function enterable(
  outdoor: MapBuilder, kind: BuildingKind, x: number, y: number, interiorId: string,
  options: { name: string, music?: MusicId, floor?: 'wood' | 'stone', fishingTable?: string },
): MapBuilder {
  const [w, h] = SIZES[interiorId]
  outdoor.building(kind, x, y, { to: interiorId, toX: Math.floor(w / 2) - 1, toY: h - 2, facing: 'up' })
  return room(interiorId, w, h, { ...options, exit: { to: outdoor.id, toX: x + 2, toY: y + 4 } })
}

/** Stairs between two cave floors (or tower floors): a stairs tile with a warp that lands on the given tile of the other floor (next to its stairs). */
export function stairs(m: MapBuilder, x: number, y: number, to: string, landX: number, landY: number): void {
  m.fill(x, y, 1, 1, 'stairs')
  m.warp(x, y, to, landX, landY, { facing: 'down' })
}

/** Two staircases that lead to each other (cave floors, tower floors): each one lands the player on the floor tile right below the other's stairs. */
export function linkStairs(a: MapBuilder, ax: number, ay: number, b: MapBuilder, bx: number, by: number, floor = 'cave'): void {
  a.fill(ax, ay + 1, 1, 1, floor)
  b.fill(bx, by + 1, 1, 1, floor)
  stairs(a, ax, ay, b.id, bx, by + 1)
  stairs(b, bx, by, a.id, ax, ay + 1)
}

/** The inside of a Pokémon Center: nurse, the PC and the fast-travel terminal. `prefix` keeps the NPC ids unique. */
export function fillCenter(c: MapBuilder, prefix: string, town: string): MapBuilder {
  return c
    .fill(3, 3, 5, 1, 'counter')
    .npc({
      id: `${prefix}-sjukskoterska`, x: 5, y: 2, facing: 'down', look: 'nurse', action: 'heal', name: 'Sjuksköterska',
      dialog: [`Välkommen till Pokémon Center i ${town}! Ska jag ta hand om dina Pokémon?`, 'Klart! Dina Pokémon är friska igen.'],
    })
    .npc({ id: `${prefix}-pc`, x: 8, y: 1, facing: 'down', look: 'pc', action: 'pc', name: 'PC', dialog: ['Du loggade in på Pokémon-lagringen.'] })
    .npc({
      id: `${prefix}-resekarta`, x: 2, y: 1, facing: 'down', look: 'pc', action: 'travel', name: 'Resekarta',
      dialog: ['Snabbresekartan visar alla Pokémon Center du har besökt.'],
    })
}

/** The inside of a Pokémart: shelves, a counter and the clerk (the stock comes from `shopStock`, keyed on the mart's map id). */
export function fillMart(m: MapBuilder, prefix: string, greeting: string): MapBuilder {
  const mid = Math.floor(m.width / 2)
  return m
    .fill(2, 3, m.width - 4, 1, 'counter')
    .fill(1, 1, m.width - 2, 1, 'shelf')
    .npc({ id: `${prefix}-expedit`, x: mid, y: 2, facing: 'down', look: 'clerk', action: 'shop', name: 'Expedit', dialog: [greeting] })
}
