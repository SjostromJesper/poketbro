// The words of the starter choice and the guided first battle (PLAN-4 1.3), and the rival of that battle. Edit the texts here.
import { RIVAL_NAME, rivalTeam } from '../rival'
import { registerTrainer } from '../trainers'

export const PROFESSOR = 'Professor Ek'

/** The professor's greeting when the player first comes to the lab. */
export const LAB_GREETING = [
  'Där är du, {player}! Jag har väntat på dig.',
  'Jag har tre Pokémon här som behöver en tränare. Varje Pokémon har sin egen natur och sitt eget drag, och de är slumpade just för dig.',
  'Titta noga på dem innan du väljer. Natur och drag påverkar hur de fightas och hur väl de lyssnar på dig.',
]

export const AFTER_PICK = (name: string) => [`${name}! Ett utmärkt val. Ta väl hand om den, {player}.`]

/** The rival bursts in (the real team comes from `rivalTeam(0, ...)`). */
export const RIVAL_ENTRANCE = [
  'Vänta! Jag vill också ha en Pokémon, morfar!',
  'Jag tar den här. Kom {player}, vi testar dem direkt. Jag slår dig!',
]
export const RIVAL_TUTORIAL_INTRO = ['Nu kör vi, {player}!']
export const RIVAL_WON = ['Ha! Jag vann. Jag sa ju det!', 'Du får träna mer, {player}.']
export const RIVAL_LOST = ['Va?! Jag förlorade?!', 'Det var tur. Nästa gång krossar jag dig!']

/** After the battle, whatever the result: the professor hands over the Poké Balls and the Pokédex. */
export const AFTER_BATTLE = [
  'Bra kämpat, båda två! Det spelar ingen roll vem som vann: ni lärde er något.',
  'Här, {player}. Fem Poké Balls och en Pokédex. Den skriver ner alla Pokémon du möter.',
  'Och så en sak om fångst: ju svagare en vild Pokémon är, desto lättare är den att fånga. Kasta bollen när den har lite HP kvar!',
  'Nu kan du lämna Hemstad. Vägen norrut går till Väg 1. Lycka till!',
]

registerTrainer({
  id: 'rival-0', name: RIVAL_NAME, title: 'Rivalen', look: 'boy', sprite: 'rival', rival: { round: 0 }, team: rivalTeam(0, 4),
  intro: RIVAL_TUTORIAL_INTRO, defeated: RIVAL_LOST,
})
