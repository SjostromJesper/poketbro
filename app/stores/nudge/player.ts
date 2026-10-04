import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { gameData } from '~~/nudge/data'
import { BALANCE } from '~~/nudge/engine/balance'
import { maxHpOf } from '~~/nudge/engine/pokemon'
import { healPokemon } from '~~/nudge/engine/progression'
import type { OwnedPokemon } from '~~/nudge/engine/types'

export const MAX_PARTY = 6

export interface PlayerSave {
  name: string
  party: OwnedPokemon[]
  box: OwnedPokemon[]
  money: number
  bag: Record<string, number>
  badges: string[]
  pokedex: number[]
  stepRemainder: number
}

/** Everything the player owns: Pokémon, money, items and badges. Plain serialisable state (saving is in M7). */
export const usePlayerStore = defineStore('nudgePlayer', () => {
  const name = ref('Du')
  const party = ref<OwnedPokemon[]>([])
  const box = ref<OwnedPokemon[]>([])
  const money = ref(BALANCE.STARTING_MONEY)
  const bag = ref<Record<string, number>>({})
  const badges = ref<string[]>([])
  /** Species ids the player has owned. */
  const pokedex = ref<number[]>([])
  const stepRemainder = ref(0)

  const ablePokemon = computed(() => party.value.filter(p => p.currentHp > 0))
  const hasAbleParty = computed(() => ablePokemon.value.length > 0)

  function reset() {
    name.value = 'Du'
    party.value = []
    box.value = []
    money.value = BALANCE.STARTING_MONEY
    bag.value = {}
    badges.value = []
    pokedex.value = []
    stepRemainder.value = 0
  }

  function count(item: string): number {
    return bag.value[item] ?? 0
  }

  function addItem(item: string, amount = 1) {
    bag.value[item] = count(item) + amount
  }

  /** Returns false (and changes nothing) when the player does not have enough. */
  function removeItem(item: string, amount = 1): boolean {
    if (count(item) < amount) return false
    const left = count(item) - amount
    if (left > 0) bag.value[item] = left
    else delete bag.value[item]
    return true
  }

  function spend(amount: number): boolean {
    if (money.value < amount) return false
    money.value -= amount
    return true
  }

  /** Adds a Pokémon to the party, or to the box when the party is full. Returns where it went. */
  function addPokemon(pokemon: OwnedPokemon): 'party' | 'box' {
    if (!pokedex.value.includes(pokemon.speciesId)) pokedex.value.push(pokemon.speciesId)
    if (party.value.length < MAX_PARTY) {
      party.value.push(pokemon)
      return 'party'
    }
    box.value.push(pokemon)
    return 'box'
  }

  function healAll(withTrust = true) {
    for (const pokemon of party.value) healPokemon(gameData, BALANCE, pokemon, withTrust)
  }

  function findPokemon(uid: string): OwnedPokemon | undefined {
    return party.value.find(p => p.uid === uid) ?? box.value.find(p => p.uid === uid)
  }

  /** +1 trust per 100 steps for everyone in the party (4.2). Call with the number of new steps. */
  function addSteps(steps: number, onTrust?: () => void) {
    stepRemainder.value += steps
    while (stepRemainder.value >= 100) {
      stepRemainder.value -= 100
      for (const pokemon of party.value) pokemon.trust = Math.min(BALANCE.TRUST_MAX, pokemon.trust + BALANCE.TRUST_PER_100_STEPS)
      onTrust?.()
    }
  }

  function totalHpFraction(): number {
    const total = party.value.reduce((sum, p) => sum + maxHpOf(gameData, p), 0)
    const current = party.value.reduce((sum, p) => sum + p.currentHp, 0)
    return total > 0 ? current / total : 0
  }

  function serialize(): PlayerSave {
    return JSON.parse(JSON.stringify({
      name: name.value, party: party.value, box: box.value, money: money.value, bag: bag.value,
      badges: badges.value, pokedex: pokedex.value, stepRemainder: stepRemainder.value,
    })) as PlayerSave
  }

  function hydrate(save: PlayerSave) {
    name.value = save.name
    party.value = save.party
    box.value = save.box
    money.value = save.money
    bag.value = save.bag
    badges.value = save.badges
    pokedex.value = save.pokedex
    stepRemainder.value = save.stepRemainder
  }

  return {
    name, party, box, money, bag, badges, pokedex, stepRemainder, ablePokemon, hasAbleParty,
    reset, count, addItem, removeItem, spend, addPokemon, healAll, findPokemon, addSteps, totalHpFraction, serialize, hydrate,
  }
})
