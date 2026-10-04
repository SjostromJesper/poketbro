import type { MapDef } from '../types'

export const grussGym: MapDef = {
  id: 'gruss_gym',
  name: 'Grusstads gym',
  indoor: true,
  tiles: [
    '############',
    '#FFFFFFFFFF#',
    '#FFFFFFFFFF#',
    '#FFFFFFFFFF#',
    '#FFFFFFFFFF#',
    '#FFTTFFTTFF#',
    '#FFFFFFFFFF#',
    '#FFFFFFFFFF#',
    '#FFFFFFFFFF#',
    '#FFTTFFTTFF#',
    '#FFFFFFFFFF#',
    '#FFFFFFFFFF#',
    '#FFFFFFFFFF#',
    '#####M######',
  ],
  warps: [{ x: 5, y: 13, to: 'gruss', toX: 11, toY: 5, facing: 'down' }],
  npcs: [],
  // Granit (leader) stands at the back and only fights when spoken to: he is a trainer entry with sight 0.
  trainers: [
    { id: 'gym-granit', x: 5, y: 2, facing: 'down', sight: 0 },
    { id: 'gym-tor', x: 9, y: 7, facing: 'left', sight: 5 },
    { id: 'gym-sofia', x: 2, y: 11, facing: 'right', sight: 6 },
  ],
  signs: [],
}
