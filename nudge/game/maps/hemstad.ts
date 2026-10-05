import type { MapDef } from '../types'

// Home town. The lab (right) is where the professor hands out the starter; the north road leads to Route 1.
export const hemstad: MapDef = {
  id: 'hemstad',
  name: 'Hemstad',
  music: 'hemstad',
  tiles: [
    '#########==#########',
    '#RRRRR...==..RRRRR.#',
    '#WWWWW...==..WWWWW.#',
    '#WWWWW...==..WWWWW.#',
    '#WWDWW...==..WWDWW.#',
    '#..=============...#',
    '#......S.==......o.#',
    '#.oo.....==.....o..#',
    '#....o...==......o.#',
    '#.ffffff....ffffff.#',
    '#......o....o......#',
    '#.o...........~~~~.#',
    '#.............~~~~.#',
    '####################',
  ],
  buildings: [
    { kind: 'houseA', x: 1, y: 1 },
    { kind: 'lab', x: 13, y: 1 },
  ],
  warps: [
    { x: 3, y: 4, to: 'hemhus', toX: 3, toY: 4, facing: 'up' },
    { x: 15, y: 4, to: 'proflab', toX: 4, toY: 6, facing: 'up' },
    {
      x: 9, y: 0, to: 'route1', toX: 6, toY: 30, facing: 'up', requires: 'starter',
      blockedDialog: ['Vänta! Det är farligt att gå ut i högt gräs utan en egen Pokémon.', 'Prata med professorn i labbet först!'],
    },
    {
      x: 10, y: 0, to: 'route1', toX: 7, toY: 30, facing: 'up', requires: 'starter',
      blockedDialog: ['Vänta! Det är farligt att gå ut i högt gräs utan en egen Pokémon.', 'Prata med professorn i labbet först!'],
    },
  ],
  npcs: [
    {
      id: 'hem-gubbe', x: 6, y: 7, facing: 'down', look: 'old',
      dialog: ['Hemstad är en lugn liten by. Här händer sällan något!'],
    },
    {
      id: 'hem-tjej', x: 11, y: 10, facing: 'up', look: 'girl',
      dialog: ['Professorns labb ligger i huset längst till höger.', 'Han brukar ha något åt nya tränare!'],
      dialogAfter: { flag: 'starter', lines: ['Grattis till din första Pokémon!', 'Vilda Pokémon gömmer sig i det höga gräset på Väg 1.'] },
    },
  ],
  trainers: [],
  signs: [{ x: 7, y: 6, text: ['HEMSTAD', 'Där äventyret börjar.'] }],
}
