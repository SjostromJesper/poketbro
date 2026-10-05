import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { gameData } from '~~/nudge/data'
import { BALANCE } from '~~/nudge/engine/balance'
import { displayNameOf, maxHpOf } from '~~/nudge/engine/pokemon'
import { healPokemon, learnMove } from '~~/nudge/engine/progression'
import type { OwnedPokemon, StatusId } from '~~/nudge/engine/types'
import { itemInfo, isTm } from '~~/nudge/game/items'

export const MAX_PARTY = 6

export interface PlayerSave {
  name: string
  party: OwnedPokemon[]
  box: OwnedPokemon[]
  money: number
  bag: Record<string, number>
  badges: string[]
  pokedex: number[]
  pokedexSeen: number[]
  stepRemainder: number
  playTimeMs: number
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
  /** Species ids the player has seen (in battle) - a superset of the owned ones. */
  const pokedexSeen = ref<number[]>([])
  const stepRemainder = ref(0)
  /** Time played in earlier sessions (ms); the game store adds the running session when saving. */
  const playTimeMs = ref(0)

  const ablePokemon = computed(() => party.value.filter(p => p.currentHp > 0))
  const hasAbleParty = computed(() => ablePokemon.value.length > 0)

  function markSeen(speciesId: number) {
    if (!pokedexSeen.value.includes(speciesId)) pokedexSeen.value.push(speciesId)
  }

