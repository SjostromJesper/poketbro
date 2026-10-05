import { mapBuilder } from '../mapBuilder'
import { gymLeader, trainer } from '../trainerClasses'
import { enterable, fillCenter, fillMart, road } from './layout'

// Bloomtown: flower beds everywhere, a grass gym and the road east into the wilderness, closed until four badges.
const m = mapBuilder('blomstad', 36, 28, { name: 'Blomstad', music: 'grusstad' })
m.border('tree', 2)
m.scatter(2, 2, 32, 24, 'tree', 6)
m.scatter(2, 2, 32, 24, 'flowers', 90)

road(m, 'w', 14, 'route6', 16)
road(m, 'e', 14, 'vildmarken', 22, {
  requiresBadges: 4,
  blockedDialog: ['Vakten står i vägen. "Vildmarken är bara för tränare med fyra märken!"'],
})
m.path([[2, 14], [33, 14]], { width: 2 })
m.path([[6, 9], [6, 14]], { width: 1 })
m.path([[12, 9], [12, 14]], { width: 1 })
m.path([[18, 8], [18, 14]], { width: 1 })
m.path([[28, 9], [28, 14]], { width: 1 })
m.path([[9, 22], [9, 16]], { width: 1 })
m.blob(26, 21, 4, 2, 'water')
m.fill(3, 18, 5, 1, 'fence')

const center = enterable(m, 'center', 4, 5, 'blomstad_center', { name: 'Pokémon Center', music: 'center' })
const hus = enterable(m, 'houseA', 10, 5, 'blomstad_hus1', { name: 'Hus', music: 'home' })
const gym = enterable(m, 'gym', 16, 4, 'blomstad_gym', { name: 'Blomstads gym', music: 'gym', floor: 'stone' })
const mart = enterable(m, 'mart', 26, 5, 'blomstad_mart', { name: 'Pokémart', music: 'center' })
m.scenery('houseC', 14, 18)
m.scenery('houseD', 20, 18)
m.sign(14, 13, ['BLOMSTAD', 'Blommornas stad. Gym: Ledare Lilja (gräs).'])
m.sign(32, 12, ['VILDMARKEN', 'Österut: vildmarken. Fyra märken krävs.'])
m.npc({
  id: 'blomstad-flicka', x: 22, y: 12, facing: 'down', look: 'girl',
  dialog: ['Blommorna här doftar underbart! Lilja planterar dem själv.', 'Eld och is brukar fungera bra mot hennes Pokémon.'],
})
m.npc({
  id: 'blomstad-gubbe', x: 8, y: 17, facing: 'right', look: 'old',
  dialog: ['I Vildmarken bor Pokémon som ingen annan har sett. Men vägen dit är lång.', 'Har du fyra märken? Då släpper vakterna förbi dig.'],
})
for (const y of [14, 15]) {
  m.npc({
    id: `blomstad-vakt-${y}`, x: 31, y, facing: 'right', look: 'old', name: 'Vakt', gate: { badges: 4 },
    dialog: ['Vildmarken är bara för tränare med fyra märken.', 'Slå Lilja i gymmet här först!'],
  })
}
m.pickup({ id: 'blomstad-ball', x: 32, y: 22, item: 'ultra-ball', hidden: true })
m.pickup({ id: 'blomstad-potion', x: 4, y: 23, item: 'hyper-potion' })

fillCenter(center, 'blomstad', 'Blomstad')
fillMart(mart, 'blomstad', 'Välkommen till Blomstads Pokémart! Här finns TM:er som växer på träd. Nästan.')

hus
  .fill(1, 1, 2, 1, 'bed')
  .npc({
    id: 'blomstad-tradgard', x: 4, y: 3, facing: 'down', look: 'old', name: 'Trädgårdsmästare',
    dialog: ['Jag har odlat blommor i fyrtio år. Det finns en växt för varje stad.', 'Gräs är starkt mot Vatten och Mark, men svagt mot Eld, Is och Flygande.'],
  })

gym.fill(2, 5, 2, 1, 'shelf').fill(9, 5, 2, 1, 'shelf').fill(2, 9, 2, 1, 'shelf').fill(9, 9, 2, 1, 'shelf')
gym.trainer(trainer('blomstad-gym-1', 'Rosa', 'gymstudent', { x: 9, y: 7, facing: 'left', sight: 5 }, [[70, 22], [44, 23]], {
  sprite: 'picnicker', intro: ['Välkommen till Blomstads gym! Mind the thorns!'], defeated: ['Mina blommor vissnade...'],
}))
gym.trainer(trainer('blomstad-gym-2', 'Viktor', 'gymstudent', { x: 2, y: 11, facing: 'right', sight: 6 }, [[102, 23], [69, 24], [102, 24]], {
  intro: ['Lilja har tränat oss hårt. Du går inte förbi mig!'], defeated: ['Jag föll som ett löv.'],
}))
gym.trainer(trainer('blomstad-gym-3', 'Daisy', 'gymstudent', { x: 10, y: 11, facing: 'left', sight: 4 }, [[47, 24], [114, 25]], {
  sprite: 'lass', intro: ['Doften av vinst! Eller är det blommor?'], defeated: ['Jag gav dig blommor... och ett nederlag.'],
}))
gym.trainer(gymLeader('blomstad-lilja', 'Lilja', 'leader4', { x: 6, y: 2, facing: 'down' }, [[71, 24, ['razor-leaf', 'vine-whip', 'sleep-powder', 'poison-powder']], [114, 26, ['vine-whip', 'absorb', 'sleep-powder', 'poison-powder']], [45, 29, ['mega-drain', 'stun-spore', 'acid', 'sleep-powder']]], {
  badge: 'lilja',
  badgeName: 'Blommärket',
  tm: 'mega-drain',
  rewardDialog: [
    'Underbart! Du växte rakt igenom mitt gym. Här, Blommärket!',
    'Och TM:en innehåller Mega Drain. Ta den med dig ut i Vildmarken.',
  ],
}, {
  intro: ['Jag är Lilja, Blomstads gymledare!', 'Gräs är mjukt, men rötterna sitter djupt. Kan du dra upp dem?'],
  defeated: ['Hm! Du har gröna fingrar... för strid.'],
}))

export const blomstadMaps = [m.build(), gym.build(), center.build(), mart.build(), hus.build()]
