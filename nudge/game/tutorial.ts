// The guided first battle (PLAN-4 1.3): the battle stops at a few moments and the professor explains what the player sees. Pure state machine,
// fed with the battle's clock, ATB fill and events by the battle store; the battle scene draws `prompt` and calls `dismiss()` on a press.
// Phases: the ATB bars -> "try a move" (waits until the player has nudged) -> what the ♪ or … after the next choice means -> the nudge dots.
import type { BattleEvent } from '../engine/types'

/** What the scene highlights while the professor talks. */
export type TutorialFocus = 'atb' | 'moves' | 'emote' | 'pips'

export interface TutorialPrompt {
  id: 'atb' | 'moves' | 'afterNudge' | 'pips'
  lines: string[]
  focus: TutorialFocus
  /** Prompts that wait for the player to do something (nudge) cannot be dismissed with a press. */
  waitsForNudge: boolean
}

export interface TutorialInput {
  /** Battle time (ms) and the player's active Pokémon's ATB (0..1). */
  timeMs: number
  atb: number
  /** How many nudges the player has used so far in this battle. */
  nudgesUsed: number
  /** True once the player's Pokémon and the foe are both out. */
  ready: boolean
}

type Phase = 'atb' | 'moves' | 'afterNudge' | 'pips' | 'done'

/** The battle time (ms) after both are out until the first explanation: the bars have started to fill. */
export const ATB_PROMPT_DELAY_MS = 600
/** The ATB level at which "try a move" comes (so there is still time to nudge before the Pokémon chooses). */
export const MOVE_PROMPT_ATB = 0.3
/** Minimum time between two presses that dismiss a prompt. */
export const TUTORIAL_LOCK_MS = 260

export class Tutorial {
  prompt: TutorialPrompt | null = null
  /** The prompts that have been shown, in order (for the notes menu and the tests). */
  readonly shown: TutorialPrompt['id'][] = []
  private phase: Phase = 'atb'
  private nudgesAtStart: number | null = null
  private startedAt: number | null = null
  private lockedUntil = 0
  private clock = 0
  private enabled: boolean

  constructor(options: { enabled?: boolean } = {}) {
    this.enabled = options.enabled ?? true
    if (!this.enabled) this.phase = 'done'
  }

  /** The battle waits while a prompt is open. */
  get blocking(): boolean {
    return this.prompt !== null
  }

  get finished(): boolean {
    return this.phase === 'done'
  }

  private open(prompt: TutorialPrompt): void {
    this.prompt = prompt
    this.shown.push(prompt.id)
    this.lockedUntil = this.clock + TUTORIAL_LOCK_MS
  }

  /** Called every frame with where the battle is, and with the events of that frame. */
  update(input: TutorialInput, events: BattleEvent[], realMs = 16): void {
    this.clock += realMs
    if (this.phase === 'done' || this.prompt) return
    if (this.nudgesAtStart === null) this.nudgesAtStart = input.nudgesUsed
    if (!input.ready) return
    if (this.startedAt === null) this.startedAt = input.timeMs

    switch (this.phase) {
      case 'atb':
        if (input.timeMs - this.startedAt >= ATB_PROMPT_DELAY_MS) {
          this.open({
            id: 'atb',
            lines: ['Ser du barerna? När den är full agerar din Pokémon.', 'Snabba Pokémon fyller sin bar fortare, och hinner agera oftare.'],
            focus: 'atb',
            waitsForNudge: false,
          })
        }
        break
      case 'moves':
        if (input.nudgesUsed > (this.nudgesAtStart ?? 0)) {
          // The player nudged before the prompt came: go on.
          this.phase = 'afterNudge'
        } else if (input.atb >= MOVE_PROMPT_ATB) {
          this.open({ id: 'moves', lines: ['Tryck på en attack för att uppmuntra din Pokémon. Prova nu!'], focus: 'moves', waitsForNudge: true })
        }
        break
      case 'afterNudge': {
        const choice = events.find((e): e is Extract<BattleEvent, { type: 'move-chosen' }> => e.type === 'move-chosen' && e.side === 'player')
        if (choice) {
          const followed = choice.followedNudge
          this.open({
            id: 'afterNudge',
            lines: followed
              ? ['Ser du ♪? Då lyssnade din Pokémon på dig och valde just den attacken.']
              : ['Ser du …? Då valde den något annat än du ropade. Hur mycket den lyssnar beror på personlighet och på hur väl ni känner varandra.'],
            focus: 'emote',
            waitsForNudge: false,
          })
        }
        break
      }
      case 'pips':
        this.open({
          id: 'pips',
          lines: ['Prickarna visar hur många gånger den orkar lyssna på dig i den här striden.', 'Ropa klokt! Varje ny uppmuntran väger lite mindre än den förra.'],
          focus: 'pips',
          waitsForNudge: false,
        })
        break
      default:
        break
    }
    // The nudge the prompt waited for.
    if (this.phase === 'moves' && this.prompt === null) return
  }

  /** The player nudged while the "try a move" prompt waits: the battle goes on. Called by the store with the number of nudges used. */
  noteNudges(nudgesUsed: number): void {
    if (this.prompt?.waitsForNudge && nudgesUsed > (this.nudgesAtStart ?? 0)) {
      this.prompt = null
      this.phase = 'afterNudge'
    }
  }

  /** A press on the text box. Returns false when the press did nothing (locked, or the prompt waits for a nudge). */
  dismiss(): boolean {
    if (!this.prompt || this.prompt.waitsForNudge || this.clock < this.lockedUntil) return false
    const id = this.prompt.id
    this.prompt = null
    this.lockedUntil = this.clock + TUTORIAL_LOCK_MS
    if (id === 'atb') this.phase = 'moves'
    else if (id === 'afterNudge') this.phase = 'pips'
    else if (id === 'pips') this.phase = 'done'
    return true
  }

  /** Turns the explanations off (the skip option, PLAN-4 1.4): the battle goes on as normal. */
  skip(): void {
    this.prompt = null
    this.phase = 'done'
  }
}
