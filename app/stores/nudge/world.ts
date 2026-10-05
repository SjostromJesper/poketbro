import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import { BALANCE } from '~~/nudge/engine/balance'
import { createRng } from '~~/nudge/engine/rng'
import { getMap } from '~~/nudge/game/maps'
import type { Direction, NpcAction, PickupDef, WorldState } from '~~/nudge/game/types'
import { newWorldState, World, type Trigger, type WildEncounter } from '~~/nudge/game/world'
import type { SpriteKey } from '~~/nudge/game/sprites'
import { DIRECTIONS, OPPOSITE } from '~~/nudge/game/types'
import { useAudioStore } from './audio'

export type WorldMode = 'walk' | 'dialog' | 'fade' | 'menu' | 'busy'

export interface DialogState {
  speaker?: string
  /** Face portrait shown next to the text. */
  portrait?: SpriteKey
  lines: string[]
  index: number
  /** Number of characters of the current line that are visible (typewriter). */
  revealed: number
  onDone?: () => void
}

/** Callbacks the game page installs to hook the overworld up to battles, shops, healing, ... (M5+). */
export interface WorldHooks {
  onEncounter?: (encounter: WildEncounter) => void
  onTrainer?: (trainerId: string, spotted: boolean) => void
  onAction?: (action: NpcAction, npcId: string) => void
  onMapChanged?: (mapId: string) => void
  onStepsChanged?: (steps: number) => void
  /** The player talked to the water (interact while facing it): the game checks for a fishing rod. */
  onWater?: () => void
  onPickup?: (pickup: PickupDef) => void
}

const KEY_DIRECTIONS: Record<string, Direction> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right',
}

const TURN_MS = 110
const FADE_MS = 170
const TYPE_CHARS_PER_SECOND = 55
const BANNER_MS = 2200

interface StepAnimation {
  fromX: number
  fromY: number
  toX: number
  toY: number
  elapsed: number
  duration: number
  triggers: Trigger[]
}

