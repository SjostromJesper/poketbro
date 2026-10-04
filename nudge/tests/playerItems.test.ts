import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from '../../app/stores/nudge/player'
import { BALANCE } from '../engine/balance'
import { maxHpOf } from '../engine/pokemon'
import { tmId } from '../game/items'
import { data, mon } from './helpers'

let player: ReturnType<typeof usePlayerStore>

beforeEach(() => {
  setActivePinia(createPinia())
  player = usePlayerStore()
})

describe('party order', () => {
  it('reorders the party', () => {
    const [a, b, c] = [mon('charmander', 5), mon('pidgey', 5), mon('rattata', 5)]
    ;[a, b, c].forEach(p => player.addPokemon(p))
    expect(player.moveParty(2, 0)).toBe(true)
    expect(player.party.map(p => p.uid)).toEqual([c.uid, a.uid, b.uid])
    expect(player.moveParty(0, 2)).toBe(true)
    expect(player.party.map(p => p.uid)).toEqual([a.uid, b.uid, c.uid])
    expect(player.moveParty(1, 1)).toBe(false)
    expect(player.moveParty(0, 9)).toBe(false)
    expect(player.moveParty(-1, 0)).toBe(false)
  })
})

describe('using items outside battle', () => {
  it('heals with potions only when it helps, and uses one up', () => {
    const p = mon('charmander', 10)
    player.addPokemon(p)
    player.addItem('potion', 2)
    expect(player.useHealingItem('potion', p.uid)).toBeNull() // full HP
    expect(player.count('potion')).toBe(2)
    p.currentHp = 5
    expect(player.useHealingItem('potion', p.uid)).toContain('20 HP')
    expect(p.currentHp).toBe(25)
    expect(player.count('potion')).toBe(1)
    p.currentHp = 0
    expect(player.useHealingItem('potion', p.uid)).toBeNull() // fainted
    p.currentHp = maxHpOf(data, p) - 3
    expect(player.useHealingItem('potion', p.uid)).toContain('3 HP')
    expect(p.currentHp).toBe(maxHpOf(data, p))
  })

  it('cures the matching status only', () => {
    const p = mon('charmander', 10)
    player.addPokemon(p)
    player.addItem('antidote')
    player.addItem('paralyze-heal')
    p.status = 'paralysis'
    expect(player.useHealingItem('antidote', p.uid)).toBeNull()
    expect(player.useHealingItem('paralyze-heal', p.uid)).toBe('Charmander blev frisk.')
    expect(p.status).toBeUndefined()
    expect(player.count('paralyze-heal')).toBe(0)
    expect(player.count('antidote')).toBe(1)
  })

  it('feeding an Oran Berry gives +5 trust and a little HP', () => {
    const p = mon('charmander', 10, { trust: 100 })
    player.addPokemon(p)
    player.addItem('oran-berry', 2)
    p.currentHp = 3
    expect(player.feedBerry(p.uid)).toContain('Förtroendet ökade')
    expect(p.trust).toBe(100 + BALANCE.TRUST_BERRY)
    expect(p.currentHp).toBe(3 + BALANCE.ORAN_BERRY_HEAL)
    expect(player.count('oran-berry')).toBe(1)
    p.trust = 253
    player.feedBerry(p.uid)
    expect(p.trust).toBe(255)
    expect(player.feedBerry(p.uid)).toBeNull() // none left
  })

  it('gives, swaps and takes held items', () => {
    const p = mon('charmander', 10)
    player.addPokemon(p)
    player.addItem('oran-berry')
    player.addItem('charcoal')
    expect(player.giveHeldItem('oran-berry', p.uid)).toBe('Charmander håller nu Oran Berry.')
    expect(p.heldItem).toBe('oran-berry')
    expect(player.count('oran-berry')).toBe(0)
    expect(player.giveHeldItem('charcoal', p.uid)).toContain('lämnade tillbaka Oran Berry')
    expect(p.heldItem).toBe('charcoal')
    expect(player.count('oran-berry')).toBe(1)
    expect(player.takeHeldItem(p.uid)).toContain('lämnade tillbaka')
    expect(p.heldItem).toBeUndefined()
    expect(player.count('charcoal')).toBe(1)
    expect(player.takeHeldItem(p.uid)).toBeNull()
    expect(player.giveHeldItem('potion', p.uid)).toBeNull() // not holdable
  })
})

describe('TMs', () => {
  it('knows which Pokémon can learn a TM', () => {
    const rockTomb = tmId('rock-tomb')
    expect(player.tmStatus(rockTomb, mon('geodude', 10))).toBe('can')
    expect(player.tmStatus(rockTomb, mon('pidgey', 10))).toBe('cannot')
    expect(player.tmStatus(rockTomb, mon('geodude', 10, { moves: ['tackle', 'rock-tomb'] }))).toBe('known')
  })

  it('teaches a TM into a free slot without using it up', () => {
    const p = mon('geodude', 10, { moves: ['tackle', 'defense-curl'] })
    player.addPokemon(p)
    player.addItem(tmId('rock-tomb'))
    expect(player.teachTm(tmId('rock-tomb'), p.uid, null)).toBe('Geodude lärde sig Rock Tomb!')
    expect(p.moves.map(m => m.move)).toEqual(['tackle', 'defense-curl', 'rock-tomb'])
    expect(player.count(tmId('rock-tomb'))).toBe(1)
    expect(player.teachTm(tmId('rock-tomb'), p.uid, null)).toBeNull() // already known
  })

  it('needs a move to forget when the Pokémon knows four, and drops its habit', () => {
    const p = mon('geodude', 10, { moves: ['tackle', 'defense-curl', 'rock-throw', 'mud-sport'] })
    p.habits['mud-sport'] = 6
    player.addPokemon(p)
    player.addItem(tmId('rock-tomb'))
    expect(player.teachTm(tmId('rock-tomb'), p.uid, null)).toBeNull()
    expect(player.teachTm(tmId('rock-tomb'), p.uid, 3)).toContain('glömde Mud Sport och lärde sig Rock Tomb')
    expect(p.moves.map(m => m.move)).toEqual(['tackle', 'defense-curl', 'rock-throw', 'rock-tomb'])
    expect(p.habits['mud-sport']).toBeUndefined()
  })

  it('refuses incompatible Pokémon', () => {
    const p = mon('pidgey', 10)
    player.addPokemon(p)
    player.addItem(tmId('rock-tomb'))
    expect(player.teachTm(tmId('rock-tomb'), p.uid, null)).toBeNull()
  })
})

describe('bag basics', () => {
  it('counts, adds and removes items without going negative', () => {
    player.addItem('potion', 3)
    expect(player.removeItem('potion', 5)).toBe(false)
    expect(player.count('potion')).toBe(3)
    expect(player.removeItem('potion', 3)).toBe(true)
    expect(player.bag.potion).toBeUndefined()
    expect(player.spend(BALANCE.STARTING_MONEY + 1)).toBe(false)
    expect(player.spend(100)).toBe(true)
    expect(player.money).toBe(BALANCE.STARTING_MONEY - 100)
  })

  it('serialises and restores the whole player state', () => {
    const p = mon('charmander', 12, { heldItem: 'oran-berry' })
    player.addPokemon(p)
    player.addItem('potion', 2)
    player.badges.push('granit')
    const save = player.serialize()
    player.reset()
    expect(player.party).toHaveLength(0)
    player.hydrate(save)
    expect(player.party[0]).toEqual(p)
    expect(player.count('potion')).toBe(2)
    expect(player.badges).toEqual(['granit'])
    expect(player.pokedex).toEqual([4])
  })
})
