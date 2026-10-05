// The cutscene engine (PLAN-4 1.5): a list of steps played in order, with text in a typewriter box, sprites coming and going, sounds, fades,
// questions (a name, a choice) and variables to put into the text ("Så du heter {name}?"). Pure TypeScript: the engine only holds state and calls
// `hooks` for what has to happen outside (a cry, a song); the Vue scene (`CutsceneScene.vue`) draws `state` and forwards presses.
// Used for the intro, and meant for gym leaders, the rival and gift scenes later.
import type { JingleId, MusicId } from './audio-manifest'
import type { SpriteKey } from './themes/types'

/** Something drawn on the stage: a character look of the active theme, or a Pokémon (by species id). */
export type StageSprite = { kind: 'character', sprite: SpriteKey } | { kind: 'pokemon', speciesId: number } | { kind: 'player' } | { kind: 'rival' }

export type SpriteSlot = 'left' | 'center' | 'right'

/** Small drawings shown beside the text where they help (`highlight`). */
export type Illustration = 'atb' | 'move' | 'heart' | 'dots'

export type CutsceneStep =
  | { type: 'text', lines: string[], speaker?: string }
  | { type: 'showSprite', id: string, sprite: StageSprite, at?: SpriteSlot, anim?: 'slide' | 'pop' | 'none' }
  | { type: 'hideSprite', id: string, anim?: 'fade' | 'shrink' | 'none' }
  | { type: 'playCry', speciesId: number }
  | { type: 'playMusic', id: MusicId | null }
  | { type: 'jingle', id: JingleId }
  /** Asks for a name (stored in `vars[name]`). `suggestions` are buttons that fill the field. */
  | { type: 'input', name: string, prompt: string, suggestions: string[], maxLength: number }
  /** Asks to pick one of `options` (the picked text goes to `vars[name]`, its index to `vars[name + 'Index']`). */
  | { type: 'choice', name: string, prompt?: string, options: string[] }
  | { type: 'fade', to: 'black' | 'clear', ms: number }
  | { type: 'wait', ms: number }
  /** Shows (or with `null` hides) a drawing next to the text. */
  | { type: 'highlight', illustration: Illustration | null }
  | { type: 'label', name: string }
  /** Jumps to a label; with `when` only if the variable equals the value (otherwise goes on). */
  | { type: 'jump', to: string, when?: { variable: string, equals: string } }
  /** Runs code (set a variable, change the game); may return a label to jump to. */
  | { type: 'run', fn: (vars: Record<string, string>) => string | void }

export interface CutsceneHooks {
  cry?: (speciesId: number) => void
  music?: (id: MusicId | null) => void
  jingle?: (id: JingleId) => void
}

export interface StageSpriteState {
  id: string
  sprite: StageSprite
  at: SpriteSlot
  /** 0 = just arrived (or about to leave), 1 = in place. Drives the slide / pop / shrink. */
  progress: number
  anim: 'slide' | 'pop' | 'none'
  leaving: 'fade' | 'shrink' | 'none' | null
}

export interface TextState {
  speaker?: string
  lines: string[]
  lineIndex: number
  /** How many characters of the current line are shown. */
  revealed: number
  line: string
}

export type Prompt =
  | { kind: 'input', name: string, prompt: string, suggestions: string[], maxLength: number }
  | { kind: 'choice', name: string, prompt?: string, options: string[] }

export interface CutsceneState {
  text: TextState | null
  sprites: StageSpriteState[]
  /** 0 = scene visible, 1 = all black. */
  blackness: number
  illustration: Illustration | null
  prompt: Prompt | null
  finished: boolean
}

/** Minimum time between two presses that move on (ms), so a held or double-pressed key cannot skip a step. */
export const PRESS_LOCK_MS = 260
/** After a press that only finishes the typing of a line. */
const FINISH_LOCK_MS = 120
/** Typewriter speed (characters per second); text speed in the settings multiplies it. */
export const CHARS_PER_SECOND = 40

