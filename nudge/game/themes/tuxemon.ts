// Theme "Tuxemon" (default): 16x16 Game Boy Advance style art from the open source monster game Tuxemon. Mostly CC-BY-SA 4.0 / CC BY 3.0:
// attribution is required, see the credits screen and public/assets/themes/tuxemon/ATTRIBUTIONS.md.
import type { CharacterDef, CharacterLayout, SpriteKey, ThemeManifest } from './types'

const T = '/assets/themes/tuxemon/tiles'
const sheet = (name: string, cols: number, rows: number) => ({ src: `${T}/${name}.png`, tileSize: 16, cols, rows })
const at = (sheetId: string, tx: number, ty: number, w?: number, h?: number) => ({ sheet: sheetId, tx, ty, ...(w ? { w } : {}), ...(h ? { h } : {}) })
const building = (tx: number, ty: number, w: number, h: number, door: number, badge?: 'cross' | 'bag' | 'dojo') => ({ ref: { sheet: 'kelvin', tx, ty, w, h }, door, ...(badge ? { badge } : {}) })

/** 16x32 sprites, three frames across (standing, step, step) and one row per direction (down, left, right, up). */
const LAYOUT: CharacterLayout = { fw: 16, fh: 32, dir: 'rows', index: { down: 0, left: 1, right: 2, up: 3 }, stand: 0, cycle: [1, 0, 2, 0] }
const character = (name: string): CharacterDef => ({ sheet: `/assets/themes/tuxemon/characters/${name}.png`, layout: LAYOUT })

export const tuxemon: ThemeManifest = {
  id: 'tuxemon',
  name: 'Tuxemon',
  description: 'Klassisk Game Boy Advance-känsla, 16x16. Standardtemat.',
  tileSize: 16,
  sheets: {
    outdoor: sheet('outdoor', 16, 16),
    buch: sheet('buch', 32, 14),
    vegetation: sheet('vegetation', 15, 4),
    kelvin: sheet('kelvin', 20, 25),
    floors: sheet('floors', 9, 6),
  },
  tiles: {
    ground: [at('outdoor', 0, 0), at('outdoor', 1, 0), at('outdoor', 0, 1), at('outdoor', 1, 1)],
    tallGrass: { frames: [at('outdoor', 9, 0), at('outdoor', 10, 0)] },
    path: { fill: at('outdoor', 2, 0), edge: '#7a4a26' },
    water: { fill: at('buch', 0, 8), edge: '#2a3a8a' },
    ripples: [1, 2, 3].map(i => at('buch', i, 8)),
    trees: { kind: '2x2', variants: [at('vegetation', 0, 0), at('vegetation', 6, 0)], bushes: [at('vegetation', 2, 1)] },
    flowers: [[at('kelvin', 9, 0)], [at('kelvin', 10, 0)], [at('kelvin', 11, 0)], [at('kelvin', 7, 0)], [at('kelvin', 14, 0)]],
    fence: at('buch', 2, 9),
    sign: at('kelvin', 6, 4),
    floor: [at('floors', 1, 1)],
    floorStone: [at('floors', 7, 1)],
    counter: at('kelvin', 2, 2),
    hedge: at('vegetation', 2, 1),
    buildings: {
      houseA: building(0, 9, 4, 4, 2),
      houseB: building(0, 17, 5, 4, 2),
      houseC: building(0, 9, 4, 4, 2),
      houseD: building(0, 17, 5, 4, 2),
      lab: building(0, 13, 5, 4, 2),
      // The Pokémon Center and Mart sprites show a red cross and a blue roof, the gym is the dark building.
      center: building(0, 5, 5, 4, 2),
      mart: building(5, 5, 5, 4, 2),
      gym: building(5, 13, 5, 4, 2, 'dojo'),
    },
  },
  characters: {
    player: character('adventurer'),
    rival: character('cooldude'),
    professor: character('scientist'),
    nurse: character('nurse'),
    clerk: character('shopassistant'),
    mum: character('homemaker'),
    old: character('maniac'),
    boy: character('postboy'),
    girl: character('girl1'),
    youngster: character('childactor'),
    lass: character('heroine'),
    bugcatcher: character('miner'),
    hiker: character('soldier'),
    fisher: character('fisher'),
    sailor: character('riverboatcaptain'),
    picnicker: character('picnicker'),
    scientist: character('professor'),
    karate: character('boss'),
    psychic: character('disciple'),
    leader1: character('knightlord'),
    leader2: character('swimmer'),
    leader3: character('dragonrider'),
    leader4: character('florist'),
  } satisfies Record<SpriteKey, CharacterDef>,
  credits: [
    {
      title: 'Tuxemon',
      by: 'Tuxemon-projektet och dess grafiker (bl.a. Kelvin Shadewing, Buch, George_, ArMM1998, Mike Bramson, Sanglorian, Leo)',
      what: 'Temat "Tuxemon": mark, träd, vatten, byggnader, inredning och karaktärer. Grafiken är hämtad från repositoryt Tuxemon/Tuxemon (grafikmapparna).',
      license: 'Mest CC-BY-SA 4.0 och CC BY 3.0/4.0, en del public domain. Ändringar: urklippta delar av filerna. Hela attributionslistan finns i /assets/themes/tuxemon/ATTRIBUTIONS.md.',
      url: 'https://github.com/Tuxemon/Tuxemon',
      attribution: true,
    },
  ],
}
