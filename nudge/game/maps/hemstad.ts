import { mapBuilder } from '../mapBuilder'
import { enterable, road } from './layout'

// Home town: your house (left), the professor's lab (right), a pond, a sign. The road north leads to Route 1.
const m = mapBuilder('hemstad', 30, 24, { name: 'Hemstad', music: 'hemstad' })
m.border('tree', 2)
m.scatter(2, 2, 26, 20, 'tree', 14)
m.scatter(2, 2, 26, 20, 'flowers', 22)

// Paths: the north road, the village square and the two house doors.
// Nobody leaves town without a Pokémon: the road north is closed until the starter is chosen.
road(m, 'n', 14, 'route1', 10, {
  requiresStarter: true,
  blockedDialog: ['Vänta! Det är farligt att gå ut i högt gräs utan en egen Pokémon.', 'Prata med professorn i labbet först!'],
})
m.path([[14, 2], [14, 10]], { width: 2 })
m.path([[4, 11], [24, 11]], { width: 2 })
m.path([[6, 9], [6, 11]], { width: 1 })
m.path([[21, 9], [21, 11]], { width: 1 })
m.blob(8, 17, 3, 2, 'water')
m.blob(21, 18, 4, 3, 'flowers', { onlyOn: '.' })
m.fill(2, 14, 7, 1, 'fence')
m.fill(18, 14, 8, 1, 'fence')

const home = enterable(m, 'houseA', 4, 5, 'hemhus', { name: 'Ditt hem', music: 'home' })
const lab = enterable(m, 'lab', 19, 5, 'proflab', { name: 'Professorns labb', music: 'home' })
m.sign(12, 12, ['HEMSTAD', 'Där äventyret börjar.'])
m.npc({
  id: 'hem-gubbe', x: 9, y: 13, facing: 'down', look: 'old',
  dialog: ['Hemstad är en lugn liten by. Här händer sällan något!'],
})
m.npc({
  id: 'hem-tjej', x: 16, y: 13, facing: 'up', look: 'girl',
  dialog: ['Professorns labb ligger i huset längst till höger.', 'Han brukar ha något åt nya tränare!'],
  dialogAfter: { flag: 'starter', lines: ['Grattis till din första Pokémon!', 'Vilda Pokémon gömmer sig i det höga gräset på Väg 1.'] },
})
home
  .fill(1, 1, 5, 1, 'table')
  .fill(6, 1, 1, 1, 'bed')
  .fill(5, 3, 1, 1, 'counter')
  .npc({
    id: 'hem-mamma', x: 3, y: 3, facing: 'down', look: 'mum', action: 'heal',
    dialog: ['Hej, {player}! Du ser trött ut. Vila lite!', 'Där! Dina Pokémon mår som nya.'],
  })

lab
  .fill(1, 1, 8, 1, 'shelf')
  .fill(4, 4, 2, 1, 'table')
  .npc({
    id: 'professor', x: 5, y: 2, facing: 'down', look: 'professor', action: 'starter', name: 'Professor Ek',
    dialog: [
      'Där är du, {player}! Jag har väntat på dig.',
      'Jag har tre Pokémon här som behöver en tränare. Var och en har sin egen natur och sitt eget drag, slumpade just för dig.',
      'Titta noga på dem innan du väljer. Natur och drag påverkar hur de fightas och hur väl de lyssnar på dig.',
    ],
    dialogAfter: {
      flag: 'starter',
      lines: [
        'Ta väl hand om din Pokémon, {player}! Gå norrut genom Väg 1 och skogen, så kommer du till Grusstad.',
        'Där finns ett gym. Lycka till!',
      ],
    },
  })
  .npc({
    id: 'assistent', x: 8, y: 4, facing: 'left', look: 'girl', name: 'Assistent',
    dialog: ['En Pokémons natur påverkar vilka sorters attacker den föredrar.', 'Titta på dess sammanfattning i menyn för att se natur och drag!'],
  })

export const hemstadMaps = [m.build(), home.build(), lab.build()]
