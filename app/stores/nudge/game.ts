import { defineStore } from 'pinia'
import { ref } from 'vue'
import { gameData } from '~~/nudge/data'
import { BALANCE } from '~~/nudge/engine/balance'
import { createTrainerPokemon, createWildPokemon } from '~~/nudge/engine/ai'
import { createPokemon, displayNameOf } from '~~/nudge/engine/pokemon'
import { applyBattleOutcome, evolvePokemon, learnMove, type LevelUpInfo } from '~~/nudge/engine/progression'
import { createRandomRng } from '~~/nudge/engine/rng'
import type { BattleKind, BattleOutcome, OwnedPokemon } from '~~/nudge/engine/types'
import { battleMusic, mapMusic } from '~~/nudge/game/music'
import { STARTER_BALLS, STARTER_LEVEL, tmId } from '~~/nudge/game/items'
import { TRAINERS } from '~~/nudge/game/trainers'
import { newWorldState, type WildEncounter } from '~~/nudge/game/world'
import { parseSave, SAVE_KEY, serializeSave, summarizeSave, type SaveSummary } from '~~/nudge/game/save'
import { readItem, removeItem, writeItem } from './storage'
import type { NpcAction, TrainerDef, WorldState } from '~~/nudge/game/types'
import { useAudioStore } from './audio'
import { useBattleStore } from './battle'
import { usePlayerStore } from './player'
import { useWorldStore } from './world'

export type Screen = 'overworld' | 'transition' | 'battle'

export type Overlay =
  | { kind: 'starter' }
  | { kind: 'shop', shopId: string }
  | { kind: 'learn', uid: string, move: string }
  | { kind: 'evolve', uid: string, to: number }
  | { kind: 'pc' }
  | { kind: 'nickname', uid: string }
  | { kind: 'favorite', uid: string, move: string, previous?: string }

