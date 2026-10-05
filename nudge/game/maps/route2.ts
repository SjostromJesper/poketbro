import { mapBuilder } from '../mapBuilder'
import { trainer } from '../trainerClasses'
import { road, stairs } from './layout'

// Route 2: east of Grusstad. A path that winds up a hillside with ledges to jump down, tall grass in fields, a small pond and the entrance of Moon Mountain.
const m = mapBuilder('route2', 38, 40, { name: 'Väg 2', music: 'route1', encounterTable: 'route2' })
m.border('tree', 2)
m.scatter(2, 2, 34, 36, 'tree', 70)
m.scatter(2, 2, 34, 36, 'flowers', 30)

m.path([[1, 34], [10, 34], [10, 28], [20, 28], [20, 21], [8, 21], [8, 14], [26, 14], [26, 9], [31, 9]], { width: 2, wobble: 0.18 })
road(m, 'w', 33, 'gruss', 13)

// Fields of tall grass, a pond and rocks.
m.blob(16, 35, 4, 3, 'grass', { roughness: 0.3, onlyOn: '.#o' })
m.blob(27, 30, 4, 4, 'grass', { roughness: 0.35, onlyOn: '.#o' })
m.blob(5, 26, 3, 3, 'grass', { roughness: 0.3, onlyOn: '.#o' })
m.blob(28, 22, 3, 3, 'grass', { roughness: 0.3, onlyOn: '.#o' })
m.blob(14, 17, 4, 2, 'grass', { roughness: 0.3, onlyOn: '.#o' })
m.blob(6, 9, 3, 4, 'grass', { roughness: 0.3, onlyOn: '.#o' })
m.blob(20, 5, 5, 2, 'grass', { roughness: 0.3, onlyOn: '.#o' })
m.blob(31, 17, 3, 2, 'water')
m.scatter(2, 2, 34, 36, 'rock', 14, { onlyOn: '.' })

// Ledges: jump down to skip a bend of the path (you cannot climb back).
m.fill(12, 23, 10, 4, 'ground')
m.ledge(12, 22, 10)
m.fill(22, 11, 8, 3, 'ground')
m.ledge(22, 10, 8)
m.pickup({ id: 'r2-potion', x: 16, y: 25, item: 'potion' })
m.pickup({ id: 'r2-antidote', x: 26, y: 12, item: 'antidote', hidden: true })
m.pickup({ id: 'r2-ball', x: 4, y: 12, item: 'great-ball', hidden: true })

// The mountain: a rock face with the stairs into the cave.
m.fill(29, 3, 7, 6, 'rock')
m.fill(31, 8, 1, 1, 'ground')
m.fill(30, 9, 2, 1, 'path')
stairs(m, 31, 8, 'manberget_1', 17, 23)

m.sign(3, 33, ['VÄG 2', 'Grusstad västerut. Månberget österut.'])
m.sign(29, 10, ['MÅNBERGET', 'Grottan går igenom berget till kusten. Tag med ficklampa... eller bara mod.'])
m.npc({
  id: 'r2-gumma', x: 12, y: 32, facing: 'up', look: 'old',
  dialog: ['Jag brukar sitta här och titta på Pokémon i gräset.', 'Pidgey kan vara rätt starka om man ger dem tid att växa.'],
})
m.trainer(trainer('r2-gunnar', 'Gunnar', 'hiker', { x: 8, y: 31, facing: 'auto' }, [[74, 9], [74, 10], [27, 10]]))
m.trainer(trainer('r2-stina', 'Stina', 'lass', { x: 14, y: 26, facing: 'auto' }, [[29, 9], [30, 10]]))
m.trainer(trainer('r2-erik', 'Erik', 'youngster', { x: 22, y: 31, facing: 'auto' }, [[56, 10], [19, 11], [23, 10]]))
m.trainer(trainer('r2-lotta', 'Lotta', 'picnicker', { x: 17, y: 19, facing: 'auto' }, [[16, 11], [39, 11], [29, 10]]))
m.trainer(trainer('r2-bosse', 'Bosse', 'bugcatcher', { x: 5, y: 17, facing: 'auto' }, [[13, 10], [14, 10], [46, 11]]))
m.trainer(trainer('r2-gudrun', 'Gudrun', 'lass', { x: 18, y: 12, facing: 'auto' }, [[32, 11], [29, 11], [30, 12]]))
m.trainer(trainer('r2-sven', 'Sven', 'hiker', { x: 27, y: 6, facing: 'auto' }, [[74, 12], [74, 11], [95, 12]]))

export const route2 = m.build()