const interpolate = (text: string, vars: Record<string, string>) => text.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? `{${key}}`)

export class CutsceneRunner {
  readonly vars: Record<string, string>
  readonly state: CutsceneState = { text: null, sprites: [], blackness: 0, illustration: null, prompt: null, finished: false }
  /** Bumped at every change, so a view can tell something changed. */
  version = 0

  private index = -1
  private clock = 0
  private lockedUntil = 0
  private waitLeft = 0
  private fade: { from: number, to: number, ms: number, elapsed: number } | null = null
  private charsPerMs: number
  private started = false

  constructor(
    private readonly steps: CutsceneStep[],
    private readonly hooks: CutsceneHooks = {},
    options: { vars?: Record<string, string>, speed?: number } = {},
  ) {
    this.vars = { ...(options.vars ?? {}) }
    this.charsPerMs = (CHARS_PER_SECOND * (options.speed ?? 1)) / 1000
  }

  /** Starts playing (separate from the constructor so a view can set itself up first). */
  start(): void {
    if (this.started) return
    this.started = true
    this.advanceStep()
  }

  get finished(): boolean {
    return this.state.finished
  }

  /** True while the scene waits for a press (text) or an answer (a question). */
  get waitingForInput(): boolean {
    return !!this.state.text || !!this.state.prompt
  }

  // ---------------------------------------------------------------------------
  // Time
  // ---------------------------------------------------------------------------

