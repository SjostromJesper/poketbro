import { mapBuilder } from '../mapBuilder'
import { trainer } from '../trainerClasses'
import { stairs } from './layout'

// Moon Mountain: a cave through the mountain. 1F is the way through (Route 2 in the south, Route 3 in the north-east); 2F and 3F are
// optional detours with items, trainers and an old fossil to take home.
const cave = (id: string, w: number, h: number, name: string) => {
  const m = mapBuilder(id, w, h, { name, music: 'cave', encounterTable: 'manberget', base: 'cavewall', ground: 'cave' })
  return m
}

// ---- 1F
const f1 = cave('manberget_1', 32, 26, 'Månberget 1V')
f1.path([[17, 24], [17, 18]], { width: 2, tile: 'cave' })
f1.blob(17, 15, 7, 4, 'cave', { roughness: 0.3 })
f1.path([[17, 15], [6, 15], [6, 7]], { width: 2, tile: 'cave', wobble: 0.2 })
f1.blob(7, 8, 4, 3, 'cave', { roughness: 0.3 })
f1.path([[17, 15], [26, 15], [26, 10], [29, 10]], { width: 2, tile: 'cave', wobble: 0.2 })
f1.blob(26, 18, 3, 3, 'cave', { roughness: 0.4 })
f1.blob(11, 21, 3, 2, 'cave', { roughness: 0.4 })
f1.fill(21, 13, 5, 2, 'cave')
f1.path([[11, 21], [17, 21]], { width: 1, tile: 'cave' })
f1.scatter(2, 2, 28, 22, 'cavewall', 24, { onlyOn: 'c' })
stairs(f1, 17, 24, 'route2', 31, 9)
stairs(f1, 29, 9, 'route3', 3, 16)
f1.fill(6, 7, 1, 1, 'cave')
stairs(f1, 6, 6, 'manberget_2', 6, 7)
f1.pickup({ id: 'mb1-potion', x: 11, y: 22, item: 'potion' })
f1.pickup({ id: 'mb1-ball', x: 27, y: 19, item: 'poke-ball', hidden: true })
f1.pickup({ id: 'mb1-antidote', x: 8, y: 9, item: 'antidote' })
f1.sign(16, 22, ['MÅNBERGET', 'Trappan i väster leder upp till de övre våningarna.'])
f1.trainer(trainer('mb1-ragnar', 'Ragnar', 'hiker', { x: 17, y: 20, facing: 'auto', sight: 4 }, [[74, 11], [74, 12]]))
f1.trainer(trainer('mb1-olof', 'Olof', 'bugcatcher', { x: 12, y: 15, facing: 'auto', sight: 4 }, [[41, 11], [46, 12]]))
f1.trainer(trainer('mb1-torsten', 'Torsten', 'hiker', { x: 24, y: 13, facing: 'auto', sight: 4 }, [[74, 12], [66, 12], [74, 13]]))
f1.trainer(trainer('mb1-vera', 'Vera', 'lass', { x: 27, y: 10, facing: 'auto', sight: 4 }, [[35, 13], [39, 13]]))

// ---- 2F
const f2 = cave('manberget_2', 28, 22, 'Månberget 2V')
f2.blob(7, 8, 4, 3, 'cave', { roughness: 0.3 })
f2.path([[7, 9], [7, 15], [20, 15], [20, 8], [21, 7]], { width: 2, tile: 'cave', wobble: 0.15 })
f2.blob(14, 17, 5, 3, 'cave', { roughness: 0.3 })
f2.blob(22, 6, 3, 3, 'cave', { roughness: 0.3 })
f2.scatter(2, 2, 24, 18, 'cavewall', 14, { onlyOn: 'c' })
f2.fill(6, 7, 1, 1, 'cave')
stairs(f2, 6, 6, 'manberget_1', 6, 7)
f2.fill(21, 4, 3, 2, 'cave')
stairs(f2, 22, 4, 'manberget_3', 4, 5)
f2.pickup({ id: 'mb2-potion', x: 15, y: 18, item: 'super-potion' })
f2.pickup({ id: 'mb2-moon', x: 24, y: 7, item: 'moon-stone', hidden: true })
f2.pickup({ id: 'mb2-ball', x: 8, y: 11, item: 'great-ball' })
f2.trainer(trainer('mb2-lage', 'Lage', 'scientist', { x: 13, y: 15, facing: 'auto', sight: 4 }, [[81, 12], [81, 12], [100, 13]]))
f2.trainer(trainer('mb2-greta', 'Greta', 'hiker', { x: 20, y: 11, facing: 'auto', sight: 4 }, [[74, 13], [75, 13]]))
f2.trainer(trainer('mb2-ivar', 'Ivar', 'bugcatcher', { x: 8, y: 14, facing: 'auto', sight: 4 }, [[41, 12], [42, 13], [46, 13]]))

// ---- 3F: a quiet top floor with the fossil researcher
const f3 = cave('manberget_3', 24, 20, 'Månberget 3V')
f3.blob(5, 5, 3, 3, 'cave', { roughness: 0.2 })
f3.path([[5, 6], [5, 12], [16, 12]], { width: 2, tile: 'cave' })
f3.blob(17, 12, 4, 3, 'cave', { roughness: 0.2 })
f3.fill(3, 5, 3, 1, 'cave')
stairs(f3, 4, 4, 'manberget_2', 22, 5)
f3.pickup({ id: 'mb3-hyper', x: 6, y: 5, item: 'hyper-potion', hidden: true })
f3.npc({
  id: 'fossil-forskare', x: 18, y: 12, facing: 'left', look: 'professor', name: 'Fossilforskaren', action: 'give',
  dialog: [
    'Hej! Jag har grävt här i veckor. Jag hittade två fossil!',
    'Jag kan inte ta hand om båda. Du får välja ett, så väcker jag det till liv åt dig.',
  ],
  dialogAfter: { flag: 'fossil', lines: ['Fossil är ett fönster till en annan tid. Ta hand om din!'] },
  give: { flag: 'fossil', pokemon: [{ speciesId: 138, level: 12 }, { speciesId: 140, level: 12 }] },
})
f3.trainer(trainer('mb3-bertil', 'Bertil', 'scientist', { x: 10, y: 12, facing: 'auto', sight: 5 }, [[88, 14], [109, 14]]))

export const manbergetMaps = [f1.build(), f2.build(), f3.build()]
