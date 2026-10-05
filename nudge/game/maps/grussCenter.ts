import type { MapDef } from '../types'

export const grussCenter: MapDef = {
  id: 'gruss_center',
  name: 'Pokémon Center',
  music: 'center',
  indoor: true,
  tiles: [
    '##########',
    '#FFFFFFFT#',
    '#FFFFFFFF#',
    '#FFTTTTFF#',
    '#FFFFFFFF#',
    '#FFFFFFFF#',
    '#FFFFFFFF#',
    '####M#####',
  ],
  warps: [{ x: 4, y: 7, to: 'gruss', toX: 5, toY: 7, facing: 'down' }],
  npcs: [
    {
      id: 'sjukskoterska', x: 4, y: 2, facing: 'down', look: 'nurse', action: 'heal', name: 'Sjuksköterska',
      dialog: ['Välkommen till Pokémon Center! Ska jag ta hand om dina Pokémon?', 'Klart! Dina Pokémon är friska igen. Välkommen åter!'],
    },
    {
      id: 'resekarta', x: 2, y: 1, facing: 'down', look: 'pc', action: 'travel', name: 'Resekarta',
      dialog: ['Snabbresekartan visar alla Pokémon Center du har besökt.'],
    },
    {
      id: 'pc', x: 7, y: 1, facing: 'down', look: 'pc', action: 'pc', name: 'PC',
      dialog: ['Du loggade in på Pokémon-lagringen.'],
    },
  ],
  trainers: [],
  signs: [],
}
