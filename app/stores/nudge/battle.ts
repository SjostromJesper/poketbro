import { defineStore } from 'pinia'
import { computed, reactive, ref, shallowRef } from 'vue'
import { gameData } from '~~/nudge/data'
import { buildBattleView, type BattleView } from '~~/nudge/game/battleView'
import { BALANCE } from '~~/nudge/engine/balance'
import { BattleEngine } from '~~/nudge/engine/battle'
import { describeEvent } from '~~/nudge/engine/messages'
import { createRng } from '~~/nudge/engine/rng'
import type { ActionResult, BattleEvent, BattleKind, BattleOutcome, BattleResult, OwnedPokemon, PlayerAction, Side } from '~~/nudge/engine/types'
import { useSettingsStore } from './settings'

export interface LogLine {
  id: number
  text: string
  tone: 'normal' | 'good' | 'bad' | 'info'
}

export interface SideFx {
  anim: 'lunge' | 'hit' | 'enter' | null
  nonce: number
  fainted: boolean
}

export interface Floater {
  id: number
  side: Side
  text: string
  kind: 'damage' | 'heal' | 'crit' | 'weak' | 'strong'
}

export interface EmoteBubble {
  id: number
  side: Side
  emote: string
}

export interface StartOptions {
  player: OwnedPokemon[]
  enemy: OwnedPokemon[]
  kind: BattleKind
  badges?: number
  seed?: number
}

/** The running battle: owns the engine, drives it from the UI frame loop and turns events into log lines and animations. */
export const useBattleStore = defineStore('nudgeBattle', () => {
  const settings = useSettingsStore()

  const engine = shallowRef<BattleEngine | null>(null)
  const view = shallowRef<BattleView | null>(null)
  const log = ref<LogLine[]>([])
  const fx = reactive<Record<Side, SideFx>>({
    player: { anim: null, nonce: 0, fainted: false },
    enemy: { anim: null, nonce: 0, fainted: false },
  })
  const floaters = ref<Floater[]>([])
  const emotes = ref<EmoteBubble[]>([])
  const speed = ref(1)
  const paused = ref(false)
  const debug = ref(false)
  const result = ref<BattleResult | null>(null)
  const outcome = ref<BattleOutcome | null>(null)
  const active = computed(() => engine.value !== null)
  let nextId = 1

  function sync() {
    if (engine.value) view.value = buildBattleView(engine.value, debug.value)
  }

  function pushLog(text: string, tone: LogLine['tone'] = 'normal') {
    log.value.push({ id: nextId++, text, tone })
    if (log.value.length > 60) log.value.splice(0, log.value.length - 60)
  }

  function transient<T extends { id: number }>(list: { value: T[] }, item: Omit<T, 'id'>, ms: number) {
    const entry = { ...item, id: nextId++ } as T
    list.value.push(entry)
    setTimeout(() => {
      const index = list.value.findIndex(e => e.id === entry.id)
      if (index >= 0) list.value.splice(index, 1)
    }, ms)
  }

  function playAnim(side: Side, anim: SideFx['anim']) {
    fx[side].anim = anim
    fx[side].nonce++
  }

  function toneFor(event: BattleEvent): LogLine['tone'] {
    switch (event.type) {
      case 'faint': return event.side === 'enemy' ? 'good' : 'bad'
      case 'damage': return event.effectiveness > 1 ? 'good' : 'normal'
      case 'battle-end': return event.result === 'win' || event.result === 'caught' ? 'good' : event.result === 'lose' ? 'bad' : 'info'
      case 'ball-throw': return event.caught ? 'good' : 'info'
      case 'disobey': case 'status-skip': return 'info'
      default: return 'normal'
    }
  }

  function handleEvents(events: BattleEvent[]) {
    const eng = engine.value
    if (!eng) return
    for (const event of events) {
      const text = describeEvent(event, { kind: eng.state.kind, data: gameData })
      if (text) pushLog(text, toneFor(event))
      switch (event.type) {
        case 'send-out':
          fx[event.side].fainted = false
          playAnim(event.side, 'enter')
          break
        case 'move-used':
          playAnim(event.side, 'lunge')
          break
        case 'damage':
          if (event.source === 'status' || event.source === 'leech-seed') break
          playAnim(event.side, 'hit')
          if (event.amount > 0) {
            const kind = event.crit ? 'crit' : event.effectiveness > 1 ? 'strong' : event.effectiveness < 1 ? 'weak' : 'damage'
            transient(floaters, { side: event.side, text: `-${event.amount}`, kind } as Omit<Floater, 'id'>, 1100)
          }
          break
        case 'heal':
          if (event.source === 'leftovers' || event.source === 'leech-seed') break
          transient(floaters, { side: event.side, text: `+${event.amount}`, kind: 'heal' } as Omit<Floater, 'id'>, 1100)
          break
        case 'faint':
          fx[event.side].fainted = true
          break
        case 'emote':
          transient(emotes, { side: event.side, emote: event.emote } as Omit<EmoteBubble, 'id'>, 1300)
          break
        case 'battle-end':
          result.value = event.result
          outcome.value = eng.outcome
          break
        default:
          break
      }
    }
  }

  function start(options: StartOptions) {
    log.value = []
    floaters.value = []
    emotes.value = []
    fx.player = { anim: null, nonce: 0, fainted: false }
    fx.enemy = { anim: null, nonce: 0, fainted: false }
    result.value = null
    outcome.value = null
    paused.value = false
    speed.value = settings.battleSpeed
    const seed = options.seed ?? Math.floor(Math.random() * 0xFFFFFFFF)
    engine.value = new BattleEngine({
      player: options.player,
      enemy: options.enemy,
      kind: options.kind,
      rng: createRng(seed),
      balance: BALANCE,
      data: gameData,
      badges: options.badges ?? 0,
    })
    handleEvents(engine.value.tick(0))
    sync()
  }

  /** Called every animation frame with the real elapsed time. */
  function frame(realDtMs: number) {
    const eng = engine.value
    if (!eng) return
    if (!paused.value && !eng.finished) {
      // Cap the step so a background tab does not fast-forward the battle.
      handleEvents(eng.tick(Math.min(realDtMs, 100) * speed.value))
    }
    sync()
  }

  function setSpeed(value: number) {
    speed.value = value
    settings.battleSpeed = value
  }

  function togglePause() {
    paused.value = !paused.value
    engine.value?.setPaused(paused.value)
  }

  function nudge(moveIndex: number) {
    const eng = engine.value
    if (!eng) return
    const out = eng.nudge(moveIndex)
    handleEvents(out.events)
    sync()
  }

  function act(action: PlayerAction): ActionResult | null {
    const eng = engine.value
    if (!eng) return null
    const res = eng.playerAction(action)
    handleEvents(res.events)
    sync()
    return res
  }

  function end() {
    engine.value = null
    view.value = null
  }

  return { engine, view, log, fx, floaters, emotes, speed, paused, debug, result, outcome, active, start, frame, setSpeed, togglePause, nudge, act, end, sync }
})
