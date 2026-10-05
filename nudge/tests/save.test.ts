import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useBattleStore } from '../../app/stores/nudge/battle'
import { useGameStore } from '../../app/stores/nudge/game'
import { usePlayerStore } from '../../app/stores/nudge/player'
import { useWorldStore } from '../../app/stores/nudge/world'
import { readItem, writeItem } from '../../app/stores/nudge/storage'
import { createRng } from '../engine/rng'
import { parseSave, SAVE_VERSION, serializeSave, summarizeSave, type PlayerData } from '../game/save'
import { newWorldState } from '../game/world'
import { mon } from './helpers'
import { finishBattle } from './sequence'

/** The save in slot 1 as the game wrote it. */
function slotData(slot: 1 | 2 | 3): any {
  return JSON.parse(readItem(`nudge:slot:${slot}`)!).data
}

function playerData(): PlayerData {
  return {
    name: 'Du', party: [mon('charmander', 12, { heldItem: 'oran-berry' }), mon('pidgey', 7)], box: [], money: 777,
    bag: { 'poke-ball': 4, 'potion': 2 }, badges: ['granit'], pokedex: [4, 16], stepRemainder: 42, playTimeMs: 3_600_000, pokedexSeen: [4, 16, 19],
  }
}

describe('save format', () => {
  it('round-trips the whole game state', () => {
    const world = { ...newWorldState(), mapId: 'route1', x: 6, y: 20, flags: ['starter'], defeatedTrainers: ['r1-kalle'], steps: 321 }
    const raw = serializeSave(playerData(), world, 1234)
    const parsed = parseSave(raw)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.save).toEqual({ version: SAVE_VERSION, savedAt: 1234, player: playerData(), world })
  })

  it('reports missing, corrupt and incompatible saves instead of crashing', () => {
    expect(parseSave(null)).toEqual({ ok: false, reason: 'missing' })
    expect(parseSave('')).toEqual({ ok: false, reason: 'missing' })
    expect(parseSave('{not json')).toEqual({ ok: false, reason: 'corrupt' })
    expect(parseSave('42')).toEqual({ ok: false, reason: 'corrupt' })
    expect(parseSave('{}')).toEqual({ ok: false, reason: 'corrupt' })
    expect(parseSave(JSON.stringify({ version: 99, savedAt: 1, player: {}, world: {} }))).toEqual({ ok: false, reason: 'version' })
    const good = JSON.parse(serializeSave(playerData(), newWorldState(), 1))
    expect(parseSave(JSON.stringify({ ...good, player: { ...good.player, party: [{ uid: 'x', speciesId: 9999 }] } }))).toEqual({ ok: false, reason: 'corrupt' })
    expect(parseSave(JSON.stringify({ ...good, player: { ...good.player, money: 'lots' } }))).toEqual({ ok: false, reason: 'corrupt' })
    expect(parseSave(JSON.stringify({ ...good, world: { ...good.world, flags: 'no' } }))).toEqual({ ok: false, reason: 'corrupt' })
  })

  it('falls back to the start when the saved position is no longer valid', () => {
    const bad = serializeSave(playerData(), { ...newWorldState(), mapId: 'removed-map', x: 3, y: 3 }, 1)
    const parsed = parseSave(bad)
    expect(parsed.ok && parsed.save.world).toMatchObject({ mapId: 'hemstad', x: 3, y: 5 })
    const inTree = parseSave(serializeSave(playerData(), { ...newWorldState(), mapId: 'hemstad', x: 0, y: 0 }, 1))
    expect(inTree.ok && inTree.save.world.mapId).toBe('hemstad')
    expect(inTree.ok && inTree.save.world.x).toBe(3)
  })

  it('summarises a save for the title screen', () => {
    const parsed = parseSave(serializeSave(playerData(), { ...newWorldState(), mapId: 'gruss', x: 11, y: 14 }, 99))
    if (!parsed.ok) throw new Error('parse failed')
    expect(summarizeSave(parsed.save)).toEqual({
      playerName: 'Du', partyIcons: [4, 16], playTimeMs: 3_600_000,
      leadName: 'Charmander', leadSpeciesId: 4, leadLevel: 12, partySize: 2, badges: 1, money: 777, placeName: 'Grusstad', savedAt: 99,
    })
  })
})

