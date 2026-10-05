// Theme "Pipoya" (32x32): detailed, rural JRPG look. Pipoya's files may be used freely but must NOT be redistributed, so
// public/assets/themes/pipoya/ is gitignored: the files are copied locally by `npm run copy-graphics` (after `npm run fetch-assets`).
// Without them the theme falls back to placeholders. The houses are painted with canvas (the tileset has no small houses).
import type { BuildingSprite, CharacterDef, CharacterLayout, HousePaint, Ref, SpriteKey, ThemeManifest } from './types'

const T = '/assets/themes/pipoya/tiles'
const sheet = (name: string, cols: number, rows: number) => ({ src: `${T}/${name}.png`, tileSize: 32, cols, rows })
const at = (sheetId: string, tx: number, ty: number): Ref => ({ sheet: sheetId, tx, ty })
const house = (paint: HousePaint, badge?: 'cross' | 'bag' | 'dojo'): BuildingSprite => ({ paint, w: 5, h: 4, door: 2, ...(badge ? { badge } : {}) })

/** 32x32 frames: rows down, left, right, up; three frames across with the standing one in the middle. */
const LAYOUT: CharacterLayout = { fw: 32, fh: 32, dir: 'rows', index: { down: 0, left: 1, right: 2, up: 3 }, stand: 1, cycle: [0, 1, 2, 1] }
const character = (key: SpriteKey): CharacterDef => ({ sheet: `/assets/themes/pipoya/characters/${key}.png`, layout: LAYOUT })

export const pipoya: ThemeManifest = {
  id: 'pipoya',
  name: 'Pipoya',
  description: 'Detaljerad 32x32-grafik i klassisk JRPG-stil (lokala filer, delas inte vidare).',
  tileSize: 32,
  sheets: {
    base: sheet('base', 8, 133),
    water: sheet('water', 8, 5),
    grass: sheet('grass', 1, 5),
    longgrass: sheet('longgrass', 1, 5),
    dirt: sheet('dirt', 1, 5),
    flower: sheet('flower', 1, 5),
  },
  tiles: {
    ground: [at('grass', 0, 4)],
    tallGrass: { frames: [at('longgrass', 0, 4), at('longgrass', 0, 3)] },
    path: { fill: at('dirt', 0, 4), edge: '#b0a060' },
    water: { fill: at('water', 0, 4), edge: '#2a4a7a' },
    ripples: [1, 2, 3].map(i => at('water', i, 4)),
    trees: { kind: '2x2', variants: [at('base', 0, 1), at('base', 2, 1)], bushes: [at('base', 0, 5), at('base', 1, 5)] },
    flowers: [[at('flower', 0, 4)], [at('flower', 0, 3)]],
    fence: at('base', 6, 22),
    sign: at('base', 3, 29),
    floor: [at('base', 0, 36)],
    floorStone: [at('base', 3, 37)],
    counter: at('base', 1, 28),
    sand: at('dirt', 0, 4),
    hedge: at('base', 0, 5),
    buildings: {
      houseA: house({ roof: '#b8503c', wall: '#e8d8b0', trim: '#6a4a2a' }),
      houseB: house({ roof: '#4a6ab0', wall: '#e8d8b0', trim: '#4a3a2a' }),
      houseC: house({ roof: '#5a8a3a', wall: '#f0e4c8', trim: '#6a4a2a' }),
      houseD: house({ roof: '#8a5a3a', wall: '#e0d0b0', trim: '#4a3a2a' }),
      lab: house({ roof: '#c8c8d0', wall: '#f4f4f4', trim: '#5a6a7a' }),
      center: house({ roof: '#e07088', wall: '#f8f0e8', trim: '#8a4a5a' }, 'cross'),
      mart: house({ roof: '#3a7ad8', wall: '#e8e8f0', trim: '#2a4a7a' }, 'bag'),
      gym: house({ roof: '#4a4a58', wall: '#8a8a98', trim: '#2a2a34' }, 'dojo'),
    },
  },
  characters: Object.fromEntries((['player', 'rival', 'professor', 'nurse', 'clerk', 'mum', 'old', 'boy', 'girl', 'youngster', 'lass', 'bugcatcher', 'hiker', 'fisher', 'sailor', 'picnicker', 'scientist', 'karate', 'psychic', 'leader1', 'leader2', 'leader3', 'leader4'] as const).map(key => [key, character(key)])) as Record<SpriteKey, CharacterDef>,
  credits: [
    {
      title: 'Pipoya FREE RPG Tileset 32x32 och Character Sprites 32x32',
      by: 'Pipoya',
      what: 'Temat "Pipoya": gräs, vatten, träd, stigar och karaktärer. Filerna får användas fritt men inte delas vidare, så de ligger bara lokalt.',
      license: 'Fri användning, får redigeras, får inte vidaredistribueras',
      url: 'https://pipoya.itch.io/pipoya-rpg-tileset-32x32',
    },
  ],
}
