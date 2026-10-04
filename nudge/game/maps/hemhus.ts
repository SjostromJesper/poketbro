import type { MapDef } from '../types'

export const hemhus: MapDef = {
  id: 'hemhus',
  name: 'Ditt hem',
  music: 'home',
  indoor: true,
  tiles: [
    '########',
    '#TTTTTF#',
    '#FFFFFF#',
    '#FFFFTF#',
    '#FFFFFF#',
    '###M####',
  ],
  warps: [{ x: 3, y: 5, to: 'hemstad', toX: 3, toY: 5, facing: 'down' }],
  npcs: [
    {
      id: 'hem-mamma', x: 3, y: 2, facing: 'down', look: 'mum', action: 'heal',
      dialog: ['Hej, min vän! Du ser trött ut. Vila lite!', 'Där! Dina Pokémon mår som nya.'],
    },
  ],
  trainers: [],
  signs: [],
}
