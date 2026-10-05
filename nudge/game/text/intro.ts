// The intro of a new game (PLAN-4 1.2): Professor Ek presents the world, explains what is different here, and asks for the names and the look.
// All the words are in this file so they are easy to edit. Played by the cutscene engine (cutscene.ts).
import type { CutsceneStep } from '../cutscene'

export const PROFESSOR = 'Professor Ek'
export const NAME_SUGGESTIONS = ['Alex', 'Robin', 'Kim']
export const RIVAL_SUGGESTIONS = ['Elias', 'Noa', 'Max']
export const MAX_NAME_LENGTH = 10
/** The pokémon that keeps the professor company in the intro (Eevee). */
export const COMPANION_SPECIES = 133

const say = (...lines: string[]): CutsceneStep => ({ type: 'text', lines, speaker: PROFESSOR })

/** Asks for a name, then "Så du heter X?" and asks again on "Nej". */
function askName(variable: string, label: string, prompt: string, suggestions: string[], confirm: string): CutsceneStep[] {
  return [
    { type: 'label', name: label },
    { type: 'input', name: variable, prompt, suggestions, maxLength: MAX_NAME_LENGTH },
    { type: 'choice', name: `${variable}Ok`, prompt: confirm, options: ['Ja', 'Nej'] },
    { type: 'jump', to: label, when: { variable: `${variable}Ok`, equals: 'Nej' } },
  ]
}

/** The short version for later new games (the intro was skipped): only the questions. Sets the same variables as `introSteps`. */
export function quickIntroSteps(options: IntroOptions): CutsceneStep[] {
  const steps: CutsceneStep[] = [
    { type: 'fade', to: 'black', ms: 0 },
    { type: 'playMusic', id: 'home' },
    { type: 'fade', to: 'clear', ms: 600 },
    { type: 'showSprite', id: 'ek', sprite: { kind: 'character', sprite: 'professor' }, at: 'left', anim: 'none' },
    say('Välkommen tillbaka! Några snabba frågor först.'),
    ...askName('player', 'askPlayer', 'Vad heter du?', NAME_SUGGESTIONS, 'Så du heter {player}?'),
  ]
  if (options.lookCount >= 2) {
    steps.push(
      { type: 'showSprite', id: 'look1', sprite: { kind: 'character', sprite: 'player' }, at: 'center', anim: 'none' },
      { type: 'showSprite', id: 'look2', sprite: { kind: 'character', sprite: 'player2' }, at: 'right', anim: 'none' },
      { type: 'choice', name: 'look', prompt: 'Vilken av dem är du?', options: ['Den i mitten', 'Den till höger'] },
      { type: 'run', fn: (vars) => { vars.playerSprite = vars.lookIndex === '1' ? 'player2' : 'player' } },
    )
  } else {
    steps.push({ type: 'run', fn: (vars) => { vars.playerSprite = 'player' } })
  }
  steps.push(
    ...askName('rival', 'askRival', 'Vad heter rivalen?', RIVAL_SUGGESTIONS, 'Så han heter {rival}?'),
    { type: 'fade', to: 'black', ms: 500 },
  )
  return steps
}

export interface IntroOptions {
  /** How many player looks the theme has (the look step is skipped with one). */
  lookCount: number
}