describe('saving and loading through the game store', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setActivePinia(createPinia())
    const rng = createRng(77)
    vi.spyOn(Math, 'random').mockImplementation(() => rng.next())
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    useGameStore().deleteSave()
  })

  it('has nothing to save before you own a Pokémon, then saves and loads everything', () => {
    const game = useGameStore()
    const player = usePlayerStore()
    const world = useWorldStore()
    game.deleteSave()
    game.newGame(newWorldState())
    expect(game.save()).toBe(false)
    expect(game.hasSave()).toBe(false)

    player.addPokemon(mon('charmander', 12, { heldItem: 'oran-berry' }))
    player.addItem('potion', 3)
    player.money = 1234
    player.badges.push('granit')
    world.world!.setFlag('starter')
    world.world!.markDefeated('r1-kalle')
    world.teleport('route1', 6, 20, 'left')
    world.world!.state.steps = 500
    expect(game.save()).toBe(true)
    expect(world.banner?.text).toBe('Spelet sparades.')
    expect(game.hasSave()).toBe(true)
    expect(game.savedGame()).toMatchObject({ leadName: 'Charmander', placeName: 'Väg 1', badges: 1, money: 1234 })

    // A fresh app: stores are recreated, then the save is loaded.
    setActivePinia(createPinia())
    const game2 = useGameStore()
    const player2 = usePlayerStore()
    const world2 = useWorldStore()
    expect(player2.party).toHaveLength(0)
    expect(game2.loadSave()).toBe(true)
    expect(player2.party[0]).toMatchObject({ speciesId: 4, level: 12, heldItem: 'oran-berry' })
    expect(player2.count('potion')).toBe(3)
    expect(player2.money).toBe(1234)
    expect(player2.badges).toEqual(['granit'])
    expect(world2.world!.state).toMatchObject({ mapId: 'route1', x: 6, y: 20, steps: 500 })
    expect(world2.world!.hasFlag('starter')).toBe(true)
    expect(world2.world!.isDefeated('r1-kalle')).toBe(true)
    expect(world2.visual).toMatchObject({ x: 6, y: 20 })
    expect(world2.mode).toBe('walk')
  })

  it('refuses a corrupt save without touching the current game', () => {
    const game = useGameStore()
    const player = usePlayerStore()
    game.newGame(newWorldState())
    player.addPokemon(mon('charmander', 5))
    writeItem('nudge:slot:1', JSON.stringify({ slot: 1, saveVersion: 2, data: { version: 2, broken: true }, summary: {}, updatedAt: 1, cloudUpdatedAt: null, dirty: false }))
    expect(game.hasSave()).toBe(false)
    expect(game.loadSave()).toBe(false)
    expect(player.party).toHaveLength(1)
  })

  it('autosaves when changing map and after a battle, and can delete the save', () => {
    const game = useGameStore()
    const player = usePlayerStore()
    const world = useWorldStore()
    const battle = useBattleStore()
    game.newGame(newWorldState())
    player.addPokemon(mon('charizard', 60, { moves: ['flamethrower', 'slash'], trust: 200 }))
    world.world!.setFlag('starter')
    expect(game.hasSave()).toBe(false)

    // Walk through the house door: the map change autosaves.
    world.teleport('hemstad', 3, 5, 'up')
    world.holdDirection('up')
    for (let t = 0; t < 1500; t += 16) world.update(16)
    world.holdDirection(null)
    expect(world.world!.state.mapId).toBe('hemhus')
    expect(game.hasSave()).toBe(true)
    expect(slotData(1).world.mapId).toBe('hemhus')

    // After a battle (and its dialogs) the progress is saved again.
    game.startWildBattle({ speciesId: 19, level: 3 })
    vi.advanceTimersByTime(1000)
    battle.setSpeed(3)
    for (let i = 0; i < 60000 && !battle.result; i++) battle.frame(16)
    const xpBefore = slotData(1).player.party[0].xp
    finishBattle(game, battle.outcome)
    for (let i = 0; i < 50 && world.dialog; i++) world.advanceDialog()
    expect(slotData(1).player.party[0].xp).toBeGreaterThan(xpBefore)

    game.deleteSave()
    expect(game.hasSave()).toBe(false)
  })
})