  update(ms: number): void {
    if (!this.started || this.state.finished) return
    this.clock += ms
    const text = this.state.text
    if (text && text.revealed < text.line.length) {
      text.revealed = Math.min(text.line.length, text.revealed + ms * this.charsPerMs)
      this.version++
    }
    for (const sprite of this.state.sprites) {
      if (sprite.progress < 1 && !sprite.leaving) {
        sprite.progress = Math.min(1, sprite.progress + ms / 500)
        this.version++
      } else if (sprite.leaving && sprite.progress > 0) {
        sprite.progress = Math.max(0, sprite.progress - ms / (sprite.leaving === 'shrink' ? 900 : 400))
        this.version++
      }
    }
    // Sprites that have left are gone.
    const before = this.state.sprites.length
    this.state.sprites = this.state.sprites.filter(s => !(s.leaving && s.progress <= 0))
    if (this.state.sprites.length !== before) this.version++
    if (this.fade) {
      this.fade.elapsed += ms
      const t = Math.min(1, this.fade.elapsed / Math.max(1, this.fade.ms))
      this.state.blackness = this.fade.from + (this.fade.to - this.fade.from) * t
      this.version++
      if (t >= 1) {
        this.fade = null
        this.advanceStep()
      }
    } else if (this.waitLeft > 0) {
      this.waitLeft -= ms
      if (this.waitLeft <= 0) {
        this.waitLeft = 0
        this.advanceStep()
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------

  /** One press / click / tap. A press finishes the typing of the line, or moves on to the next line / step. Presses while a question is open are ignored. */
  press(): void {
    if (!this.started || this.state.finished || this.state.prompt || this.clock < this.lockedUntil) return
    const text = this.state.text
    if (!text) return
    if (text.revealed < text.line.length) {
      text.revealed = text.line.length
      this.lockedUntil = this.clock + FINISH_LOCK_MS
    } else if (text.lineIndex < text.lines.length - 1) {
      text.lineIndex++
      text.line = text.lines[text.lineIndex]
      text.revealed = 0
      this.lockedUntil = this.clock + PRESS_LOCK_MS
    } else {
      this.lockedUntil = this.clock + PRESS_LOCK_MS
      this.state.text = null
      this.advanceStep()
    }
    this.version++
  }

  /** Answers the open question: the typed name, or the picked option. Returns false when nothing is asked or the answer is not valid. */
  answer(value: string | number): boolean {
    const prompt = this.state.prompt
    if (!prompt || this.clock < this.lockedUntil) return false
    if (prompt.kind === 'input') {
      const name = String(value).trim()
      if (!name || name.length > prompt.maxLength) return false
      this.vars[prompt.name] = name
    } else {
      const index = typeof value === 'number' ? value : prompt.options.indexOf(String(value))
      if (index < 0 || index >= prompt.options.length) return false
      this.vars[prompt.name] = prompt.options[index]
      this.vars[`${prompt.name}Index`] = String(index)
    }
    this.state.prompt = null
    this.lockedUntil = this.clock + PRESS_LOCK_MS
    this.advanceStep()
    this.version++
    return true
  }

  // ---------------------------------------------------------------------------
  // Playing the steps
  // ---------------------------------------------------------------------------

  private jumpTo(label: string): void {
    const target = this.steps.findIndex(s => s.type === 'label' && s.name === label)
    if (target < 0) throw new Error(`Cutscene: no label "${label}"`)
    this.index = target
  }

  private advanceStep(): void {
    // Steps that do not wait run straight through; the loop stops at the first one that waits (text, a question, a wait, a fade).
    for (let guard = 0; guard < 10000; guard++) {
      this.index++
      const step = this.steps[this.index]
      if (!step) {
        this.state.finished = true
        this.state.text = null
        this.state.prompt = null
        this.version++
        return
      }
      this.version++
      switch (step.type) {
        case 'text': {
          const lines = step.lines.map(l => interpolate(l, this.vars))
          this.state.text = { speaker: step.speaker, lines, lineIndex: 0, revealed: 0, line: lines[0] ?? '' }
          return
        }
        case 'showSprite': {
          this.state.sprites = this.state.sprites.filter(s => s.id !== step.id)
          const anim = step.anim ?? 'slide'
          this.state.sprites.push({ id: step.id, sprite: step.sprite, at: step.at ?? 'center', progress: anim === 'none' ? 1 : 0, anim, leaving: null })
          break
        }
        case 'hideSprite': {
          const sprite = this.state.sprites.find(s => s.id === step.id)
          const how = step.anim ?? 'fade'
          if (sprite) {
            if (how === 'none') this.state.sprites = this.state.sprites.filter(s => s !== sprite)
            else {
              sprite.leaving = how
              sprite.progress = 1
            }
          }
          break
        }
        case 'playCry':
          this.hooks.cry?.(step.speciesId)
          break
        case 'playMusic':
          this.hooks.music?.(step.id)
          break
        case 'jingle':
          this.hooks.jingle?.(step.id)
          break
        case 'input':
          this.state.prompt = { kind: 'input', name: step.name, prompt: interpolate(step.prompt, this.vars), suggestions: step.suggestions, maxLength: step.maxLength }
          return
        case 'choice':
          this.state.prompt = { kind: 'choice', name: step.name, prompt: step.prompt ? interpolate(step.prompt, this.vars) : undefined, options: step.options }
          return
        case 'fade':
          if (step.ms <= 0) this.state.blackness = step.to === 'black' ? 1 : 0
          else {
            this.fade = { from: this.state.blackness, to: step.to === 'black' ? 1 : 0, ms: step.ms, elapsed: 0 }
            return
          }
          break
        case 'wait':
          if (step.ms > 0) {
            this.waitLeft = step.ms
            return
          }
          break
        case 'highlight':
          this.state.illustration = step.illustration
          break
        case 'label':
          break
        case 'jump':
          if (!step.when || this.vars[step.when.variable] === step.when.equals) this.jumpTo(step.to)
          break
        case 'run': {
          const to = step.fn(this.vars)
          if (typeof to === 'string') this.jumpTo(to)
          break
        }
      }
    }
    throw new Error('Cutscene: too many steps without waiting (a loop without text?)')
  }
}
