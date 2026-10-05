import { mapBuilder } from '../mapBuilder'
import { trainer } from '../trainerClasses'
import { road, stairs } from './layout'

// Route 4: the meadow north of the harbour. Wide fields of tall grass with flowers, a pond, a winding road east to Sparkby and a rocky hill in
// the north-west with the entrance of the power plant.
const m = mapBuilder('route4', 34, 36, { name: 'Väg 4', music: 'route1', encounterTable: 'route4' })
m.border('tree', 2)
m.scatter(2, 2, 30, 32, 'tree', 40)
m.scatter(2, 2, 30, 32, 'flowers', 70)

m.path([[14, 34], [14, 28], [6, 28], [6, 18], [32, 18]], { width: 2, wobble: 0.15 })
m.path([[6, 18], [6, 9]], { width: 2 })
road(m, 's', 14, 'hamn', 11)
road(m, 'e', 18, 'gnistby', 14)

// Meadows.
m.blob(20, 27, 6, 4, 'grass', { roughness: 0.3, onlyOn: '.#o' })
m.blob(24, 12, 6, 4, 'grass', { roughness: 0.3, onlyOn: '.#o' })
m.blob(12, 23, 4, 3, 'grass', { roughness: 0.3, onlyOn: '.#o' })
m.blob(10, 12, 3, 3, 'grass', { roughness: 0.3, onlyOn: '.#o' })
m.blob(28, 24, 3, 3, 'grass', { roughness: 0.3, onlyOn: '.#o' })
m.blob(11, 32, 4, 2, 'grass', { roughness: 0.3, onlyOn: '.#o' })
m.blob(26, 30, 4, 3, 'water', { roughness: 0.3 })

// The power plant's hill: a rock face with the stairs in.
m.fill(3, 2, 9, 7, 'rock')
m.fill(7, 8, 2, 1, 'path')
m.fill(7, 7, 1, 1, 'ground')
stairs(m, 7, 7, 'kraftverket_1', 15, 21)

m.pickup({ id: 'r4-super', x: 28, y: 22, item: 'super-potion' })
m.pickup({ id: 'r4-leaf', x: 4, y: 24, item: 'leaf-stone', hidden: true })
m.pickup({ id: 'r4-ball', x: 20, y: 9, item: 'great-ball', hidden: true })
m.pickup({ id: 'r4-berry', x: 30, y: 11, item: 'oran-berry' })
m.sign(12, 31, ['VÄG 4', 'Hamnstad söderut. Gnistby österut.'])
m.sign(9, 9, ['KRAFTVERKET', 'Strömmen till Gnistby kommer härifrån. Ingen obehörig! (Trappan leder in.)'])
m.npc({
  id: 'r4-gumma', x: 16, y: 30, facing: 'left', look: 'old',
  dialog: ['Åh, ängen! Så vacker. Men håll koll på Ponyta, de springer snabbare än man tror.', 'Och kraftverket i norr är fullt av små gnistor.'],
})
m.npc({
  id: 'r4-flicka', x: 22, y: 20, facing: 'down', look: 'girl',
  dialog: ['Jag letar efter fyrklöver. Jag har bara hittat vanliga klöver!'],
})
m.trainer(trainer('r4-hanna', 'Hanna', 'picnicker', { x: 12, y: 26, facing: 'auto' }, [[43, 17], [43, 18], [70, 18]]))
m.trainer(trainer('r4-arvid', 'Arvid', 'bugcatcher', { x: 18, y: 31, facing: 'auto' }, [[48, 17], [48, 18], [49, 20]]))
m.trainer(trainer('r4-leif', 'Leif', 'youngster', { x: 10, y: 20, facing: 'auto' }, [[77, 18], [58, 19], [20, 19]]))
m.trainer(trainer('r4-maja', 'Maja', 'lass', { x: 22, y: 16, facing: 'auto' }, [[39, 18], [35, 19], [40, 20]]))
m.trainer(trainer('r4-ragna', 'Ragna', 'picnicker', { x: 6, y: 14, facing: 'auto' }, [[102, 19], [43, 19], [114, 18]]))
m.trainer(trainer('r4-karl', 'Karl', 'hiker', { x: 12, y: 10, facing: 'auto', sight: 4 }, [[74, 19], [95, 19], [75, 20]]))
m.trainer(trainer('r4-sofie', 'Sofie', 'lass', { x: 20, y: 20, facing: 'auto' }, [[54, 19], [79, 20], [37, 19]]))
m.trainer(trainer('r4-viktor', 'Viktor', 'scientist', { x: 26, y: 16, facing: 'auto' }, [[81, 19], [81, 19], [100, 20]]))
m.trainer(trainer('r4-torun', 'Torun', 'fisher', { x: 20, y: 31, facing: 'auto' }, [[60, 19], [118, 19], [129, 20]]))

export const route4 = m.build()