/** The full intro. It sets `player` (the trainer name), `rival` (the rival's name) and `playerSprite` (`player` or `player2`) in the variables. */
export function introSteps(options: IntroOptions): CutsceneStep[] {
  const steps: CutsceneStep[] = [
    { type: 'fade', to: 'black', ms: 0 },
    { type: 'playMusic', id: 'home' },
    { type: 'wait', ms: 600 },
    { type: 'fade', to: 'clear', ms: 1500 },
    { type: 'showSprite', id: 'ek', sprite: { kind: 'character', sprite: 'professor' }, at: 'left', anim: 'slide' },
    say('Hej där! Välkommen till Pokémonvärlden!', 'Jag heter Ek, men folk kallar mig Professor Ek.'),

    { type: 'showSprite', id: 'companion', sprite: { kind: 'pokemon', speciesId: COMPANION_SPECIES }, at: 'right', anim: 'pop' },
    { type: 'playCry', speciesId: COMPANION_SPECIES },
    { type: 'jingle', id: 'favorite' },
    say(
      'Den här världen är full av varelser som kallas Pokémon.',
      'För vissa är de husdjur, andra använder dem i strider. Själv forskar jag om dem.',
    ),

    // What is different here.
    say('Men här är en sak som många inte förstår: Pokémon är inga verktyg. De har egna personligheter och tänker själva.'),
    { type: 'highlight', illustration: 'atb' },
    say('I strid väljer de själva vad de ska göra. Snabba Pokémon hinner agera oftare än långsamma.'),
    { type: 'highlight', illustration: 'move' },
    say('Du kan inte ge order, men du kan uppmuntra dem. Ett rop i rätt ögonblick kan göra hela skillnaden.'),
    { type: 'highlight', illustration: 'dots' },
    say('Men ropa inte för ofta! Orken att lyssna är begränsad.'),
    { type: 'highlight', illustration: 'heart' },
    say('Hur mycket de lyssnar beror på deras personlighet och på hur väl ni känner varandra. Ta hand om dem, så litar de på dig.'),
    { type: 'highlight', illustration: null },

    // The player.
    say('Nu då! Låt mig se på dig.'),
    ...askName('player', 'askPlayer', 'Vad heter du?', NAME_SUGGESTIONS, 'Så du heter {player}?'),
    say('{player}! Vilket fint namn.'),
  ]

  if (options.lookCount >= 2) {
    steps.push(
      say('Och hur ser du ut? Hm, låt mig se...'),
      { type: 'showSprite', id: 'look1', sprite: { kind: 'character', sprite: 'player' }, at: 'center', anim: 'pop' },
      { type: 'showSprite', id: 'look2', sprite: { kind: 'character', sprite: 'player2' }, at: 'right', anim: 'pop' },
      { type: 'hideSprite', id: 'companion', anim: 'none' },
      { type: 'choice', name: 'look', prompt: 'Vilken av dem är du?', options: ['Den i mitten', 'Den till höger'] },
      { type: 'run', fn: (vars) => { vars.playerSprite = vars.lookIndex === '1' ? 'player2' : 'player' } },
      { type: 'hideSprite', id: 'look1', anim: 'none' },
      { type: 'hideSprite', id: 'look2', anim: 'none' },
    )
  } else {
    steps.push({ type: 'run', fn: (vars) => { vars.playerSprite = 'player' } })
  }
  steps.push(
    { type: 'showSprite', id: 'player', sprite: { kind: 'player' }, at: 'center', anim: 'pop' },
    say('Just det! Så ser du ut, {player}.'),

    // The rival.
    { type: 'showSprite', id: 'rival', sprite: { kind: 'rival' }, at: 'right', anim: 'slide' },
    say('Och det här är mitt barnbarn. Ni har tävlat mot varandra sedan ni var små.', 'Vad var det nu han hette?'),
    ...askName('rival', 'askRival', 'Vad heter rivalen?', RIVAL_SUGGESTIONS, 'Så han heter {rival}?'),
    say('Just det, {rival}! Han har gått och blivit en riktig tävlingsmänniska.'),
    { type: 'hideSprite', id: 'rival', anim: 'fade' },
    { type: 'hideSprite', id: 'ek', anim: 'fade' },

    // The end.
    { type: 'jingle', id: 'favorite' },
    say('{player}! Din alldeles egen Pokémonresa ska just börja.', 'En värld full av drömmar och äventyr väntar. Kom till mitt labb när du är redo!'),
    { type: 'hideSprite', id: 'player', anim: 'shrink' },
    { type: 'wait', ms: 1100 },
    { type: 'fade', to: 'black', ms: 900 },
  )
  return steps
}
