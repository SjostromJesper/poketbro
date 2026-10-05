// Theme "Kenney" (Tiny Town + Tiny Dungeon, CC0): simple and clean 16x16. The buildings are put together from the modular roof and wall tiles;
// the characters are single poses (left is the mirrored right and walking bobs).
import type { BuildingSprite, CharacterDef, CharacterLayout, Ref, SpriteKey, ThemeManifest } from './types'

const town = (tx: number, ty: number): Ref => ({ sheet: 'town', tx, ty })
const dungeon = (tx: number, ty: number): Ref => ({ sheet: 'dungeon', tx, ty })

/** Orange tiled roof (two rows) on a grey stone wall with the door in the middle. */
const ORANGE: Ref[][] = [
  [town(4, 4), town(5, 4), town(5, 4), town(5, 4), town(6, 4)],
  [town(4, 5), town(5, 5), town(5, 5), town(5, 5), town(6, 5)],
  [town(4, 6), town(4, 7), town(6, 6), town(4, 7), town(4, 6)],
]
/** Grey slate roof on a brown wooden wall. */
const GREY: Ref[][] = [
  [town(0, 4), town(1, 4), town(1, 4), town(1, 4), town(2, 4)],
  [town(0, 5), town(1, 5), town(1, 5), town(1, 5), town(2, 5)],
  [town(0, 6), town(0, 7), town(2, 6), town(0, 7), town(0, 6)],
]
const house = (grid: Ref[][], badge?: 'cross' | 'bag' | 'dojo'): BuildingSprite => ({ grid, door: 2, ...(badge ? { badge } : {}) })

const SINGLE: CharacterLayout = { fw: 16, fh: 16, dir: 'rows', index: { down: 0, up: 0, left: 0, right: 0 }, stand: 0, cycle: [0], flipLeft: true, bob: true }
/** A character is one tile of the dungeon sheet. */
const character = (col: number, row: number): CharacterDef => ({
  sheet: '/assets/themes/kenney/tiles/dungeon.png',
  layout: { ...SINGLE, ox: col * 16, oy: row * 16 },
})

export const kenney: ThemeManifest = {
  id: 'kenney',
  name: 'Kenney',
  description: 'Enkel och ren 16x16-grafik (Tiny Town och Tiny Dungeon).',
  tileSize: 16,
  sheets: {
    town: { src: '/assets/themes/kenney/tiles/town.png', tileSize: 16, cols: 12, rows: 11 },
    dungeon: { src: '/assets/themes/kenney/tiles/dungeon.png', tileSize: 16, cols: 12, rows: 11 },
  },
  tiles: {
    ground: [town(0, 0), town(1, 0)],
    tallGrass: { frames: [town(5, 0), town(5, 0)] },
    path: { fill: town(4, 3), edge: '#b8905a' },
    water: { fill: { solid: '#4a8fe0' }, edge: '#2a5aa8' },
    trees: { kind: '1x2', variants: [town(4, 0), town(3, 0)], bushes: [town(5, 0)] },
    flowers: [[town(2, 0)]],
    fence: town(9, 6),
    sign: town(11, 6),
    floor: [dungeon(1, 4)],
    floorStone: [dungeon(4, 3)],
    counter: dungeon(0, 6),
    sand: town(4, 3),
    hedge: town(5, 0),
    buildings: {
      houseA: house(ORANGE),
      houseB: house(GREY),
      houseC: house(ORANGE),
      houseD: house(GREY),
      lab: house(ORANGE),
      center: house(ORANGE, 'cross'),
      mart: house(GREY, 'bag'),
      gym: house(GREY, 'dojo'),
    },
  },
  characters: {
    player: character(1, 7),
    player2: character(1, 9),
    rival: character(3, 7),
    professor: character(0, 7),
    nurse: character(3, 8),
    clerk: character(2, 7),
    mum: character(3, 8),
    old: character(4, 8),
    boy: character(4, 7),
    girl: character(1, 9),
    youngster: character(2, 8),
    lass: character(3, 8),
    bugcatcher: character(4, 9),
    hiker: character(3, 9),
    fisher: character(2, 9),
    sailor: character(1, 8),
    picnicker: character(1, 9),
    scientist: character(0, 7),
    karate: character(2, 7),
    psychic: character(4, 8),
    leader1: character(3, 7),
    leader2: character(0, 8),
    leader3: character(2, 9),
    leader4: character(4, 9),
  } satisfies Record<SpriteKey, CharacterDef>,
  credits: [
    {
      title: 'Tiny Town och Tiny Dungeon',
      by: 'Kenney (kenney.nl)',
      what: 'Temat "Kenney": mark, träd, byggnader, inredning och karaktärer.',
      license: 'CC0',
      url: 'https://kenney.nl',
    },
  ],
}
