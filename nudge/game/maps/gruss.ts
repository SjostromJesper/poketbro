import type { MapDef } from '../types'

// Gravel Town: Pokémon Center (left), Mart (right) and the rock-type gym (top).
export const gruss: MapDef = {
  id: 'gruss',
  name: 'Grusstad',
  tiles: [
    '########################',
    '#........RRRRRR........#',
    '#........RRRRRR.......##',
    '#..RRRRR.WWWWWW.RRRRR..#',
    '#..RRRRR.WWDWWW.RRRRR..#',
    '#..WWWWW...==...WWWWW..#',
    '#..WWDWW...==...WWDWW..#',
    '#....=.....==.....=....#',
    '#....=..o..==..o..=....#',
    '#....=.....==.....=....#',
    '#..==================..#',
    '#........S.............#',
    '##.........==.........##',
    '#.oo....o..==..o....o..#',
    '#..........==..........#',
    '#.ffffff...==..ffffff..#',
    '#........o.==..........#',
    '#.o........==....~~~~o.#',
    '##.........==....~~~~..#',
    '###########==###########',
  ],
  warps: [
    { x: 11, y: 19, to: 'skogen', toX: 11, toY: 1, facing: 'down' },
    { x: 12, y: 19, to: 'skogen', toX: 12, toY: 1, facing: 'down' },
    { x: 11, y: 4, to: 'gruss_gym', toX: 5, toY: 12, facing: 'up' },
    { x: 5, y: 6, to: 'gruss_center', toX: 4, toY: 6, facing: 'up' },
    { x: 18, y: 6, to: 'gruss_mart', toX: 4, toY: 6, facing: 'up' },
  ],
  npcs: [
    {
      id: 'gruss-pojke', x: 14, y: 12, facing: 'left', look: 'boy',
      dialog: ['Granit är gymledare här. Hans Pokémon är hårda som sten!', 'Vatten och gräs brukar fungera bra mot honom.'],
    },
    {
      id: 'gruss-tjej', x: 6, y: 14, facing: 'down', look: 'girl',
      dialog: ['Pokémon Center läker alla dina Pokémon gratis!', 'Prata med sjuksköterskan vid disken.'],
    },
  ],
  trainers: [],
  signs: [{ x: 9, y: 11, text: ['GRUSSTAD', 'Stenig stad. Gym: Ledare Granit.'] }],
}
