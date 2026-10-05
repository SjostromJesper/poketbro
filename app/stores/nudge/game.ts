import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import { gameData } from '~~/nudge/data'
import { BALANCE, type TraitId } from '~~/nudge/engine/balance'
import { createTrainerPokemon, createWildPokemon } from '~~/nudge/engine/ai'
import { createPokemon, displayNameOf } from '~~/nudge/engine/pokemon'
import { evolvePokemon, learnMove, stoneEvolution } from '~~/nudge/engine/progression'
import type { Rod } from '~~/nudge/game/encounters'
import type { GiveDef, PickupDef } from '~~/nudge/game/types'
import { createRandomRng } from '~~/nudge/engine/rng'
import { randomNatureName, randomTrait } from '~~/nudge/engine/formulas'
import * as TUT from '~~/nudge/game/text/tutorial'
import { NOTES_BY_ID, type NoteId } from '~~/nudge/game/text/notes'
import { useSettingsStore } from './settings'
import { useAccountStore } from './account'
import type { BattleKind, BattleOutcome, OwnedPokemon } from '~~/nudge/engine/types'
import { themeForMap } from '~~/nudge/game/battleThemes'
import { battleMusic, mapMusic } from '~~/nudge/game/music'
import { DEFAULT_PLAYER_NAME, DEFAULT_RIVAL_NAME, fillNames, setNames } from '~~/nudge/game/names'
import { rivalTeam } from '~~/nudge/game/rival'
import { applyAndNarrate, type SequenceStep } from '~~/nudge/game/postBattle'
import { itemInfo, STARTERS, STARTER_BALLS, STARTER_LEVEL, tmId } from '~~/nudge/game/items'
import { spriteFor, type SpriteKey } from '~~/nudge/game/sprites'
import { TRAINERS } from '~~/nudge/game/trainers'
import { newWorldState, type WildEncounter } from '~~/nudge/game/world'
import { SAVE_VERSION, summarizeSave, type SaveData, type SaveSummary } from '~~/nudge/game/save'
import type { Slot } from '~~/nudge/game/saveSlots'
import type { NpcAction, TrainerDef, TrainerMon, WorldState } from '~~/nudge/game/types'
import { useAudioStore } from './audio'
import { useBattleStore } from './battle'
import { useSavesStore } from './saves'
import { usePlayerStore } from './player'
import { useWorldStore } from './world'

export type Screen = 'overworld' | 'transition' | 'battle' | 'intro'

export type Overlay =
  | { kind: 'starter' }
  | { kind: 'shop', shopId: string }
  | { kind: 'evolve', uid: string, to: number }
  | { kind: 'pc' }
  | { kind: 'gift', npcId: string, options: { speciesId: number, level: number }[] }
  | { kind: 'travel' }

/** One step of what happens after a battle (dialogs, choices, side effects), played in order. */
type PostStep =
  | { type: 'dialog', lines: string[], speaker?: string, portrait?: SpriteKey }
  | { type: 'evolve', uid: string, to: number }
  | { type: 'run', run: () => void }

interface BattleContext {
  kind: BattleKind
  trainer?: TrainerDef
  /** The guided first battle against the rival in the lab. */
  tutorial?: boolean
  /** The professor's pauses are on (off when the intro was skipped). */
  guided?: boolean
}


