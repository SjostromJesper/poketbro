import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useGameStore } from '../../app/stores/nudge/game'
import { usePlayerStore } from '../../app/stores/nudge/player'
import { useWorldStore } from '../../app/stores/nudge/world'
import { BALANCE } from '../engine/balance'
import { createRng } from '../engine/rng'
import { ENCOUNTER_TABLES, FISHING_TABLES } from '../game/encounters'
import { shopStock } from '../game/items'
import { mapBuilder } from '../game/mapBuilder'
import { MAPS } from '../game/maps'
import { newWorldState } from '../game/world'
import { data, mon } from './helpers'

function setup(build: (m: ReturnType<typeof mapBuilder>) => void, start = { x: 1, y: 1 }) {
  const m = mapBuilder('t-sys', 8, 6, { name: 'Test', encounterTable: 't-sys', base: 'ground' })
  build(m)
  MAPS['t-sys'] = m.build()
  const game = useGameStore()
  const player = usePlayerStore()
  const world = useWorldStore()
  game.setEphemeral(true)
  game.newGame({ ...newWorldState(), mapId: 't-sys', x: start.x, y: start.y })
  player.addPokemon(mon('charizard', 50, { moves: ['flamethrower', 'slash'], trust: 200 }))
  return { game, player, world }
}

function talkThrough(world: ReturnType<typeof useWorldStore>) {
  for (let i = 0; i < 100 && world.dialog; i++) world.advanceDialog()
}

beforeEach(() => {
  vi.useFakeTimers()
  setActivePinia(createPinia())
  const rng = createRng(11)
  vi.spyOn(Math, 'random').mockImplementation(() => rng.next())
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  delete MAPS['t-sys']
  delete ENCOUNTER_TABLES['t-sys']
  delete FISHING_TABLES['t-sys']
})

describe('things on the ground and gifts', () => {
  it('picking up a visible ball and finding a hidden item gives the items once', () => {
    const { player, world } = setup((m) => {
      m.pickup({ id: 'ball', x: 2, y: 1, item: 'poke-ball', count: 3 })
      m.pickup({ id: 'secret', x: 1, y: 2, item: 'tm:rest', hidden: true })
    })
    world.world!.state.facing = 'right'
    world.action()
    expect(player.count('poke-ball')).toBe(3)
    expect(world.dialog!.lines[0]).toContain('3 st Poké Ball')
    talkThrough(world)
    world.action() // the spot is empty now
    expect(player.count('poke-ball')).toBe(3)
    world.world!.state.facing = 'down'
    world.action()
    expect(player.count('tm:rest')).toBe(1)
    expect(world.dialog!.lines[0]).toContain('gömt')
  })

  it('an NPC gives a Pokémon or an item once (dialogAfter shows afterwards)', () => {
    const { game, player, world } = setup((m) => {
      m.npc({
        id: 'giver', x: 2, y: 1, facing: 'left', look: 'old', dialog: ['Ta den här!'], action: 'give',
        dialogAfter: { flag: 'gift-1', lines: ['Ta hand om den.'] },
        give: { flag: 'gift-1', items: [{ item: 'old-rod', count: 1 }], pokemon: [{ speciesId: 133, level: 10 }] },
      })
    })
    void game
    world.world!.state.facing = 'right'
    world.action()
    talkThrough(world)
    expect(player.count('old-rod')).toBe(1)
    expect(player.party.map(p => p.speciesId)).toContain(133)
    expect(world.world!.hasFlag('gift-1')).toBe(true)
    world.action()
    expect(world.dialog!.lines).toEqual(['Ta hand om den.'])
    talkThrough(world)
    expect(player.count('old-rod')).toBe(1)
  })

  it('a gift with several Pokémon lets the player choose one', () => {
    const { game, player, world } = setup((m) => {
      m.npc({
        id: 'dojo', x: 2, y: 1, facing: 'left', look: 'old', dialog: ['Välj!'], action: 'give',
        give: { flag: 'dojo', pokemon: [{ speciesId: 106, level: 20 }, { speciesId: 107, level: 20 }] },
      })
    })
    world.world!.state.facing = 'right'
    world.action()
    talkThrough(world)
    expect(game.overlay).toMatchObject({ kind: 'gift' })
    game.chooseGift(1)
    talkThrough(world)
    expect(player.party.map(p => p.speciesId)).toContain(107)
    expect(player.party.map(p => p.speciesId)).not.toContain(106)
  })
})