/** The overworld: the World logic plus the real-time parts (input, step animation, fades, dialog typewriter). */
export const useWorldStore = defineStore('nudgeWorld', () => {
  const audio = useAudioStore()
  const world = shallowRef<World | null>(null)
  const mode = ref<WorldMode>('walk')
  const dialog = ref<DialogState | null>(null)
  const banner = ref<{ text: string, until: number } | null>(null)
  const menuOpen = ref(false)

  /** Read by the canvas every frame (plain object on purpose: it changes 60 times per second). */
  const visual = {
    x: 0, y: 0, walk: -1, fade: 0, time: 0,
    spotted: null as null | { id: string, until: number },
    /** A trainer that walked up to the player is drawn here instead of at its spot (until clearTrainer()). */
    trainerPos: null as null | { id: string, x: number, y: number, walking: boolean },
  }

  let anim: StepAnimation | null = null
  let held: Direction[] = []
  let running = false
  let turnTimer = 0
  let fadePhase: null | { stage: 'out' | 'in', elapsed: number, warp?: Extract<Trigger, { type: 'warp' }>['warp'] } = null
  let hooks: WorldHooks = {}
  /** Lets the open menu handle "back" itself (sub-screens) before the whole menu closes. Returns true when handled. */
  let menuBack: (() => boolean) | null = null
  let approach: null | {
    id: string
    phase: 'alert' | 'walk'
    elapsed: number
    fromX: number
    fromY: number
    toX: number
    toY: number
    duration: number
  } = null

  function setHooks(next: WorldHooks) {
    hooks = next
  }

  function setMenuBack(handler: (() => boolean) | null) {
    menuBack = handler
  }

  /** Shows a short message in the top-left banner (e.g. "Spelet sparades"). */
  function notify(text: string, ms = 1800) {
    banner.value = { text, until: visual.time + ms }
  }

  function start(state: WorldState = newWorldState(), seed = Math.floor(Math.random() * 0xFFFFFFFF)) {
    world.value = new World(state, createRng(seed), BALANCE)
    visual.x = state.x
    visual.y = state.y
    visual.walk = -1
    visual.fade = 0
    visual.trainerPos = null
    visual.spotted = null
    approach = null
    anim = null
    held = []
    fadePhase = null
    dialog.value = null
    menuOpen.value = false
    mode.value = 'walk'
    banner.value = null
  }

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------

  function keyDown(key: string) {
    const dir = KEY_DIRECTIONS[key]
    if (dir) {
      held = held.filter(d => d !== dir)
      held.push(dir)
      return
    }
    if (key === 'Shift') {
      running = true
      return
    }
    if (key === ' ' || key === 'Enter' || key === 'z' || key === 'Z') {
      action()
    } else if (key === 'Escape' || key === 'x' || key === 'X') {
      cancel()
    }
  }

  function keyUp(key: string) {
    const dir = KEY_DIRECTIONS[key]
    if (dir) held = held.filter(d => d !== dir)
    if (key === 'Shift') running = false
  }

  /** On-screen/touch style direction press (also used by tests). */
  function holdDirection(dir: Direction | null) {
    held = dir ? [dir] : []
  }

  function action() {
    if (mode.value === 'dialog') {
      advanceDialog()
    } else if (mode.value === 'walk' && !anim && world.value) {
      const result = world.value.interact()
      if (!result) return
      if (result.type === 'dialog') {
        const { action: npcAction, npcId } = result
        openDialog(result.lines, result.speaker, npcAction && npcId ? () => hooks.onAction?.(npcAction, npcId) : undefined, result.portrait)
      } else if (result.type === 'water') {
        hooks.onWater?.()
      } else if (result.type === 'pickup') {
        hooks.onPickup?.(result.pickup)
      } else {
        hooks.onTrainer?.(result.trainerId, false)
      }
    }
  }

  function cancel() {
    if (mode.value === 'dialog') {
      advanceDialog()
    } else if (mode.value === 'menu') {
      if (!menuBack?.()) closeMenu()
    } else if (mode.value === 'walk' && !anim) {
      openMenu()
    }
  }

  function openMenu() {
    held = []
    menuOpen.value = true
    mode.value = 'menu'
  }

  function closeMenu() {
    menuOpen.value = false
    mode.value = 'walk'
  }

  // ---------------------------------------------------------------------------
  // Dialog
  // ---------------------------------------------------------------------------

  function openDialog(lines: string[], speaker?: string, onDone?: () => void, portrait?: SpriteKey) {
    held = []
    dialog.value = { speaker, portrait, lines, index: 0, revealed: 0, onDone }
    mode.value = 'dialog'
  }

  function advanceDialog() {
    const d = dialog.value
    if (!d) return
    const line = d.lines[d.index] ?? ''
    if (d.revealed < line.length) {
      d.revealed = line.length
      return
    }
    if (d.index + 1 < d.lines.length) {
      d.index++
      d.revealed = 0
      return
    }
    dialog.value = null
    mode.value = 'walk'
    d.onDone?.()
  }

  // ---------------------------------------------------------------------------
  // Frame update
  // ---------------------------------------------------------------------------

  function update(dtMs: number) {
    const w = world.value
    if (!w) return
    visual.time += dtMs
    const dt = Math.min(dtMs, 100)

    if (banner.value && visual.time > banner.value.until) banner.value = null
    if (visual.spotted && visual.time > visual.spotted.until) visual.spotted = null

    if (mode.value === 'dialog' && dialog.value) {
      const line = dialog.value.lines[dialog.value.index] ?? ''
      if (dialog.value.revealed < line.length) {
        dialog.value.revealed = Math.min(line.length, dialog.value.revealed + (TYPE_CHARS_PER_SECOND * dt) / 1000)
      }
      return
    }
    if (mode.value === 'fade') {
      updateFade(dt)
      return
    }
    if (mode.value === 'busy') {
      updateApproach(dt)
      return
    }
    if (mode.value !== 'walk') return

    if (anim) {
      anim.elapsed += dt
      const t = Math.min(1, anim.elapsed / anim.duration)
      visual.x = anim.fromX + (anim.toX - anim.fromX) * t
      visual.y = anim.fromY + (anim.toY - anim.fromY) * t
      visual.walk = t
      if (t >= 1) finishStep()
      return
    }

    visual.walk = -1
    const dir = held[held.length - 1]
    if (!dir) {
      turnTimer = 0
      return
    }
    if (w.state.facing !== dir) {
      w.turn(dir)
      turnTimer = TURN_MS
      return
    }
    if (turnTimer > 0) {
      turnTimer -= dt
      return
    }
    tryStep(dir)
  }

  let lastBump = 0
  /** A soft thud when walking into a wall (not more often than every 350 ms, even if the key is held). */
  function bumpSound() {
    const now = Date.now()
    if (now - lastBump < 350) return
    lastBump = now
    audio.sfx('bump')
  }

  function tryStep(dir: Direction) {
    const w = world.value
    if (!w) return
    const result = w.step(dir)
    if (result.kind === 'blocked') {
      if (result.reason !== 'gate') bumpSound()
      if (result.reason === 'gate' && result.dialog) {
        openDialog(result.dialog)
        // Step the player back from the gate so holding the key does not re-trigger it instantly.
        held = []
      }
      return
    }
    anim = {
      fromX: result.from.x,
      fromY: result.from.y,
      toX: result.to.x,
      toY: result.to.y,
      elapsed: 0,
      duration: running ? BALANCE.RUN_STEP_MS : BALANCE.WALK_STEP_MS,
      triggers: result.triggers,
    }
    hooks.onStepsChanged?.(w.state.steps)
  }

  function finishStep() {
    const w = world.value
    const finished = anim
    anim = null
    if (!w || !finished) return
    visual.x = finished.toX
    visual.y = finished.toY
    visual.walk = -1

    const warp = finished.triggers.find((t): t is Extract<Trigger, { type: 'warp' }> => t.type === 'warp')
    if (warp) {
      beginWarp(warp.warp)
      return
    }
    const sight = finished.triggers.find((t): t is Extract<Trigger, { type: 'trainer-sight' }> => t.type === 'trainer-sight')
    if (sight) {
      beginApproach(sight.trainerId)
      return
    }
    if (finished.triggers.some(t => t.type === 'grass')) {
      const encounter = w.rollEncounter()
      if (encounter) {
        held = []
        hooks.onEncounter?.(encounter)
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Trainers that spot the player: "!", then they walk up to you
  // ---------------------------------------------------------------------------

  function beginApproach(trainerId: string) {
    const w = world.value
    const spot = w?.map.trainers.find(t => t.id === trainerId)
    if (!w || !spot) return
    held = []
    mode.value = 'busy'
    const { dx, dy } = DIRECTIONS[spot.facing]
    // Stand right in front of the player, on the line of sight.
    const toX = w.state.x - dx
    const toY = w.state.y - dy
    const tiles = Math.abs(toX - spot.x) + Math.abs(toY - spot.y)
    visual.spotted = { id: trainerId, until: visual.time + 800 }
    w.turn(OPPOSITE[spot.facing])
    approach = { id: trainerId, phase: 'alert', elapsed: 0, fromX: spot.x, fromY: spot.y, toX, toY, duration: Math.max(0, tiles) * BALANCE.WALK_STEP_MS }
  }

  function updateApproach(dt: number) {
    const a = approach
    if (!a) return
    a.elapsed += dt
    if (a.phase === 'alert') {
      if (a.elapsed < 800) return
      a.phase = 'walk'
      a.elapsed = 0
    }
    const t = a.duration > 0 ? Math.min(1, a.elapsed / a.duration) : 1
    visual.trainerPos = { id: a.id, x: a.fromX + (a.toX - a.fromX) * t, y: a.fromY + (a.toY - a.fromY) * t, walking: t < 1 }
    if (t >= 1) {
      approach = null
      hooks.onTrainer?.(a.id, true)
    }
  }

  /** Puts the trainer back on its spot (after the fight). */
  function clearTrainer() {
    visual.trainerPos = null
    visual.spotted = null
  }

  function setBusy(busy: boolean) {
    held = []
    mode.value = busy ? 'busy' : 'walk'
  }

  // ---------------------------------------------------------------------------
  // Warps (fade out, move, fade in)
  // ---------------------------------------------------------------------------

  function beginWarp(warp: Extract<Trigger, { type: 'warp' }>['warp']) {
    held = []
    audio.sfx('door')
    fadePhase = { stage: 'out', elapsed: 0, warp }
    mode.value = 'fade'
  }

  function updateFade(dt: number) {
    const w = world.value
    if (!fadePhase || !w) {
      mode.value = 'walk'
      return
    }
    fadePhase.elapsed += dt
    const t = Math.min(1, fadePhase.elapsed / FADE_MS)
    if (fadePhase.stage === 'out') {
      visual.fade = t
      if (t >= 1 && fadePhase.warp) {
        const before = w.state.mapId
        w.applyWarp(fadePhase.warp)
        visual.x = w.state.x
        visual.y = w.state.y
        if (w.state.mapId !== before) {
          banner.value = { text: getMap(w.state.mapId).name, until: visual.time + BANNER_MS }
          hooks.onMapChanged?.(w.state.mapId)
        }
        fadePhase = { stage: 'in', elapsed: 0 }
      }
    } else {
      visual.fade = 1 - t
      if (t >= 1) {
        fadePhase = null
        visual.fade = 0
        mode.value = 'walk'
      }
    }
  }

  /** Jumps to a place without animation (after a blackout, dev shortcuts, loading). */
  function teleport(mapId: string, x: number, y: number, facing: Direction = 'down') {
    const w = world.value
    if (!w) return
    w.state.mapId = mapId
    w.state.x = x
    w.state.y = y
    w.state.facing = facing
    visual.x = x
    visual.y = y
    anim = null
    held = []
  }

  return {
    world, mode, dialog, banner, menuOpen, visual,
    setHooks, setMenuBack, notify, start, keyDown, keyUp, holdDirection, action, cancel, openMenu, closeMenu, openDialog, advanceDialog, update, teleport,
    clearTrainer, setBusy, beginApproach,
  }
})
