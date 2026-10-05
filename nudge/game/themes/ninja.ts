// Theme "Ninja Adventure" (pixel-boy and AAA, CC0): 16x16, bright and chunky. The first theme of the game, kept for comparison.
import type { CharacterDef, CharacterLayout, SpriteKey, ThemeManifest } from './types'

const T = '/assets/themes/ninja/tiles'
const sheet = (name: string, cols: number, rows: number) => ({ src: `${T}/${name}.png`, tileSize: 16, cols, rows })
const at = (sheetId: string, tx: number, ty: number, w?: number, h?: number) => ({ sheet: sheetId, tx, ty, ...(w ? { w } : {}), ...(h ? { h } : {}) })
const house = (tx: number, ty: number, w: number, h: number, door: number, badge?: 'cross' | 'bag' | 'dojo') => ({ ref: { sheet: 'house', tx, ty, w, h }, door, ...(badge ? { badge } : {}) })

const FULL: CharacterLayout = { fw: 16, fh: 16, dir: 'cols', index: { down: 0, up: 1, left: 2, right: 3 }, stand: 0, cycle: [0, 1, 2, 3] }
const SMALL: CharacterLayout = { ...FULL, cycle: [0, 1] }

/** Character folder name -> sheet and face. Two sheets (Child, OldWoman) have only two frames. */
const character = (name: string, layout = FULL): CharacterDef => ({
  sheet: `/assets/themes/ninja/characters/${name}.png`,
  layout,
  face: `/assets/themes/ninja/faces/${name}.png`,
})

export const ninja: ThemeManifest = {
  id: 'ninja',
  name: 'Ninja Adventure',
  description: 'Ljus och rund 16x16-grafik (pixel-boy). Det första temat i spelet.',
  tileSize: 16,
  sheets: {
    floor: sheet('floor', 22, 26),
    nature: sheet('nature', 24, 21),
    house: sheet('house', 33, 23),
    water: sheet('water', 28, 17),
    interiorFloor: sheet('interior-floor', 22, 17),
    ripples: sheet('ripples', 4, 1),
    plant: sheet('plant', 4, 1),
  },
  tiles: {
    ground: [at('floor', 0, 12), at('floor', 1, 12), at('floor', 2, 12), at('floor', 3, 12), at('floor', 4, 12), at('floor', 2, 11), at('floor', 3, 11)],
    tallGrass: { frames: [at('nature', 4, 10), at('nature', 5, 10)] },
    path: { origin: at('floor', 0, 7), strips: true },
    water: { origin: at('water', 0, 6), strips: true },
    ripples: [0, 1, 2, 3].map(i => at('ripples', i, 0)),
    trees: { kind: '2x2', variants: [at('nature', 0, 0), at('nature', 2, 0)], bushes: [at('nature', 0, 10), at('nature', 1, 10), at('nature', 2, 10)] },
    flowers: [[0, 1, 2, 3].map(i => at('plant', i, 0)), [at('nature', 0, 11)], [at('nature', 3, 11)]],
    fence: at('house', 10, 5),
    sign: at('house', 3, 3),
    floor: [at('interiorFloor', 1, 1)],
    floorStone: [at('interiorFloor', 12, 7)],
    counter: at('house', 18, 18),
    hedge: at('nature', 1, 10),
    buildings: {
      houseA: house(0, 0, 4, 3, 1),
      houseB: house(4, 0, 4, 3, 1),
      houseC: house(8, 0, 4, 3, 1),
      houseD: house(12, 0, 4, 3, 1),
      lab: house(26, 0, 3, 3, 1),
      center: house(23, 0, 3, 3, 1, 'cross'),
      mart: house(16, 0, 3, 3, 1, 'bag'),
      gym: house(19, 0, 4, 3, 2, 'dojo'),
    },
  },
  characters: {
    player: character('Boy'),
    rival: character('Inspector'),
    professor: character('Master'),
    nurse: character('Princess'),
    clerk: character('Noble'),
    mum: character('Villager4'),
    old: character('OldMan'),
    boy: character('Villager'),
    girl: character('Woman'),
    youngster: character('Villager3'),
    lass: character('EggGirl'),
    bugcatcher: character('Child', SMALL),
    hiker: character('Hunter'),
    fisher: character('EggBoy'),
    sailor: character('Villager2'),
    picnicker: character('Villager5'),
    scientist: character('OldWoman', SMALL),
    karate: character('SamuraiBlue'),
    psychic: character('Monk'),
    leader1: character('KnightGold'),
    leader2: character('Samurai'),
    leader3: character('Knight'),
    leader4: character('OldMan2'),
  } satisfies Record<SpriteKey, CharacterDef>,
  credits: [
    {
      title: 'Ninja Adventure Asset Pack',
      by: 'pixel-boy och AAA',
      what: 'Temat "Ninja Adventure": marker, träd, hus, vatten, golv, karaktärer och porträtt. Paketet ger också några ljudeffekter, jinglar och en del av musiken.',
      license: 'CC0',
      url: 'https://pixel-boy.itch.io/ninja-adventure-asset-pack',
    },
  ],
}