describe('fishing', () => {
  it('needs a rod, then something may bite and start a wild battle from the rod\'s table', () => {
    FISHING_TABLES['t-sys'] = { old: [{ speciesId: 129, weight: 1, minLevel: 5, maxLevel: 5 }], good: [{ speciesId: 118, weight: 1, minLevel: 10, maxLevel: 10 }] }
    const { game, player, world } = setup((m) => { m.fill(2, 1, 1, 1, 'water') })
    world.world!.state.facing = 'right'
    world.action() // no rod: nothing happens
    expect(world.dialog).toBeNull()
    player.addItem('old-rod')
    vi.spyOn(Math, 'random').mockReturnValue(0.01)
    world.action()
    expect(world.dialog!.lines[0]).toContain('kastar ut linan')
    talkThrough(world)
    // the rng of the world decides the bite: allow a few casts
    for (let i = 0; i < 20 && game.screen !== 'transition'; i++) {
      world.action()
      talkThrough(world)
    }
    expect(game.screen).toBe('transition')
  })

  it('the best rod in the bag is used', () => {
    FISHING_TABLES['t-sys'] = { old: [{ speciesId: 129, weight: 1, minLevel: 5, maxLevel: 5 }], good: [{ speciesId: 118, weight: 1, minLevel: 10, maxLevel: 10 }] }
    const { world } = setup((m) => { m.fill(2, 1, 1, 1, 'water') })
    world.world!.state.facing = 'right'
    const rolls = new Set<number>()
    for (let i = 0; i < 40; i++) {
      const e = world.world!.rollFishing('good')
      if (e) rolls.add(e.speciesId)
    }
    expect([...rolls]).toEqual([118])
    expect(world.world!.rollFishing('super')).toBeNull() // no table for that rod
  })
})

describe('evolution stones', () => {
  it('a stone is used from the bag, evolves the Pokémon and is consumed only when the evolution happens', () => {
    const { game, player, world } = setup(() => {})
    const pikachu = mon('pikachu', 20)
    player.addPokemon(pikachu)
    player.addItem('thunder-stone', 2)
    expect(game.useStone('fire-stone', pikachu.uid)).toBe('Det gick inte.')
    expect(game.useStone('thunder-stone', player.party[0].uid)).toContain('påverkas inte')
    expect(game.useStone('thunder-stone', pikachu.uid)).toBeNull()
    expect(game.overlay).toEqual({ kind: 'evolve', uid: pikachu.uid, to: 26 })
    game.resolveEvolve(false) // cancelled: the stone stays
    expect(player.count('thunder-stone')).toBe(2)
    expect(player.party.find(p => p.uid === pikachu.uid)!.speciesId).toBe(25)
    game.useStone('thunder-stone', pikachu.uid)
    game.resolveEvolve(true)
    expect(player.count('thunder-stone')).toBe(1)
    expect(player.party.find(p => p.uid === pikachu.uid)!.speciesId).toBe(26)
    talkThrough(world)
  })
})

describe('shops, travel and the Pokédex', () => {
  it('the shop stock grows with the badges', () => {
    const stock = (n: number) => shopStock('gruss_mart', n)
    expect(stock(0)).toContain('poke-ball')
    expect(stock(0)).not.toContain('great-ball')
    expect(stock(1)).toContain('great-ball')
    expect(stock(1)).not.toContain('super-potion')
    expect(stock(2)).toContain('super-potion')
    expect(stock(2)).not.toContain('ultra-ball')
    expect(stock(3)).toContain('ultra-ball')
    expect(stock(4)).toContain('hyper-potion')
    expect(stock(0)).toContain('tm:rest') // the town's own TMs
  })

  it('fast travel needs two badges and a visited Pokémon Center', () => {
    const { game, player, world } = setup(() => {})
    world.world!.state.visitedCenters.push({ mapId: 'gruss', x: 5, y: 7 })
    const open = () => { game.overlay = null; world.setBusy(false); (game as unknown as { onAction: (a: string, id: string) => void }).onAction('travel', 'x') }
    open()
    expect(world.dialog!.lines[0]).toContain(`${BALANCE.TRAVEL_MIN_BADGES} märken`)
    talkThrough(world)
    player.badges.push('a', 'b')
    open()
    expect(game.overlay).toEqual({ kind: 'travel' })
    game.travelTo('gruss')
    expect(world.world!.state).toMatchObject({ mapId: 'gruss', x: 5, y: 7 })
  })

  it('species you meet are marked as seen, owned ones are in the Pokédex', () => {
    const { game, player } = setup(() => {})
    expect(player.pokedex).toContain(6)
    expect(player.pokedexSeen).toContain(6)
    expect(player.pokedexSeen).not.toContain(19)
    ENCOUNTER_TABLES['t-sys'] = [{ speciesId: 19, weight: 1, minLevel: 3, maxLevel: 3 }]
    game.startWildBattle({ speciesId: 19, level: 3 })
    vi.advanceTimersByTime(1000)
    expect(player.pokedexSeen).toContain(19)
    expect(player.pokedex).not.toContain(19)
    expect(data.species[19]).toBeDefined()
  })
})
