import { defineStore } from 'pinia'
import { ref } from 'vue'
import { gameData } from '~~/nudge/data'
import { BALANCE } from '~~/nudge/engine/balance'
import { createTrainerPokemon, createWildPokemon } from '~~/nudge/engine/ai'
import { createPokemon, displayNameOf } from '~~/nudge/engine/pokemon'
import { applyBattleOutcome, evolvePokemon, learnMove, type LevelUpInfo } from '~~/nudge/engine/progression'
import { createRandomRng } from '~~/nudge/engine/rng'
import type { BattleKind, BattleOutcome, OwnedPokemon } from '~~/nudge/engine/types'
import { STARTER_BALLS, STARTER_LEVEL, tmId } from '~~/nudge/game/items'
import { TRAINERS } from '~~/nudge/game/trainers'
import { newWorldState, type WildEncounter } from '~~/nudge/game/world'
import type { NpcAction, TrainerDef, WorldState } from '~~/nudge/game/types'
import { useBattleStore } from './battle'
import { usePlayerStore } from './player'
import { useWorldStore } from './world'

export type Screen = 'overworld' | 'transition' | 'battle'

export type Overlay =
  | { kind: 'starter' }
  | { kind: 'shop', shopId: string }
  | { kind: 'learn', uid: string, move: string }
  | { kind: 'evolve', uid: string, to: number }

/** One step of what happens after a battle (dialogs, choices, side effects), played in order. */
type PostStep =
  | { type: 'dialog', lines: string[], speaker?: string }
  | { type: 'learn', uid: string, move: string }
  | { type: 'evolve', uid: string, to: number }
  | { type: 'run', run: () => void }

interface BattleContext {
  kind: BattleKind
  trainer?: TrainerDef
}

const SHOP_BY_MAP: Record<string, string> = { gruss_mart: 'gruss_mart' }

