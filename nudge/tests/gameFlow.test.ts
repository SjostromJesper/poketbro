import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useBattleStore } from '../../app/stores/nudge/battle'
import { useGameStore } from '../../app/stores/nudge/game'
import { usePlayerStore } from '../../app/stores/nudge/player'
import { useWorldStore } from '../../app/stores/nudge/world'
import { BALANCE } from '../engine/balance'
import { xpForLevel } from '../engine/formulas'
import { createRng } from '../engine/rng'
import { newWorldState } from '../game/world'
import { tmId } from '../game/items'
import { TRAINERS } from '../game/trainers'
import { data, mon } from './helpers'

function setup() {
  const game = useGameStore()
  const player = usePlayerStore()
  const world = useWorldStore()
  const battle = useBattleStore()
  game.newGame(newWorldState())
  return { game, player, world, battle }
}

type Ctx = ReturnType<typeof setup>

/** Closes every open dialog (as if the player kept pressing the action key). */
function talkThrough({ world }: Ctx) {
  for (let i = 0; i < 100 && world.dialog; i++) world.advanceDialog()
  expect(world.dialog).toBeNull()
}

/** Lets the transition timer pass and plays the running battle out (the player is expected to win unless stated). */
function playBattle({ battle }: Ctx, maxFrames = 60000) {
  vi.advanceTimersByTime(1000)
  expect(battle.engine).not.toBeNull()
  battle.setSpeed(3)
  for (let i = 0; i < maxFrames && !battle.result; i++) battle.frame(16)
  expect(battle.result).not.toBeNull()
}

function strong(name = 'charizard', level = 60) {
  return mon(name, level, { moves: ['flamethrower', 'slash', 'ember', 'scratch'], trust: 200 })
}