  function reset() {
    name.value = 'Du'
    party.value = []
    box.value = []
    money.value = BALANCE.STARTING_MONEY
    bag.value = {}
    badges.value = []
    pokedex.value = []
    pokedexSeen.value = []
    stepRemainder.value = 0
    playTimeMs.value = 0
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
    markSeen(pokemon.speciesId)
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

  /** Moves a party member into the box. At least one Pokémon able to fight must stay in the party. */
  function moveToBox(uid: string): string | null {
    const index = party.value.findIndex(p => p.uid === uid)
    if (index < 0) return null
    if (party.value.length <= 1) return 'Du måste ha minst en Pokémon i laget.'
    if (party.value[index].currentHp > 0 && party.value.filter(p => p.currentHp > 0).length <= 1) return 'Minst en Pokémon som kan slåss måste stanna i laget.'
    const [pokemon] = party.value.splice(index, 1)
    box.value.push(pokemon)
    return `${displayNameOf(gameData, pokemon)} skickades till boxen.`
  }

  function moveToParty(uid: string): string | null {
    const index = box.value.findIndex(p => p.uid === uid)
    if (index < 0) return null
    if (party.value.length >= MAX_PARTY) return 'Ditt lag är fullt.'
    const [pokemon] = box.value.splice(index, 1)
    party.value.push(pokemon)
    return `${displayNameOf(gameData, pokemon)} gick med i laget.`
  }

  function setNickname(uid: string, nickname: string): void {
    const pokemon = findPokemon(uid)
    if (pokemon) pokemon.nickname = nickname.trim().slice(0, 12) || undefined
  }

  // ---------------------------------------------------------------------------
  // Party management and using items outside battle. Each returns a message for the UI, or null when nothing happened.
  // ---------------------------------------------------------------------------

  /** Moves a party member from one slot to another (the first able Pokémon leads in battle). */
  function moveParty(from: number, to: number): boolean {
    if (from === to || from < 0 || to < 0 || from >= party.value.length || to >= party.value.length) return false
    const [moved] = party.value.splice(from, 1)
    party.value.splice(to, 0, moved)
    return true
  }

  function nameOf(pokemon: OwnedPokemon): string {
    return displayNameOf(gameData, pokemon)
  }

  function useHealingItem(item: string, uid: string): string | null {
    const pokemon = party.value.find(p => p.uid === uid)
    if (!pokemon || count(item) < 1) return null
    if (item in BALANCE.POTION_HEALS) {
      const max = maxHpOf(gameData, pokemon)
      if (pokemon.currentHp <= 0 || pokemon.currentHp >= max) return null
      const healed = Math.min(BALANCE.POTION_HEALS[item], max - pokemon.currentHp)
      pokemon.currentHp += healed
      removeItem(item)
      return `${nameOf(pokemon)} fick tillbaka ${healed} HP.`
    }
    const cures: Record<string, StatusId> = { 'antidote': 'poison', 'paralyze-heal': 'paralysis' }
    const status = cures[item]
    if (status && pokemon.status === status) {
      pokemon.status = undefined
      removeItem(item)
      return `${nameOf(pokemon)} blev frisk.`
    }
    return null
  }

  /** Feeding a berry: +trust and a little HP. */
  function feedBerry(uid: string): string | null {
    const pokemon = party.value.find(p => p.uid === uid)
    if (!pokemon || count('oran-berry') < 1) return null
    removeItem('oran-berry')
    pokemon.trust = Math.min(BALANCE.TRUST_MAX, pokemon.trust + BALANCE.TRUST_BERRY)
    if (pokemon.currentHp > 0) pokemon.currentHp = Math.min(maxHpOf(gameData, pokemon), pokemon.currentHp + BALANCE.ORAN_BERRY_HEAL)
    return `${nameOf(pokemon)} älskade bäret! Förtroendet ökade.`
  }

  /** Gives a held item (swapping with what it already holds). */
  function giveHeldItem(item: string, uid: string): string | null {
    const pokemon = party.value.find(p => p.uid === uid)
    if (!pokemon || count(item) < 1 || !itemInfo(gameData, item).holdable) return null
    const previous = pokemon.heldItem
    removeItem(item)
    pokemon.heldItem = item
    if (previous) addItem(previous)
    const label = itemInfo(gameData, item).name
    return previous
      ? `${nameOf(pokemon)} fick ${label} och lämnade tillbaka ${itemInfo(gameData, previous).name}.`
      : `${nameOf(pokemon)} håller nu ${label}.`
  }

  function takeHeldItem(uid: string): string | null {
    const pokemon = party.value.find(p => p.uid === uid)
    if (!pokemon?.heldItem) return null
    const item = pokemon.heldItem
    delete pokemon.heldItem
    addItem(item)
    return `${nameOf(pokemon)} lämnade tillbaka ${itemInfo(gameData, item).name}.`
  }

  /** TM compatibility from the species' `machine` learnset. */
  function tmStatus(item: string, pokemon: OwnedPokemon): 'can' | 'known' | 'cannot' {
    const move = itemInfo(gameData, item).tmMove
    if (!move) return 'cannot'
    if (pokemon.moves.some(m => m.move === move)) return 'known'
    return gameData.species[pokemon.speciesId].tmMoves.includes(move) ? 'can' : 'cannot'
  }

  /** Teaches a TM move. `replaceIndex` is needed when the Pokémon already knows four moves. TMs are not consumed. */
  function teachTm(item: string, uid: string, replaceIndex: number | null): string | null {
    const pokemon = party.value.find(p => p.uid === uid)
    if (!pokemon || !isTm(item) || count(item) < 1 || tmStatus(item, pokemon) !== 'can') return null
    const move = itemInfo(gameData, item).tmMove!
    const label = gameData.moves[move].displayName
    if (pokemon.moves.length >= BALANCE.MAX_MOVES && replaceIndex === null) return null
    const forgotten = replaceIndex !== null ? pokemon.moves[replaceIndex] : undefined
    const lostFavorite = learnMove(gameData, pokemon, move, pokemon.moves.length < BALANCE.MAX_MOVES ? null : replaceIndex, BALANCE)
    const text = forgotten
      ? `${nameOf(pokemon)} glömde ${gameData.moves[forgotten.move].displayName} och lärde sig ${label}!`
      : `${nameOf(pokemon)} lärde sig ${label}!`
    return lostFavorite ? `${text} ${nameOf(pokemon)} verkar ledsen över att ha glömt sin favorit.` : text
  }

  function serialize(): PlayerSave {
    return JSON.parse(JSON.stringify({
      name: name.value, party: party.value, box: box.value, money: money.value, bag: bag.value,
      badges: badges.value, pokedex: pokedex.value, pokedexSeen: pokedexSeen.value, stepRemainder: stepRemainder.value, playTimeMs: playTimeMs.value,
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
    pokedexSeen.value = save.pokedexSeen ?? [...save.pokedex]
    stepRemainder.value = save.stepRemainder
    playTimeMs.value = save.playTimeMs ?? 0
  }

  return {
    name, party, box, money, bag, badges, pokedex, pokedexSeen, markSeen, stepRemainder, playTimeMs, ablePokemon, hasAbleParty,
    reset, count, addItem, removeItem, spend, addPokemon, healAll, findPokemon, addSteps, totalHpFraction, serialize, hydrate,
    moveToBox, moveToParty, setNickname, moveParty, useHealingItem, feedBerry, giveHeldItem, takeHeldItem, tmStatus, teachTm,
  }
})
