import { mapBuilder } from '../mapBuilder'
import { trainer } from '../trainerClasses'
import { road, stairs } from './layout'

// Route 3: the coast. Sand and a long beach with the sea to the north, grass and palm-less pine trees to the south, and the cave exit in the west.
// Fishing works anywhere along the shore.
const m = mapBuilder('route3', 42, 30, { name: 'Väg 3', music: 'route1', encounterTable: 'route3', fishingTable: 'route3' })
m.border('tree', 2)
m.scatter(2, 2, 38, 26, 'tree', 36)
m.scatter(2, 12, 38, 16, 'flowers', 28)

// The sea to the north with a ragged sandy shore.
m.fill(2, 2, 38, 8, 'water')
m.blob(21, 11, 20, 2, 'sand', { roughness: 0.5 })
m.blob(8, 8, 6, 3, 'water', { roughness: 0.4 }) // coves
m.blob(33, 8, 6, 3, 'water', { roughness: 0.4 })
m.fill(2, 10, 38, 1, 'sand')
m.scatter(2, 9, 38, 4, 'sand', 40, { onlyOn: '.#' })

// The road along the beach.
m.path([[3, 16], [10, 16], [10, 14], [24, 14], [24, 20], [40, 20]], { width: 2, wobble: 0.15 })
m.blob(14, 22, 5, 3, 'grass', { roughness: 0.3, onlyOn: '.#o' })
m.blob(30, 25, 5, 3, 'grass', { roughness: 0.3, onlyOn: '.#o' })
m.blob(18, 18, 3, 2, 'grass', { roughness: 0.3, onlyOn: '.#o' })
m.blob(6, 24, 3, 2, 'grass', { roughness: 0.3, onlyOn: '.#o' })
m.blob(37, 16, 2, 3, 'grass', { roughness: 0.3, onlyOn: '.#o' })
road(m, 'e', 20, 'hamn', 22)

// The cave mouth in the west.
m.fill(0, 12, 7, 6, 'rock')
m.fill(2, 15, 3, 1, 'ground')
m.fill(3, 16, 4, 2, 'path')
stairs(m, 3, 15, 'manberget_1', 29, 10)

m.pickup({ id: 'r3-ball', x: 20, y: 9, item: 'poke-ball', hidden: true })
m.pickup({ id: 'r3-potion', x: 16, y: 25, item: 'super-potion' })
m.pickup({ id: 'r3-pearl', x: 36, y: 18, item: 'great-ball', hidden: true })
m.sign(8, 17, ['VÄG 3', 'Kusten. Hamnstad österut. Fiska gärna: ställ dig vid vattnet.'])
m.npc({
  id: 'r3-fiskare', x: 12, y: 11, facing: 'up', look: 'old', name: 'Gammal fiskare', action: 'give',
  dialog: ['Fisket är inte vad det varit. Här, ta mitt gamla spö!', 'Ställ dig vid vattnet och tryck på handlingsknappen. Det kanske nappar!'],
  dialogAfter: { flag: 'old-rod', lines: ['Tålamod är en fiskares bästa vän.'] },
  give: { flag: 'old-rod', items: [{ item: 'old-rod', count: 1 }] },
})
m.npc({
  id: 'r3-turist', x: 28, y: 16, facing: 'left', look: 'girl',
  dialog: ['Jag älskar havet! Titta på alla vågor!', 'Man kan hitta riktiga skatter på stranden om man gräver.'],
})
m.trainer(trainer('r3-folke', 'Folke', 'fisher', { x: 17, y: 11, facing: 'auto' }, [[129, 13], [129, 14], [118, 15]]))
m.trainer(trainer('r3-sigrid', 'Sigrid', 'swimmer', { x: 28, y: 11, facing: 'auto' }, [[54, 15], [72, 15]], { sprite: 'lass' }))
m.trainer(trainer('r3-tore', 'Tore', 'sailor', { x: 18, y: 15, facing: 'auto' }, [[98, 14], [98, 15], [66, 15]]))
m.trainer(trainer('r3-malin', 'Malin', 'picnicker', { x: 14, y: 19, facing: 'auto' }, [[69, 15], [69, 14], [70, 16]]))
m.trainer(trainer('r3-axel', 'Axel', 'youngster', { x: 26, y: 18, facing: 'auto' }, [[52, 16], [19, 15], [20, 17]]))
m.trainer(trainer('r3-saga', 'Saga', 'lass', { x: 33, y: 23, facing: 'auto' }, [[27, 15], [28, 17]]))
m.trainer(trainer('r3-benny', 'Benny', 'fisher', { x: 36, y: 12, facing: 'auto' }, [[72, 14], [60, 14], [118, 16]]))

export const route3 = m.build()
