// Tile characters used in map files, and what they mean for gameplay. Rendering lives in the UI layer.

export type TileKind =
  | 'ground' | 'grass' | 'tree' | 'water' | 'path' | 'flowers' | 'fence' | 'roof' | 'wall' | 'door' | 'sign' | 'floor' | 'counter' | 'mat'
  | 'sand' | 'ledge' | 'rock' | 'cavefloor' | 'cavewall' | 'stairs' | 'shelf' | 'table' | 'bed'

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
  // PLAN-3 world tiles
  's': { kind: 'sand', walkable: true, encounter: false },
  /** A one-way ledge: you can jump down over it (walking down), never up or sideways. */
  'L': { kind: 'ledge', walkable: false, encounter: false },
  '^': { kind: 'rock', walkable: false, encounter: false },
  /** Cave floor: wild Pokémon appear here like in tall grass. */
  'c': { kind: 'cavefloor', walkable: true, encounter: true },
  'X': { kind: 'cavewall', walkable: false, encounter: false },
  'A': { kind: 'stairs', walkable: true, encounter: false },
  'H': { kind: 'shelf', walkable: false, encounter: false },
  'B': { kind: 'table', walkable: false, encounter: false },
  'K': { kind: 'bed', walkable: false, encounter: false },
}

const SOLID: TileInfo = { kind: 'tree', walkable: false, encounter: false }

export function tileInfo(char: string): TileInfo {
  return TILES[char] ?? SOLID
}
