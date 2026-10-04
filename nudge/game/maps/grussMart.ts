import type { MapDef } from '../types'

export const grussMart: MapDef = {
  id: 'gruss_mart',
  name: 'Pokémart',
  indoor: true,
  tiles: [
    '##########',
    '#TTFFFFTT#',
    '#FFFFFFFF#',
    '#FFTTTTFF#',
    '#FFFFFFFF#',
    '#FFFFFFFF#',
    '#FFFFFFFF#',
    '####M#####',
  ],
  warps: [{ x: 4, y: 7, to: 'gruss', toX: 18, toY: 7, facing: 'down' }],
  npcs: [
    {
      id: 'expedit', x: 4, y: 2, facing: 'down', look: 'clerk', action: 'shop', name: 'Expedit',
      dialog: ['Välkommen! Vad kan jag hjälpa dig med?'],
    },
  ],
  trainers: [],
  signs: [],
}
