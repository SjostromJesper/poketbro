import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import { gameData } from '~~/nudge/data'
import { BALANCE } from '~~/nudge/engine/balance'
import { createTrainerPokemon, createWildPokemon } from '~~/nudge/engine/ai'
import { createPokemon, displayNameOf } from '~~/nudge/engine/pokemon'
import { evolvePokemon, learnMove } from '~~/nudge/engine/progression'
import { createRandomRng } from '~~/nudge/engine/rng'
import type { BattleKind, BattleOutcome, OwnedPokemon } from '~~/nudge/engine/types'
import { themeForMap } from '~~/nudge/game/battleThemes'
import { battleMusic, mapMusic } from '~~/nudge/game/music'
import { applyAndNarrate, type SequenceStep } from '~~/nudge/game/postBattle'
import { STARTER_BALLS, STARTER_LEVEL, tmId } from '~~/nudge/game/items'
import { spriteFor, type SpriteKey } from '~~/nudge/game/sprites'
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
  | { kind: 'evolve', uid: string, to: number }
  | { kind: 'pc' }

/** One step of what happens after a battle (dialogs, choices, side effects), played in order. */
type PostStep =
  | { type: 'dialog', lines: string[], speaker?: string, portrait?: SpriteKey }
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
  const audio = useAudioStore()

  const screen = ref<Screen>('overworld')
  const overlay = ref<Overlay | null>(null)
  /** The steps of the battle scene after a battle (null while no battle has ended). */
  const sequence = shallowRef<SequenceStep[] | null>(null)
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
    }, spriteFor(def) ?? undefined)
  }

  function begin(ctx: BattleContext, enemy: OwnedPokemon[]) {
    context = ctx
    screen.value = 'transition'
    audio.sfx('encounter')
    audio.music(battleMusic(ctx.kind, ctx.trainer))
    setTimeout(() => {
      battle.start({ player: player.party, enemy, kind: ctx.kind, badges: player.badges.length, theme: themeForMap(world.world?.state.mapId ?? '') })
      screen.value = 'battle'
    }, 900)
  }

  /** The battle scene is done (the post-battle sequence has been played, or there was none): back to the map. */
  function finishBattle(_outcome?: BattleOutcome | null) {
    battle.end()
    sequence.value = null
    screen.value = 'overworld'
    context = null
    playMapMusic()
    autosaveAfterQueue = true
    runQueue()
  }

  function nameOf(uid: string): string {
    const p = player.findPokemon(uid)
    return p ? displayNameOf(gameData, p) : 'Pokémonen'
  }

  /**
   * The battle has ended: applies it to the game at once and builds the steps the battle scene plays (PLAN-3 2):
   * the faint, the trainer's words and prize, XP per Pokémon, level-ups with stats, new moves, trust and favorites.
   * Evolutions and a blackout come after the scene closes (the overworld queue).
   */
  function beginPostBattle(outcome: BattleOutcome) {
    const ctx = context
    const w = world.world
    const steps: SequenceStep[] = []
    queue = []

    const { steps: xpSteps, application } = applyAndNarrate(gameData, BALANCE, player.party, outcome)

    if (outcome.result === 'lose') {
      steps.push({ type: 'message', lines: ['Du har inga Pokémon kvar som kan slåss...', 'Allt blev svart!'] })
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
      sequence.value = steps
      return
    }

    if (outcome.result === 'win') {
      const last = outcome.defeated[outcome.defeated.length - 1]
      const foe = last ? (gameData.species[last.speciesId]?.displayName ?? 'Pokémonen') : 'Pokémonen'
      if (ctx?.trainer) {
        const def = ctx.trainer
        const speaker = `${def.title} ${def.name}`
        const portrait = spriteFor(def) ?? undefined
        const prize = BALANCE.TRAINER_MONEY_PER_LEVEL * Math.max(...def.team.map(m => m.level))
        w?.markDefeated(def.id)
        player.money += prize
        steps.push({ type: 'message', lines: [`${foe} svimmade!`, `Du besegrade ${speaker}!`] })
        steps.push({ type: 'message', lines: [...def.defeated, `Du fick ${prize} kr för segern!`], speaker, portrait })
      } else {
        steps.push({ type: 'message', lines: [`Vilda ${foe} svimmade!`] })
      }
    }

    if (outcome.result === 'caught' && outcome.caught) {
      const caught: OwnedPokemon = { ...outcome.caught, originalTrainer: player.name, caughtAt: Date.now() }
      const where = player.addPokemon(caught)
      const name = displayNameOf(gameData, caught)
      steps.push({
        type: 'message',
        lines: [where === 'party' ? `${name} lades till i ditt lag!` : `${name} skickades till boxen eftersom ditt lag är fullt.`],
      })
      steps.push({ type: 'nickname', uid: caught.uid })
    }

    steps.push(...xpSteps)

    // The gym leader's reward comes after the XP. Everything is applied now; the scene only tells it.
    if (outcome.result === 'win' && ctx?.trainer?.gym) {
      const def = ctx.trainer
      const gym = def.gym!
      if (!player.badges.includes(gym.badge)) player.badges.push(gym.badge)
      w?.setFlag(`badge-${gym.badge}`)
      player.addItem(tmId(gym.tm))
      steps.push({
        type: 'message',
        lines: [...gym.rewardDialog, `Du fick ${gym.badgeName}!`],
        speaker: `${def.title} ${def.name}`,
        portrait: spriteFor(def) ?? undefined,
        jingle: 'badge',
      })
    }

    // Evolutions are shown after the scene closes, in their own scene.
    for (const info of application.levelUps) if (info.evolveTo) queue.push({ type: 'evolve', uid: info.uid, to: info.evolveTo })

    sequence.value = steps
  }

  /** The player chose which move to forget (or none) while learning `move`. Returns the lines to show. */
  function learnChoice(uid: string, move: string, replaceIndex: number | null): string[] {
    const pokemon = player.findPokemon(uid)
    if (!pokemon) return []
    const name = displayNameOf(gameData, pokemon)
    const moveName = gameData.moves[move]?.displayName ?? move
    if (replaceIndex === null) return [`${name} lärde sig inte ${moveName}.`]
    const forgotten = pokemon.moves[replaceIndex]?.move
    const lostFavorite = learnMove(gameData, pokemon, move, replaceIndex, BALANCE)
    const lines = [`${name} glömde ${gameData.moves[forgotten ?? '']?.displayName ?? 'en attack'} och lärde sig ${moveName}!`]
    if (lostFavorite) lines.push(`${name} verkar ledsen över att ha glömt sin favorit.`)
    return lines
  }

  function giveNickname(uid: string, nickname: string | null) {
    if (nickname) player.setNickname(uid, nickname)
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
        world.openDialog(step.lines, step.speaker, runQueue, step.portrait)
        break
      case 'run':
        step.run()
        runQueue()
        break
      case 'evolve':
        overlay.value = { kind: 'evolve', uid: step.uid, to: step.to }
        break
    }
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
    install, newGame, resume, save, savedGame, hasSave, loadSave, deleteSave, chooseStarter, closeShop, closePc, sequence, beginPostBattle, learnChoice, giveNickname, finishBattle, resolveEvolve, startWildBattle, onTrainer, onAction,
  }
})