/** Ties the overworld, the battle screen, the player's belongings and the story together. */
export const useGameStore = defineStore('nudgeGame', () => {
  const player = usePlayerStore()
  const world = useWorldStore()
  const battle = useBattleStore()

  const screen = ref<Screen>('overworld')
  const overlay = ref<Overlay | null>(null)
  let context: BattleContext | null = null
  let queue: PostStep[] = []

  // ---------------------------------------------------------------------------
  // Starting a game
  // ---------------------------------------------------------------------------

  function install() {
    world.setHooks({
      onEncounter: startWildBattle,
      onTrainer: onTrainer,
      onAction: onAction,
      onStepsChanged: () => player.addSteps(1),
    })
  }

  function newGame(state: WorldState = newWorldState()) {
    player.reset()
    world.start(state)
    screen.value = 'overworld'
    overlay.value = null
    queue = []
    context = null
    install()
  }

  /** Resumes with already-loaded player/world state (used by loading a save). */
  function resume(state: WorldState) {
    world.start(state)
    screen.value = 'overworld'
    overlay.value = null
    queue = []
    context = null
    install()
  }

  // ---------------------------------------------------------------------------
  // NPC actions
  // ---------------------------------------------------------------------------

  function onAction(action: NpcAction, _npcId: string) {
    const w = world.world
    if (!w) return
    switch (action) {
      case 'heal':
        player.healAll(true)
        w.rememberCenter()
        break
      case 'shop':
        world.setBusy(true)
        overlay.value = { kind: 'shop', shopId: SHOP_BY_MAP[w.state.mapId] ?? 'gruss_mart' }
        break
      case 'starter':
        if (!w.hasFlag('starter')) {
          world.setBusy(true)
          overlay.value = { kind: 'starter' }
        }
        break
      default:
        break
    }
  }

  function chooseStarter(speciesId: number) {
    const w = world.world
    if (!w) return
    const pokemon = createPokemon({
      data: gameData, balance: BALANCE, rng: createRandomRng(), speciesId, level: STARTER_LEVEL,
      trust: BALANCE.TRUST_START_STARTER, originalTrainer: player.name, caughtAt: Date.now(),
    })
    player.addPokemon(pokemon)
    player.addItem('poke-ball', STARTER_BALLS)
    w.setFlag('starter')
    overlay.value = null
    world.setBusy(false)
    world.openDialog([
      `Du valde ${displayNameOf(gameData, pokemon)}!`,
      `Professorn gav dig också ${STARTER_BALLS} Poké Balls.`,
      'Nu kan du lämna Hemstad. Lycka till på resan!',
    ])
  }

  function closeShop() {
    overlay.value = null
    world.setBusy(false)
  }

  // ---------------------------------------------------------------------------
  // Battles
  // ---------------------------------------------------------------------------

  function startWildBattle(encounter: WildEncounter) {
    if (!player.hasAbleParty) return
    world.setBusy(true)
    const enemy = createWildPokemon({
      data: gameData, balance: BALANCE, rng: createRandomRng(), speciesId: encounter.speciesId, level: encounter.level,
    })
    begin({ kind: 'wild' }, [enemy])
  }

  function onTrainer(trainerId: string, _spotted: boolean) {
    const def = TRAINERS[trainerId]
    if (!def || !player.hasAbleParty) {
      world.setBusy(false)
      return
    }
    world.setBusy(true)
    world.openDialog(def.intro, `${def.title} ${def.name}`, () => {
      world.setBusy(true)
      const enemy = def.team.map(mon => createTrainerPokemon({
        data: gameData, balance: BALANCE, rng: createRandomRng(), speciesId: mon.speciesId, level: mon.level,
        moves: mon.moves, heldItem: mon.heldItem, trainerName: def.name,
      }))
      begin({ kind: 'trainer', trainer: def }, enemy)
    })
  }

  function begin(ctx: BattleContext, enemy: OwnedPokemon[]) {
    context = ctx
    screen.value = 'transition'
    setTimeout(() => {
      battle.start({ player: player.party, enemy, kind: ctx.kind, badges: player.badges.length })
      screen.value = 'battle'
    }, 900)
  }

  /** The player pressed "Fortsätt" on the battle result screen. */
  function finishBattle(outcome: BattleOutcome | null) {
    battle.end()
    screen.value = 'overworld'
    const ctx = context
    context = null
    queue = []
    if (outcome) buildPostBattle(outcome, ctx)
    runQueue()
  }

  function nameOf(uid: string): string {
    const p = player.findPokemon(uid)
    return p ? displayNameOf(gameData, p) : 'Pokémonen'
  }

  function buildPostBattle(outcome: BattleOutcome, ctx: BattleContext | null) {
    const result = applyBattleOutcome(gameData, BALANCE, player.party, outcome)
    const w = world.world

    if (outcome.result === 'lose') {
      queue.push({ type: 'dialog', lines: ['Du har inga Pokémon kvar som kan slåss...', 'Allt blev svart!'] })
      queue.push({
        type: 'run',
        run: () => {
          const lost = Math.floor(player.money * BALANCE.BLACKOUT_MONEY_LOSS)
          player.money -= lost
          w?.blackout()
          world.teleport(w!.state.mapId, w!.state.x, w!.state.y, 'down')
          player.healAll(false)
          world.clearTrainer()
          queue.unshift({ type: 'dialog', lines: [`Du tappade ${lost} kr på vägen.`, 'Du vaknar upp igen, och dina Pokémon har blivit läkta.'] })
        },
      })
      return
    }

    if (outcome.result === 'caught' && outcome.caught) {
      const caught: OwnedPokemon = { ...outcome.caught, originalTrainer: player.name, caughtAt: Date.now() }
      const where = player.addPokemon(caught)
      const name = displayNameOf(gameData, caught)
      queue.push({
        type: 'dialog',
        lines: [where === 'party' ? `${name} lades till i ditt lag!` : `${name} skickades till boxen eftersom ditt lag är fullt.`],
      })
    }

    if (outcome.result === 'win' && ctx?.trainer) {
      const def = ctx.trainer
      const prize = BALANCE.TRAINER_MONEY_PER_LEVEL * Math.max(...def.team.map(m => m.level))
      queue.push({
        type: 'run',
        run: () => {
          w?.markDefeated(def.id)
          player.money += prize
        },
      })
      queue.push({ type: 'dialog', lines: [...def.defeated, `Du fick ${prize} kr för segern!`], speaker: `${def.title} ${def.name}` })
      if (def.gym) {
        const gym = def.gym
        queue.push({
          type: 'run',
          run: () => {
            if (!player.badges.includes(gym.badge)) player.badges.push(gym.badge)
            w?.setFlag(`badge-${gym.badge}`)
            player.addItem(tmId(gym.tm))
          },
        })
        queue.push({ type: 'dialog', lines: [...gym.rewardDialog, `Du fick ${gym.badgeName}!`], speaker: `${def.title} ${def.name}` })
      }
    }

    // Level-ups, new moves and evolutions, in the order they happened.
    for (const info of result.levelUps) queueLevelUp(info)
  }

  function queueLevelUp(info: LevelUpInfo) {
    const name = nameOf(info.uid)
    queue.push({ type: 'dialog', lines: [`${name} nådde nivå ${info.to}!`] })
    for (const move of info.learned) {
      queue.push({ type: 'dialog', lines: [`${name} lärde sig ${gameData.moves[move]?.displayName ?? move}!`] })
    }
    for (const move of info.pendingMoves) queue.push({ type: 'learn', uid: info.uid, move })
    if (info.evolveTo) queue.push({ type: 'evolve', uid: info.uid, to: info.evolveTo })
  }

  function runQueue() {
    const step = queue.shift()
    if (!step) {
      world.clearTrainer()
      world.setBusy(false)
      return
    }
    world.setBusy(true)
    switch (step.type) {
      case 'dialog':
        world.openDialog(step.lines, step.speaker, runQueue)
        break
      case 'run':
        step.run()
        runQueue()
        break
      case 'learn':
        overlay.value = { kind: 'learn', uid: step.uid, move: step.move }
        break
      case 'evolve':
        overlay.value = { kind: 'evolve', uid: step.uid, to: step.to }
        break
    }
  }

  /** `replaceIndex` = which of the four moves to forget, or null to skip learning the new one. */
  function resolveLearn(replaceIndex: number | null) {
    const o = overlay.value
    overlay.value = null
    if (o?.kind !== 'learn') return runQueue()
    const pokemon = player.findPokemon(o.uid)
    const moveName = gameData.moves[o.move]?.displayName ?? o.move
    if (pokemon && replaceIndex !== null) {
      const forgotten = pokemon.moves[replaceIndex]?.move
      learnMove(gameData, pokemon, o.move, replaceIndex, BALANCE)
      queue.unshift({
        type: 'dialog',
        lines: [`${displayNameOf(gameData, pokemon)} glömde ${gameData.moves[forgotten ?? '']?.displayName ?? 'en attack'} och lärde sig ${moveName}!`],
      })
    } else if (pokemon) {
      queue.unshift({ type: 'dialog', lines: [`${displayNameOf(gameData, pokemon)} lärde sig inte ${moveName}.`] })
    }
    runQueue()
  }

  function resolveEvolve(accept: boolean) {
    const o = overlay.value
    overlay.value = null
    if (o?.kind !== 'evolve') return runQueue()
    const pokemon = player.findPokemon(o.uid)
    if (pokemon) {
      const before = displayNameOf(gameData, pokemon)
      if (accept) {
        evolvePokemon(gameData, pokemon, o.to)
        if (!player.pokedex.includes(o.to)) player.pokedex.push(o.to)
        const after = gameData.species[o.to].displayName
        queue.unshift({ type: 'dialog', lines: [`${before} utvecklades till ${after}!`] })
      } else {
        queue.unshift({ type: 'dialog', lines: [`${before} utvecklades inte.`] })
      }
    }
    runQueue()
  }

  return {
    screen, overlay,
    install, newGame, resume, chooseStarter, closeShop, finishBattle, resolveLearn, resolveEvolve, startWildBattle, onTrainer, onAction,
  }
})