/** Ties the overworld, the battle screen, the player's belongings and the story together. */
export const useGameStore = defineStore('nudgeGame', () => {
  const player = usePlayerStore()
  const world = useWorldStore()
  const battle = useBattleStore()
  const audio = useAudioStore()
  const saves = useSavesStore()
  const settings = useSettingsStore()
  const account = useAccountStore()
  /** When the running session began (for the play time). */
  let sessionStart = Date.now()
  /** Dev shortcut sessions (`?map=...`) never write to a save slot. */
  let ephemeral = false
  function setEphemeral(value: boolean) { ephemeral = value }

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

  /** The world's gates open with the badge count. */
  function syncBadges() {
    if (world.world) world.world.badgeCount = player.badges.length
  }

  function install() {
    syncBadges()
    world.setHooks({
      onEncounter: startWildBattle,
      onTrainer: onTrainer,
      onAction: onAction,
      onStepsChanged: () => player.addSteps(1),
      onWater: startFishing,
      onPickup: pickUp,
      onMapChanged: () => {
        playMapMusic()
        save(true)
      },
    })
  }

  // ---------------------------------------------------------------------------
  // Saving
  // ---------------------------------------------------------------------------

  /** Writes the game to the active save slot (the browser at once, the cloud a few seconds later). */
  function save(silent = false): boolean {
    const w = world.world
    if (!w || !(player.party.length || player.introDone) || ephemeral) return false
    const now = Date.now()
    player.playTimeMs = playTime(now)
    sessionStart = now
    const data: SaveData = { version: SAVE_VERSION, savedAt: now, player: player.serialize(), world: JSON.parse(JSON.stringify(w.state)) }
    saves.write(saves.active, data)
    if (!silent) world.notify('Spelet sparades.')
    return true
  }

  /** Play time so far (ms): earlier sessions plus the running one (idle time included, so approximate). */
  function playTime(now = Date.now()): number {
    return player.playTimeMs + (now - sessionStart)
  }

  function savedGame(slot: Slot = saves.active): SaveSummary | null {
    const result = saves.read(slot)
    return result.ok ? summarizeSave(result.save) : null
  }

  function hasSave(slot: Slot = saves.active): boolean {
    return saves.read(slot).ok
  }

  /** Loads the saved game of a slot and makes it the active one. Returns false when there is no valid save. */
  function loadSave(slot: Slot = saves.active): boolean {
    const result = saves.read(slot)
    if (!result.ok) return false
    saves.setActive(slot)
    player.hydrate(result.save.player)
    resume(result.save.world)
    return true
  }

  function deleteSave(slot: Slot = saves.active) {
    void saves.remove(slot)
  }

  function newGame(state: WorldState = newWorldState()) {
    player.reset()
    sessionStart = Date.now()
    world.start(state)
    playMapMusic()
    screen.value = 'overworld'
    overlay.value = null
    queue = []
    context = null
    install()
  }

  /** Where the player wakes up after the intro: their room in Hemstad. */
  const ROOM = { mapId: 'hemhus', x: 6, y: 3 }

  /** 'full' = the whole intro, 'quick' = only the questions (after skipping it). */
  const introMode = ref<'full' | 'quick'>('full')

  /** Unlocks a note of the professor's notes (and says so when it is the first time). */
  function unlockNote(id: NoteId, announce = true) {
    if (player.unlockNote(id) && announce && screen.value === 'overworld') world.notify(`Ny anteckning: ${NOTES_BY_ID[id].title}`)
  }

  /** Starts the intro cutscene of a new game (the scene itself is drawn by GameRoot; it calls `finishIntro` when done). */
  function beginIntro() {
    screen.value = 'intro'
    introMode.value = 'full'
    world.setBusy(true)
    audio.music(null)
  }

  /** The intro is skipped (held Esc, only possible when it has been played on this device): the short questions follow and the professor's pauses stay off. */
  function skipIntro() {
    if (!settings.introSeen) return
    introMode.value = 'quick'
  }

  /** The intro is over: the chosen names and look are kept and the game goes on in the player's room. */
  function finishIntro(vars: Record<string, string>) {
    player.name = (vars.player ?? '').trim() || DEFAULT_PLAYER_NAME
    player.rivalName = (vars.rival ?? '').trim() || DEFAULT_RIVAL_NAME
    player.look = vars.playerSprite === 'player2' ? 'player2' : 'player'
    player.introDone = true
    settings.introSeen = true
    setNames(player.name, player.rivalName)
    // The trainer name is the display name online (creates the profile with its player id the first time).
    void account.setDisplayName(player.name)
    if (introMode.value === 'quick') world.world?.setFlag('tutorial-off')
    for (const id of ['atb', 'nudge', 'trust'] as const) unlockNote(id, false)
    if (introMode.value === 'quick') for (const id of ['nature', 'trait', 'capture', 'favorite', 'obedience'] as const) unlockNote(id, false)
    world.teleport(ROOM.mapId, ROOM.x, ROOM.y, 'down')
    world.setBusy(false)
    screen.value = 'overworld'
    playMapMusic()
    save(true)
  }

  /** Resumes with already-loaded player/world state (used by loading a save). */
  function resume(state: WorldState) {
    sessionStart = Date.now()
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
        overlay.value = { kind: 'shop', shopId: w.state.mapId }
        break
      case 'pc':
        world.setBusy(true)
        overlay.value = { kind: 'pc' }
        break
      case 'give':
        giveFromNpc(_npcId)
        break
      case 'travel':
        openTravel()
        break
      case 'starter':
        if (!w.hasFlag('starter')) {
          rollStarters()
          world.setBusy(true)
          overlay.value = { kind: 'starter' }
        }
        break
      default:
        break
    }
  }

  // ---------------------------------------------------------------------------
  // Fishing, things on the ground, gifts and fast travel
  // ---------------------------------------------------------------------------

  /** The player's rods, best first. */
  const RODS: { item: string, rod: Rod }[] = [{ item: 'super-rod', rod: 'super' }, { item: 'good-rod', rod: 'good' }, { item: 'old-rod', rod: 'old' }]

  /** Talking to the water with a rod in the bag: cast, and maybe something bites (then a wild battle starts). */
  function startFishing() {
    const w = world.world
    const best = RODS.find(r => player.count(r.item) > 0)
    if (!w || !best || !player.hasAbleParty) return
    world.openDialog([`Du kastar ut linan med ${itemInfo(gameData, best.item).name}...`], undefined, () => {
      const encounter = w.rollFishing(best.rod)
      if (!encounter) return world.openDialog(['Inget nappade.'])
      world.openDialog(['Napp!'], undefined, () => startWildBattle(encounter))
    })
  }

  function pickUp(pickup: PickupDef) {
    const w = world.world
    if (!w) return
    w.collect(pickup)
    const count = pickup.count ?? 1
    player.addItem(pickup.item, count)
    void audio.jingle('item')
    const name = `${count > 1 ? `${count} st ` : ''}${itemInfo(gameData, pickup.item).name}`
    world.openDialog([pickup.hidden ? `Du hittade ${name} gömt här!` : `Du plockade upp ${name}!`])
    save(true)
  }

  function grant(give: GiveDef, pokemon?: { speciesId: number, level: number }) {
    const w = world.world
    if (!w) return
    w.setFlag(give.flag)
    const lines: string[] = []
    for (const { item, count } of give.items ?? []) {
      player.addItem(item, count)
      lines.push(`Du fick ${count > 1 ? `${count} st ` : ''}${itemInfo(gameData, item).name}!`)
    }
    if (pokemon) {
      const mon = createPokemon({
        data: gameData, balance: BALANCE, rng: createRandomRng(), speciesId: pokemon.speciesId, level: pokemon.level,
        trust: BALANCE.TRUST_START_STARTER, originalTrainer: player.name, caughtAt: Date.now(),
      })
      const where = player.addPokemon(mon)
      lines.push(`Du fick ${displayNameOf(gameData, mon)}!`)
      if (where === 'box') lines.push('Ditt lag var fullt, så den skickades till boxen.')
    }
    void audio.jingle('item')
    save(true)
    world.openDialog(lines)
  }

  function giveFromNpc(npcId: string) {
    const w = world.world
    const give = w?.map.npcs.find(n => n.id === npcId)?.give
    if (!w || !give || w.hasFlag(give.flag)) return
    if (give.pokemon && give.pokemon.length > 1) {
      world.setBusy(true)
      overlay.value = { kind: 'gift', npcId, options: give.pokemon }
      return
    }
    grant(give, give.pokemon?.[0])
  }

  function chooseGift(index: number) {
    const o = overlay.value
    overlay.value = null
    world.setBusy(false)
    if (o?.kind !== 'gift') return
    const give = world.world?.map.npcs.find(n => n.id === o.npcId)?.give
    if (give) grant(give, o.options[index])
  }

  /** Fast travel (after badge 2): to any Pokémon Center the player has used. */
  function openTravel() {
    const w = world.world
    if (!w) return
    if (player.badges.length < BALANCE.TRAVEL_MIN_BADGES) return world.openDialog([`Resekartan fungerar först när du har ${BALANCE.TRAVEL_MIN_BADGES} märken.`])
    if (!w.state.visitedCenters.some(c => c.mapId !== w.state.mapId)) return world.openDialog(['Du har inte besökt något annat Pokémon Center ännu.'])
    world.setBusy(true)
    overlay.value = { kind: 'travel' }
  }

  function travelTo(mapId: string) {
    const w = world.world
    const target = w?.state.visitedCenters.find(c => c.mapId === mapId)
    overlay.value = null
    world.setBusy(false)
    if (!w || !target) return
    world.teleport(target.mapId, target.x, target.y, 'down')
    playMapMusic()
    save(true)
  }

  function closeOverlay() {
    overlay.value = null
    world.setBusy(false)
  }

  /** Rolls the nature and trait of the three starters once (kept in the save), so they can be looked at before choosing. */
  function rollStarters() {
    const rng = createRandomRng()
    for (const { speciesId } of STARTERS) {
      if (!player.starterRolls[speciesId]) player.starterRolls[speciesId] = { nature: randomNatureName(rng, gameData), trait: randomTrait(rng, BALANCE) }
    }
  }

  function chooseStarter(speciesId: number) {
    const w = world.world
    if (!w) return
    rollStarters()
    const roll = player.starterRolls[speciesId]
    const pokemon = createPokemon({
      data: gameData, balance: BALANCE, rng: createRandomRng(), speciesId, level: STARTER_LEVEL,
      trust: BALANCE.TRUST_START_STARTER, originalTrainer: player.name, caughtAt: Date.now(),
      nature: roll.nature, trait: roll.trait as TraitId,
    })
    player.addPokemon(pokemon)
    void audio.jingle('item')
    w.setFlag('starter')
    w.setFlag(`starter-${speciesId}`)
    overlay.value = null
    unlockNote('nature', false)
    unlockNote('trait', false)
    save(true)
    // The guided first battle follows at once: the professor, then the rival bursts in.
    world.setBusy(true)
    world.openDialog(TUT.AFTER_PICK(displayNameOf(gameData, pokemon)), TUT.PROFESSOR, () => {
      world.openDialog(TUT.RIVAL_ENTRANCE, '{rival}', startTutorialBattle, 'rival')
    }, 'professor')
  }

  /** The guided first battle: the rival with the starter that beats the player's, level 5 against level 5. */
  function startTutorialBattle() {
    const def = TRAINERS['rival-0']
    world.setBusy(true)
    const enemy = trainerTeam(def).map(mon => createTrainerPokemon({
      data: gameData, balance: BALANCE, rng: createRandomRng(), speciesId: mon.speciesId, level: mon.level, moves: mon.moves, trainerName: fillNames(def.name),
    }))
    begin({ kind: 'trainer', trainer: def, tutorial: true, guided: !world.world?.hasFlag('tutorial-off') }, enemy)
  }

  /** After the guided battle, whatever the result: the professor hands over the Poké Balls and the Pokédex. */
  function tutorialAfter(): PostStep[] {
    return [
      {
        type: 'run',
        run: () => {
          player.addItem('poke-ball', STARTER_BALLS)
          world.world?.setFlag('pokedex')
          unlockNote('capture', false)
          void audio.jingle('item')
        },
      },
      { type: 'dialog', lines: TUT.AFTER_BATTLE, speaker: TUT.PROFESSOR, portrait: 'professor' },
    ]
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

  /** The team a trainer fights with: fixed, or for the rival depending on the player's starter. */
  function trainerTeam(def: TrainerDef): TrainerMon[] {
    if (!def.rival) return def.team
    const w = world.world
    const starter = [1, 4, 7].find(id => w?.hasFlag(`starter-${id}`)) ?? 4
    return rivalTeam(def.rival.round, starter)
  }

  function onTrainer(trainerId: string, _spotted: boolean) {
    const def = TRAINERS[trainerId]
    if (!def || !player.hasAbleParty) {
      world.setBusy(false)
      return
    }
    world.setBusy(true)
    world.openDialog(def.intro, fillNames(`${def.title} ${def.name}`), () => {
      world.setBusy(true)
      const enemy = trainerTeam(def).map(mon => createTrainerPokemon({
        data: gameData, balance: BALANCE, rng: createRandomRng(), speciesId: mon.speciesId, level: mon.level,
        moves: mon.moves, heldItem: mon.heldItem, trainerName: fillNames(def.name),
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
      battle.start({ player: player.party, enemy, kind: ctx.kind, badges: player.badges.length, theme: themeForMap(world.world?.state.mapId ?? ''), tutorial: ctx.guided })
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

    if (outcome.result === 'lose' && ctx?.tutorial) {
      // The guided battle cannot stop the game: the rival wins, the Pokémon is healed and everything goes on.
      steps.push({ type: 'message', lines: [`${fillNames('{rival}')} vann den här gången.`], speaker: fillNames('{rival}'), portrait: 'rival' }, { type: 'message', lines: TUT.RIVAL_WON.map(fillNames), speaker: fillNames('{rival}'), portrait: 'rival' })
      queue.push({ type: 'run', run: () => { player.healAll(false); world.clearTrainer() } }, ...tutorialAfter())
      sequence.value = steps
      return
    }

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
        const speaker = fillNames(`${def.title} ${def.name}`)
        const portrait = spriteFor(def) ?? undefined
        const prize = ctx.tutorial ? 0 : BALANCE.TRAINER_MONEY_PER_LEVEL * Math.max(...trainerTeam(def).map(m => m.level))
        w?.markDefeated(def.id)
        player.money += prize
        steps.push({ type: 'message', lines: [`${foe} svimmade!`, `Du besegrade ${speaker}!`] })
        steps.push({ type: 'message', lines: [...def.defeated, ...(prize ? [`Du fick ${prize} kr för segern!`] : [])], speaker, portrait })
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
      syncBadges()
      w?.setFlag(`badge-${gym.badge}`)
      player.addItem(tmId(gym.tm))
      steps.push({
        type: 'message',
        lines: [...gym.rewardDialog, `Du fick ${gym.badgeName}!`],
        speaker: fillNames(`${def.title} ${def.name}`),
        portrait: spriteFor(def) ?? undefined,
        jingle: 'badge',
      })
    }

    if (steps.some(s => s.type === 'favorite')) unlockNote('favorite', false)
    if (outcome.result === 'win' && ctx?.trainer?.gym) unlockNote('obedience', false)

    // Evolutions are shown after the scene closes, in their own scene.
    for (const info of application.levelUps) if (info.evolveTo) queue.push({ type: 'evolve', uid: info.uid, to: info.evolveTo })

    if (ctx?.tutorial) queue.push(...tutorialAfter())

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



  /** The stone being used, consumed only when the evolution really happens (cancelling keeps it). */
  let pendingStone: string | null = null

  /** Starts an evolution with a stone from the bag. Returns a message when it cannot be used. */
  function useStone(item: string, uid: string): string | null {
    const pokemon = player.findPokemon(uid)
    if (!pokemon || player.count(item) < 1) return 'Det gick inte.'
    const to = stoneEvolution(gameData, pokemon, item)
    if (!to) return `${displayNameOf(gameData, pokemon)} påverkas inte av stenen.`
    pendingStone = item
    world.closeMenu()
    world.setBusy(true)
    overlay.value = { kind: 'evolve', uid, to }
    return null
  }

  function resolveEvolve(accept: boolean) {
    const o = overlay.value
    overlay.value = null
    if (o?.kind !== 'evolve') return runQueue()
    if (accept && pendingStone) player.removeItem(pendingStone)
    pendingStone = null
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
    install, newGame, resume, beginIntro, skipIntro, introMode, unlockNote, finishIntro, rollStarters, setEphemeral, save, savedGame, hasSave, loadSave, deleteSave, chooseStarter, closeShop, closePc, chooseGift, travelTo, closeOverlay, sequence, beginPostBattle, learnChoice, giveNickname, finishBattle, useStone, resolveEvolve, startWildBattle, onTrainer, onAction,
  }
})