beforeEach(() => {
  vi.useFakeTimers()
  setActivePinia(createPinia())
  const rng = createRng(2024)
  vi.spyOn(Math, 'random').mockImplementation(() => rng.next())
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('the first steps: professor, starter, healing', () => {
  it('lets you pick a starter from the professor, which opens the gate', () => {
    const ctx = setup()
    const { game, player, world } = ctx
    world.world!.state.mapId = 'proflab'
    world.teleport('proflab', 4, 3, 'up')
    world.action() // talk to the professor
    expect(world.mode).toBe('dialog')
    talkThrough(ctx)
    expect(game.overlay).toEqual({ kind: 'starter' })
    expect(world.mode).toBe('busy')
    game.chooseStarter(4)
    expect(game.overlay).toBeNull()
    expect(player.party).toHaveLength(1)
    expect(player.party[0]).toMatchObject({ speciesId: 4, level: 5, trust: BALANCE.TRUST_START_STARTER, originalTrainer: 'Du' })
    expect(player.count('poke-ball')).toBe(5)
    expect(world.world!.hasFlag('starter')).toBe(true)
    expect(world.mode).toBe('dialog')
    talkThrough(ctx)
    expect(world.mode).toBe('walk')
    // The professor only offers a starter once.
    world.action()
    talkThrough(ctx)
    expect(game.overlay).toBeNull()
    expect(player.party).toHaveLength(1)
  })

  it('heals the party at the Pokémon Center and remembers it for blackouts', () => {
    const ctx = setup()
    const { player, world } = ctx
    player.addPokemon(strong('charmander', 12))
    player.party[0].currentHp = 1
    player.party[0].moves[0].pp = 0
    player.party[0].status = 'burn'
    const trust = player.party[0].trust
    world.teleport('gruss_center', 4, 4, 'up')
    world.action()
    talkThrough(ctx)
    expect(player.party[0].currentHp).toBeGreaterThan(1)
    expect(player.party[0].status).toBeUndefined()
    expect(player.party[0].moves[0].pp).toBe(player.party[0].moves[0].maxPp)
    expect(player.party[0].trust).toBe(trust + BALANCE.TRUST_CENTER)
    expect(world.world!.state.lastCenter).toEqual({ mapId: 'gruss', x: 5, y: 7 })
  })

  it('opens the shop when talking to the clerk and closes it again', () => {
    const ctx = setup()
    const { game, world } = ctx
    world.teleport('gruss_mart', 4, 4, 'up')
    world.action()
    talkThrough(ctx)
    expect(game.overlay).toEqual({ kind: 'shop', shopId: 'gruss_mart' })
    expect(world.mode).toBe('busy')
    game.closeShop()
    expect(game.overlay).toBeNull()
    expect(world.mode).toBe('walk')
  })

  it('gives trust for walking: +1 per 100 steps', () => {
    const { player } = setup()
    player.addPokemon(strong('charmander', 12))
    const before = player.party[0].trust
    player.addSteps(99)
    expect(player.party[0].trust).toBe(before)
    player.addSteps(1)
    expect(player.party[0].trust).toBe(before + 1)
    player.addSteps(250)
    expect(player.party[0].trust).toBe(before + 3)
  })
})

describe('wild battles', () => {
  it('starts a wild battle in tall grass, plays it, wins XP and returns to the map', () => {
    const ctx = setup()
    const { game, player, world, battle } = ctx
    player.addPokemon(strong())
    world.world!.setFlag('starter')
    const before = player.party[0].xp
    world.teleport('route1', 2, 4)
    game.startWildBattle({ speciesId: 19, level: 3 })
    expect(game.screen).toBe('transition')
    expect(world.mode).toBe('busy')
    playBattle(ctx)
    expect(game.screen).toBe('battle')
    expect(battle.result).toBe('win')
    game.finishBattle(battle.outcome)
    expect(game.screen).toBe('overworld')
    expect(battle.engine).toBeNull()
    expect(player.party[0].xp).toBeGreaterThan(before)
    expect(player.party[0].currentHp).toBeLessThanOrEqual(player.party[0].currentHp)
    talkThrough(ctx)
    expect(world.mode).toBe('walk')
  })

  it('catches a wild Pokémon and adds it to the party (box when full)', () => {
    const ctx = setup()
    const { game, player, world, battle } = ctx
    player.addPokemon(strong())
    player.addItem('poke-ball', 30)
    game.startWildBattle({ speciesId: 19, level: 3 })
    vi.advanceTimersByTime(1000)
    const enemy = battle.engine!.active('enemy')
    enemy.hp = 1
    enemy.status = 'sleep'
    enemy.statusMs = 600000
    let thrown = 0
    for (let i = 0; i < 400 && !battle.result; i++) {
      battle.frame(16)
      if (i % 40 === 0) {
        const result = battle.act({ type: 'ball' })
        if (result?.accepted) { player.removeItem('poke-ball'); thrown++ }
      }
    }
    expect(battle.result).toBe('caught')
    expect(player.count('poke-ball')).toBe(30 - thrown)
    game.finishBattle(battle.outcome)
    expect(player.party).toHaveLength(2)
    expect(player.party[1]).toMatchObject({ speciesId: 19, level: 3, originalTrainer: 'Du' })
    expect(player.pokedex).toContain(19)
    expect(world.dialog!.lines[0]).toContain('lades till i ditt lag')
    talkThrough(ctx)

    // With a full party the Pokémon goes to the box.
    for (let i = 0; i < 4; i++) player.addPokemon(strong('pidgey', 5))
    expect(player.party).toHaveLength(6)
    expect(player.addPokemon(strong('rattata', 3))).toBe('box')
    expect(player.box).toHaveLength(1)
  })

  it('levels up, learns moves (replace dialog) and evolves (with cancel)', () => {
    const ctx = setup()
    const { game, player, world, battle } = ctx
    const bulbasaur = mon('bulbasaur', 9, { moves: ['tackle', 'growl', 'leech-seed', 'splash'] })
    bulbasaur.xp = xpForLevel(data.growthRates, 'medium-slow', 10) - 1
    player.addPokemon(bulbasaur)
    // Strong enough to win quickly: give it big stats via a high level later... instead use a weak enemy.
    game.startWildBattle({ speciesId: 10, level: 2 })
    playBattle(ctx, 200000)
    expect(battle.result).toBe('win')
    game.finishBattle(battle.outcome)
    expect(world.dialog!.lines[0]).toBe('Bulbasaur nådde nivå 10!')
    talkThrough(ctx)
    expect(game.overlay).toEqual({ kind: 'learn', uid: bulbasaur.uid, move: 'vine-whip' })
    game.resolveLearn(3) // forget Splash
    expect(player.party[0].moves.map(m => m.move)).toEqual(['tackle', 'growl', 'leech-seed', 'vine-whip'])
    expect(world.dialog!.lines[0]).toContain('glömde Splash')
    talkThrough(ctx)
    expect(world.mode).toBe('walk')

    // Evolution: reach level 16 and cancel, then evolve later in the same way.
    const b = player.party[0]
    b.level = 15
    b.xp = xpForLevel(data.growthRates, 'medium-slow', 16) - 1
    game.startWildBattle({ speciesId: 10, level: 2 })
    playBattle(ctx, 200000)
    game.finishBattle(battle.outcome)
    talkThrough(ctx)
    expect(player.party[0].level).toBe(16)
    expect(game.overlay).toEqual({ kind: 'evolve', uid: b.uid, to: 2 })
    game.resolveEvolve(false)
    expect(player.party[0].speciesId).toBe(1)
    talkThrough(ctx)
    // evolving works too
    player.party[0].level = 16
    game.overlay = { kind: 'evolve', uid: b.uid, to: 2 }
    game.resolveEvolve(true)
    expect(player.party[0].speciesId).toBe(2)
    expect(player.pokedex).toContain(2)
    expect(world.dialog!.lines[0]).toContain('utvecklades till Ivysaur')
  })
})

describe('trainers', () => {
  it('spots you, walks up, talks, fights, pays and stays beaten', () => {
    const ctx = setup()
    const { game, player, world, battle } = ctx
    player.addPokemon(strong())
    world.world!.setFlag('starter')
    world.teleport('route1', 3, 20)
    const money = player.money
    // Walk right into Kalle's line of sight (he is at 7,20 facing left, sight 3).
    world.holdDirection('right')
    for (let t = 0; t < 400; t += 16) world.update(16)
    world.holdDirection(null)
    expect(world.world!.state.x).toBe(4)
    expect(world.mode).toBe('busy')
    expect(world.visual.spotted?.id).toBe('r1-kalle')
    for (let t = 0; t < 3000 && world.mode === 'busy'; t += 16) world.update(16)
    expect(world.mode).toBe('dialog')
    expect(world.visual.trainerPos).toMatchObject({ id: 'r1-kalle', x: 5, y: 20 }) // right in front of the player
    expect(world.dialog!.lines).toEqual(TRAINERS['r1-kalle'].intro)
    talkThrough(ctx)
    expect(game.screen).toBe('transition')
    playBattle(ctx)
    expect(battle.result).toBe('win')
    game.finishBattle(battle.outcome)
    talkThrough(ctx)
    expect(world.world!.isDefeated('r1-kalle')).toBe(true)
    expect(player.money).toBe(money + BALANCE.TRAINER_MONEY_PER_LEVEL * 3)
    expect(world.visual.trainerPos).toBeNull()
    expect(world.mode).toBe('walk')
    // Beaten trainers do not spot you again.
    expect(world.world!.trainersInSight()).toEqual([])
  })

  it('beating the gym leader gives the badge and the TM', () => {
    const ctx = setup()
    const { game, player, world, battle } = ctx
    player.addPokemon(strong('blastoise', 60))
    world.teleport('gruss_gym', 5, 3, 'up')
    world.world!.markDefeated('gym-tor')
    world.world!.markDefeated('gym-sofia')
    world.action()
    expect(world.dialog!.speaker).toBe('Gymledare Granit')
    talkThrough(ctx)
    playBattle(ctx)
    expect(battle.result).toBe('win')
    game.finishBattle(battle.outcome)
    talkThrough(ctx)
    expect(player.badges).toContain('granit')
    expect(player.count(tmId('rock-tomb'))).toBe(1)
    expect(world.world!.hasFlag('badge-granit')).toBe(true)
    expect(world.world!.isDefeated('gym-granit')).toBe(true)
  })

  it('blacks out after losing: half the money lost, back to the last Pokémon Center, party healed', () => {
    const ctx = setup()
    const { game, player, world, battle } = ctx
    const weak = mon('magikarp', 3, { moves: ['splash'] })
    player.addPokemon(weak)
    player.money = 1000
    world.world!.state.lastCenter = { mapId: 'gruss', x: 5, y: 7 }
    world.teleport('gruss_gym', 5, 3, 'up')
    world.action()
    talkThrough(ctx)
    playBattle(ctx)
    expect(battle.result).toBe('lose')
    game.finishBattle(battle.outcome)
    talkThrough(ctx)
    expect(player.money).toBe(500)
    expect(world.world!.state).toMatchObject({ mapId: 'gruss', x: 5, y: 7 })
    expect(world.visual).toMatchObject({ x: 5, y: 7 })
    expect(player.party[0].currentHp).toBeGreaterThan(0)
    expect(world.world!.isDefeated('gym-granit')).toBe(false)
    expect(world.mode).toBe('walk')
  })

  it('does not start encounters without a Pokémon that can fight', () => {
    const { game, world } = setup()
    game.startWildBattle({ speciesId: 19, level: 3 })
    expect(game.screen).toBe('overworld')
    expect(world.mode).toBe('walk')
  })
})
