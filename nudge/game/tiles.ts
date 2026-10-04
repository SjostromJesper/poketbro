// Tile characters used in map files, and what they mean for gameplay. Rendering lives in the UI layer.

export type TileKind = 'ground' | 'grass' | 'tree' | 'water' | 'path' | 'flowers' | 'fence' | 'roof' | 'wall' | 'door' | 'sign' | 'floor' | 'counter' | 'mat'

export interface TileInfo {
  kind: TileKind
  walkable: boolean
  /** Wild Pokémon can appear when stepping on this tile. */
  encounter: boolean
}

export const TILES: Record<string, TileInfo> = {
  '.': { kind: 'ground', walkable: true, encounter: false },
  ',': { kind: 'grass', walkable: true, encounter: true },
  '#': { kind: 'tree', walkable: false, encounter: false },
  '~': { kind: 'water', walkable: false, encounter: false },
  '=': { kind: 'path', walkable: true, encounter: false },
  'o': { kind: 'flowers', walkable: true, encounter: false },
  'f': { kind: 'fence', walkable: false, encounter: false },
  'R': { kind: 'roof', walkable: false, encounter: false },
  'W': { kind: 'wall', walkable: false, encounter: false },
  'D': { kind: 'door', walkable: true, encounter: false },
  'S': { kind: 'sign', walkable: false, encounter: false },
  'F': { kind: 'floor', walkable: true, encounter: false },
  'T': { kind: 'counter', walkable: false, encounter: false },
  'M': { kind: 'mat', walkable: true, encounter: false },
}

const SOLID: TileInfo = { kind: 'tree', walkable: false, encounter: false }

export function tileInfo(char: string): TileInfo {
  return TILES[char] ?? SOLID
}