/** One step of what happens after a battle (dialogs, choices, side effects), played in order. */
type PostStep =
  | { type: 'dialog', lines: string[], speaker?: string }
  | { type: 'learn', uid: string, move: string }
  | { type: 'evolve', uid: string, to: number }
  | { type: 'nickname', uid: string }
  | { type: 'favorite', uid: string, move: string, previous?: string }
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
  const audio = useAudioStore()

  const screen = ref<Screen>('overworld')
  const overlay = ref<Overlay | null>(null)
  let context: BattleContext | null = null
  let queue: PostStep[] = []
  let autosaveAfterQueue = false

  // ---------------------------------------------------------------------------
  // Starting a game
  // ---------------------------------------------------------------------------

  /** The music of the map the player is on (null = silence). */
  function playMapMusic() {
    const w = world.world
    audio.music(w ? mapMusic(w.state.mapId) : null)
  }

  function install() {
    world.setHooks({
      onEncounter: startWildBattle,
      onTrainer: onTrainer,
      onAction: onAction,
      onStepsChanged: () => player.addSteps(1),
      onMapChanged: () => {
        playMapMusic()
        save(true)
      },
    })
  }

  // ---------------------------------------------------------------------------
  // Saving
  // ---------------------------------------------------------------------------

  /** Writes the game to localStorage. Returns false when there is nothing to save or storage failed. */
  function save(silent = false): boolean {
    const w = world.world
    if (!w || !player.party.length) return false
    const ok = writeItem(SAVE_KEY, serializeSave(player.serialize(), JSON.parse(JSON.stringify(w.state))))
    if (!silent) world.notify(ok ? 'Spelet sparades.' : 'Kunde inte spara (lagringen är full eller avstängd).')
    return ok
  }

  function savedGame(): SaveSummary | null {
    const result = parseSave(readItem(SAVE_KEY))
    return result.ok ? summarizeSave(result.save) : null
  }

  function hasSave(): boolean {
    return parseSave(readItem(SAVE_KEY)).ok
  }

  /** Loads the saved game. Returns false when there is no valid save. */
  function loadSave(): boolean {
    const result = parseSave(readItem(SAVE_KEY))
    if (!result.ok) return false
    player.hydrate(result.save.player)
    resume(result.save.world)
    return true
  }

  function deleteSave() {
    removeItem(SAVE_KEY)
  }

  function newGame(state: WorldState = newWorldState()) {
    player.reset()
    world.start(state)
    playMapMusic()
    screen.value = 'overworld'
    overlay.value = null
    queue = []
    context = null
    install()
  }

  /** Resumes with already-loaded player/world state (used by loading a save). */
  function resume(state: WorldState) {
    world.start(state)
    playMapMusic()
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
        void audio.jingle('heal')
        w.rememberCenter()
        break
      case 'shop':
        world.setBusy(true)
        overlay.value = { kind: 'shop', shopId: SHOP_BY_MAP[w.state.mapId] ?? 'gruss_mart' }
        break
      case 'pc':
        world.setBusy(true)
        overlay.value = { kind: 'pc' }
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
    void audio.jingle('item')
    w.setFlag('starter')
    overlay.value = null
    world.setBusy(false)
    save(true)
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

  function closePc() {
    overlay.value = null
    world.setBusy(false)
    save(true)
  }

  /** `null` skips the nickname. */
  function resolveNickname(nickname: string | null) {
    const o = overlay.value
    overlay.value = null
    if (o?.kind === 'nickname' && nickname) player.setNickname(o.uid, nickname)
    runQueue()
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
    audio.sfx('encounter')
    audio.music(battleMusic(ctx.kind, ctx.trainer))
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
    playMapMusic()
    if (outcome) buildPostBattle(outcome, ctx)
    autosaveAfterQueue = true
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
          playMapMusic()
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
      queue.push({ type: 'nickname', uid: caught.uid })
    }

    if (outcome.result === 'win' && ctx?.trainer) {
      const def = ctx.trainer
      const prize = BALANCE.TRAINER_MONEY_PER_LEVEL * Math.max(...def.team.map(m => m.level))
      queue.push({
        type: 'run',
        run: () => {
          w?.markDefeated(def.id)
          player.money += prize
          audio.sfx('coin')
        },
      })
      queue.push({ type: 'dialog', lines: [...def.defeated, `Du fick ${prize} kr för segern!`], speaker: `${def.title} ${def.name}` })
      if (def.gym) {
        const gym = def.gym
        queue.push({
          type: 'run',
          run: () => {
            if (!player.badges.includes(gym.badge)) player.badges.push(gym.badge)
            void audio.jingle('badge')
            w?.setFlag(`badge-${gym.badge}`)
            player.addItem(tmId(gym.tm))
          },
        })
        queue.push({ type: 'dialog', lines: [...gym.rewardDialog, `Du fick ${gym.badgeName}!`], speaker: `${def.title} ${def.name}` })
      }
    }

    // Level-ups, new moves and evolutions, in the order they happened.
    for (const info of result.levelUps) queueLevelUp(info)

    // A favorite move forming (or changing) is shown after the level-ups.
    for (const fav of result.favorites) queue.push({ type: 'favorite', uid: fav.uid, move: fav.move, previous: fav.previous })
  }

  function queueLevelUp(info: LevelUpInfo) {
    const name = nameOf(info.uid)
    queue.push({ type: 'run', run: () => { void audio.jingle('levelUp') } })
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
      if (autosaveAfterQueue) {
        autosaveAfterQueue = false
        save(true)
      }
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
      case 'nickname':
        overlay.value = { kind: 'nickname', uid: step.uid }
        break
      case 'favorite':
        void audio.jingle('favorite')
        overlay.value = { kind: 'favorite', uid: step.uid, move: step.move, previous: step.previous }
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
      const lostFavorite = learnMove(gameData, pokemon, o.move, replaceIndex, BALANCE)
      const lines = [`${displayNameOf(gameData, pokemon)} glömde ${gameData.moves[forgotten ?? '']?.displayName ?? 'en attack'} och lärde sig ${moveName}!`]
      if (lostFavorite) lines.push(`${displayNameOf(gameData, pokemon)} verkar ledsen över att ha glömt sin favorit.`)
      queue.unshift({ type: 'dialog', lines })
    } else if (pokemon) {
      queue.unshift({ type: 'dialog', lines: [`${displayNameOf(gameData, pokemon)} lärde sig inte ${moveName}.`] })
    }
    runQueue()
  }

  function resolveFavorite() {
    if (overlay.value?.kind === 'favorite') overlay.value = null
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
        void audio.jingle('evolution')
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
    install, newGame, resume, save, savedGame, hasSave, loadSave, deleteSave, chooseStarter, closeShop, closePc, resolveNickname, finishBattle, resolveLearn, resolveEvolve, resolveFavorite, startWildBattle, onTrainer, onAction,
  }
})
