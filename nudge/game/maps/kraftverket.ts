import { mapBuilder } from '../mapBuilder'
import { trainer } from '../trainerClasses'
import { linkStairs, stairs } from './layout'

// The power plant: an old cave full of humming machines. 1F leads past a few scientists to the stairs up; 2F is a dead end with the best
// items (including a Thunder Stone) and Electabuzz in the grass-like floor. Optional: Sparkby can be reached without it.
const plant = (id: string, w: number, h: number, name: string) =>
  mapBuilder(id, w, h, { name, music: 'power', encounterTable: 'kraftverket', base: 'cavewall', ground: 'cave' })

// ---- 1F
const f1 = plant('kraftverket_1', 30, 24, 'Kraftverket 1V')
f1.path([[15, 21], [15, 16]], { width: 2, tile: 'cave' })
f1.blob(15, 13, 8, 4, 'cave', { roughness: 0.3 })
f1.path([[15, 13], [6, 13], [6, 8]], { width: 2, tile: 'cave', wobble: 0.15 })
f1.blob(7, 6, 4, 3, 'cave', { roughness: 0.3 })
f1.path([[15, 13], [24, 13], [24, 8]], { width: 2, tile: 'cave', wobble: 0.15 })
f1.blob(24, 6, 3, 3, 'cave', { roughness: 0.3 })
f1.blob(5, 19, 3, 2, 'cave', { roughness: 0.4 })
f1.path([[5, 19], [15, 19]], { width: 1, tile: 'cave' })
f1.scatter(2, 2, 26, 20, 'cavewall', 22, { onlyOn: 'c' })
stairs(f1, 15, 22, 'route4', 7, 8)
f1.fill(15, 21, 2, 1, 'cave')
f1.sign(13, 20, ['KRAFTVERKET', 'Fara! Hög spänning. Trappan upp ligger i nordöst.'])
f1.pickup({ id: 'kv1-potion', x: 5, y: 20, item: 'super-potion' })
f1.pickup({ id: 'kv1-ball', x: 7, y: 5, item: 'great-ball' })
f1.pickup({ id: 'kv1-paralyze', x: 25, y: 6, item: 'paralyze-heal', hidden: true })
f1.trainer(trainer('kv1-ulf', 'Ulf', 'scientist', { x: 15, y: 17, facing: 'auto', sight: 4 }, [[81, 18], [100, 18], [81, 19]]))
f1.trainer(trainer('kv1-agda', 'Agda', 'scientist', { x: 10, y: 13, facing: 'auto', sight: 4 }, [[88, 19], [109, 19], [100, 20]]))
f1.trainer(trainer('kv1-bo', 'Bo', 'youngster', { x: 6, y: 10, facing: 'auto', sight: 4 }, [[25, 19], [81, 19], [25, 20]]))
f1.trainer(trainer('kv1-linn', 'Linn', 'lass', { x: 20, y: 13, facing: 'auto', sight: 4 }, [[100, 19], [100, 19], [101, 21]]))
f1.trainer(trainer('kv1-ove', 'Ove', 'hiker', { x: 23, y: 6, facing: 'auto', sight: 4 }, [[74, 19], [75, 20], [95, 20]]))

// ---- 2F
const f2 = plant('kraftverket_2', 26, 20, 'Kraftverket 2V')
f2.blob(4, 15, 3, 3, 'cave', { roughness: 0.2 })
f2.path([[4, 15], [4, 10], [18, 10]], { width: 2, tile: 'cave', wobble: 0.15 })
f2.blob(19, 9, 4, 3, 'cave', { roughness: 0.3 })
f2.path([[19, 10], [19, 14], [10, 14]], { width: 2, tile: 'cave' })
f2.blob(9, 15, 3, 2, 'cave', { roughness: 0.3 })
f2.scatter(2, 2, 22, 16, 'cavewall', 10, { onlyOn: 'c' })
linkStairs(f1, 24, 4, f2, 4, 13)
f2.pickup({ id: 'kv2-thunder', x: 20, y: 7, item: 'thunder-stone', hidden: true })
f2.pickup({ id: 'kv2-hyper', x: 9, y: 16, item: 'hyper-potion' })
f2.pickup({ id: 'kv2-tm', x: 22, y: 10, item: 'tm:thunder-wave' })
f2.trainer(trainer('kv2-lena', 'Lena', 'scientist', { x: 10, y: 10, facing: 'auto', sight: 5 }, [[82, 20], [101, 21], [82, 21]]))
f2.trainer(trainer('kv2-gustav', 'Gustav', 'hiker', { x: 19, y: 12, facing: 'auto', sight: 4 }, [[75, 21], [95, 22], [74, 21]]))
f2.npc({
  id: 'kv2-ingenjor', x: 12, y: 15, facing: 'right', look: 'professor', name: 'Ingenjören',
  dialog: ['Generatorn här nere är gammal. Den matar hela Gnistby!', 'Se upp med Elekid... ja, jag menar Electabuzz. De tycker om elektriciteten lite för mycket.'],
})

export const kraftverketMaps = [f1.build(), f2.build()]
