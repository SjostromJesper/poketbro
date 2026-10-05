import { mapBuilder } from '../mapBuilder'
import { trainer } from '../trainerClasses'
import { road, stairs } from './layout'

// Route 5: the mountain road north of Sparkby. A switchback path with ledges to jump down, boulders, patches of tall grass and the old
// ghost tower on the east side (an optional dungeon).
const m = mapBuilder('route5', 32, 42, { name: 'Väg 5', music: 'route1', encounterTable: 'route5' })
m.border('tree', 2)
m.scatter(2, 2, 28, 38, 'tree', 50)
m.scatter(2, 2, 28, 38, 'flowers', 16)

m.path([[14, 40], [14, 34], [24, 34], [24, 26], [8, 26], [8, 18], [22, 18], [22, 10], [14, 10], [14, 1]], { width: 2, wobble: 0.12 })
road(m, 's', 14, 'gnistby', 16)
road(m, 'n', 14, 'route6', 8)

m.blob(20, 38, 4, 2, 'grass', { roughness: 0.3, onlyOn: '.#o' })
m.blob(8, 32, 4, 3, 'grass', { roughness: 0.3, onlyOn: '.#o' })
m.blob(16, 22, 5, 2, 'grass', { roughness: 0.3, onlyOn: '.#o' })
m.blob(5, 13, 3, 4, 'grass', { roughness: 0.3, onlyOn: '.#o' })
m.blob(17, 14, 3, 2, 'grass', { roughness: 0.3, onlyOn: '.#o' })
m.blob(10, 5, 4, 3, 'grass', { roughness: 0.3, onlyOn: '.#o' })
m.scatter(2, 2, 28, 38, 'rock', 30, { onlyOn: '.' })

// Ledges: jump down to skip a switchback.
m.fill(10, 22, 12, 4, 'ground')
m.ledge(10, 22, 12)
m.fill(4, 28, 8, 4, 'ground')
m.ledge(4, 28, 8)
m.fill(16, 12, 6, 4, 'ground')
m.ledge(16, 12, 6)

// The ghost tower's rock face in the north-east.
m.fill(23, 2, 7, 6, 'rock')
m.path([[22, 10], [27, 10], [27, 8]], { width: 2 })
m.fill(27, 7, 1, 1, 'ground')
stairs(m, 27, 7, 'spoktornet_1', 11, 15)

m.pickup({ id: 'r5-super', x: 6, y: 30, item: 'super-potion' })
m.pickup({ id: 'r5-tm', x: 4, y: 20, item: 'tm:toxic', hidden: true })
m.pickup({ id: 'r5-fire', x: 25, y: 22, item: 'fire-stone', hidden: true })
m.pickup({ id: 'r5-ball', x: 18, y: 4, item: 'ultra-ball' })
m.pickup({ id: 'r5-hyper', x: 7, y: 8, item: 'hyper-potion', hidden: true })
m.sign(12, 38, ['VÄG 5', 'Bergsvägen. Sparkby söderut, Väg 6 norrut. Spöktornet österut.'])
m.sign(25, 9, ['SPÖKTORNET', 'Ingen går in där frivilligt. (Trappan leder in.)'])
m.npc({
  id: 'r5-vandrare', x: 20, y: 30, facing: 'left', look: 'hiker',
  dialog: ['Se upp för avsatserna. Man kan hoppa ner, men aldrig upp igen.', 'Och Rhyhorn är tuffare än de ser ut.'],
})
m.npc({
  id: 'r5-flicka', x: 12, y: 15, facing: 'right', look: 'girl',
  dialog: ['I tornet ska det finnas en gammal man som tycker om att fiska.', 'Fast jag vågar inte gå in och fråga.'],
})
m.trainer(trainer('r5-kjell', 'Kjell', 'hiker', { x: 14, y: 36, facing: 'auto' }, [[74, 21], [75, 22], [95, 22]]))
m.trainer(trainer('r5-ellen', 'Ellen', 'lass', { x: 20, y: 34, facing: 'auto' }, [[77, 21], [84, 22], [39, 22]]))
m.trainer(trainer('r5-nisse', 'Nisse', 'karate', { x: 24, y: 30, facing: 'auto' }, [[66, 22], [67, 23], [57, 24]]))
m.trainer(trainer('r5-olle', 'Olle', 'hiker', { x: 14, y: 26, facing: 'auto' }, [[111, 23], [75, 23], [95, 24]]))
m.trainer(trainer('r5-petra', 'Petra', 'picnicker', { x: 8, y: 22, facing: 'auto' }, [[104, 22], [28, 23], [104, 24]]))
m.trainer(trainer('r5-rune', 'Rune', 'hiker', { x: 14, y: 18, facing: 'auto' }, [[74, 22], [75, 24], [76, 25]]))
m.trainer(trainer('r5-tilda', 'Tilda', 'psychic', { x: 20, y: 14, facing: 'auto' }, [[96, 23], [63, 22], [64, 25]]))
m.trainer(trainer('r5-yngve', 'Yngve', 'karate', { x: 18, y: 10, facing: 'auto' }, [[66, 24], [67, 25], [106, 26]]))
m.trainer(trainer('r5-berit', 'Berit', 'lass', { x: 10, y: 8, facing: 'auto' }, [[83, 23], [21, 24], [77, 24]]))
m.trainer(trainer('r5-gunvor', 'Gunvor', 'picnicker', { x: 14, y: 4, facing: 'auto' }, [[104, 24], [105, 26], [111, 25]]))

export const route5 = m.build()
