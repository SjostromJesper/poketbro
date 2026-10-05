import { mapBuilder } from '../mapBuilder'
import { trainer } from '../trainerClasses'
import { road } from './layout'

// Viridian Forest: a dense forest of trees and tall grass with a winding trail, bug catchers behind every bend and a pond at the heart of it.
const m = mapBuilder('skogen', 30, 42, { name: 'Viridianskogen', music: 'skogen', encounterTable: 'skogen' })
m.fill(0, 0, 30, 42, 'tree')
// Clearings of tall grass joined by the trail.
for (const [x, y, rx, ry] of [[8, 34, 5, 3], [21, 31, 5, 4], [8, 24, 6, 3], [21, 18, 5, 4], [9, 12, 6, 3], [20, 7, 5, 3]] as const) {
  m.blob(x, y, rx, ry, 'grass', { roughness: 0.3 })
}
m.path([[14, 41], [14, 36], [9, 36], [9, 30], [20, 30], [20, 24], [8, 24], [8, 17], [21, 17], [21, 11], [10, 11], [10, 6], [14, 6], [14, 0]], { width: 2, wobble: 0.15 })
road(m, 's', 14, 'route1', 10)
road(m, 'n', 14, 'gruss', 16)
m.blob(25, 36, 2, 2, 'water')
m.scatter(2, 2, 26, 38, 'ground', 40, { onlyOn: '#' })
m.scatter(2, 2, 26, 38, 'flowers', 14, { onlyOn: '.' })
m.pickup({ id: 'skog-antidote', x: 4, y: 30, item: 'antidote' })
m.pickup({ id: 'skog-potion', x: 25, y: 12, item: 'potion', hidden: true })
m.sign(16, 38, ['VIRIDIANSKOGEN', 'Se upp för insekter! Grusstad norrut.'])
m.npc({
  id: 'skog-vandrare', x: 12, y: 37, facing: 'right', look: 'hiker',
  dialog: ['Skogen är full av insekter. Se upp för Weedles gift!', 'Det är lätt att gå vilse här. Håll dig till stigen.'],
})
m.trainer(trainer('skog-olle', 'Olle', 'bugcatcher', { x: 12, y: 30, facing: 'auto', sight: 3 }, [[10, 6], [13, 6]], {
  intro: ['Hallå! Insekter är bäst. Vill du se mina?'],
  defeated: ['Mina insekter! De var starkare i mitt huvud...', 'Skogen fortsätter norrut. Jag stannar här och fångar fler.'],
}))
m.trainer(trainer('skog-maja', 'Maja', 'picnicker', { x: 17, y: 24, facing: 'auto', sight: 3 }, [[11, 6], [14, 6], [13, 5]], {
  intro: ['Åh! Du hittade mig! Jag gömde mig här bland träden.', 'Men nu när du ändå är här kan vi slåss!'],
  defeated: ['Du var duktig! Jag tror jag går hem nu.'],
}))
m.trainer(trainer('skog-elis', 'Elis', 'bugcatcher', { x: 14, y: 17, facing: 'auto', sight: 3 }, [[10, 5], [13, 5], [16, 6]]))
m.trainer(trainer('skog-ante', 'Ante', 'bugcatcher', { x: 12, y: 11, facing: 'auto', sight: 3 }, [[11, 6], [14, 6], [10, 6]]))
m.trainer(trainer('skog-hanna', 'Hanna', 'lass', { x: 21, y: 8, facing: 'auto', sight: 3 }, [[16, 6], [25, 6], [10, 5]]))

export const skogen = m.build()
