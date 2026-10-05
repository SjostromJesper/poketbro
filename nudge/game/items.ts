// Item catalog for the game layer: names, descriptions, prices and what each item is for. Battle effects live in the engine
// (potions/antidotes in battle.ts, held-item effects in moveExec/atb/battle); this file is what the shop and bag menus read.
import type { GameData } from '../data/types'

export type ItemKind = 'ball' | 'potion' | 'cure' | 'held' | 'tm' | 'stone' | 'key'

export interface ItemInfo {
  id: string
  name: string
  description: string
  kind: ItemKind
  price: number
  /** Can be used on a Pokémon from the bag during a battle. */
  usableInBattle: boolean
  /** Can be given to a Pokémon to hold. */
  holdable: boolean
  /** For TMs: the move it teaches. */
  tmMove?: string
  sprite?: string
}

const BASE: Record<string, Omit<ItemInfo, 'id' | 'name' | 'sprite'> & { name?: string }> = {
  'poke-ball': { description: 'Fångar vilda Pokémon. Det går lättare när de är försvagade eller har en statusåkomma.', kind: 'ball', price: 100, usableInBattle: false, holdable: false },
  'great-ball': { description: 'En bättre boll än Poké Ball: 1,5 gånger så stor chans att fånga.', kind: 'ball', price: 300, usableInBattle: false, holdable: false },
  'ultra-ball': { description: 'Den bästa bollen: dubbelt så stor chans att fånga som med Poké Ball.', kind: 'ball', price: 600, usableInBattle: false, holdable: false },
  'potion': { description: 'Läker 20 HP hos en Pokémon.', kind: 'potion', price: 150, usableInBattle: true, holdable: false },
  'super-potion': { description: 'Läker 50 HP hos en Pokémon.', kind: 'potion', price: 400, usableInBattle: true, holdable: false },
  'hyper-potion': { description: 'Läker 120 HP hos en Pokémon.', kind: 'potion', price: 800, usableInBattle: true, holdable: false },
  'fire-stone': { description: 'Får vissa Pokémon (Vulpix, Growlithe, Eevee) att utvecklas. Används från väskan.', kind: 'stone', price: 2100, usableInBattle: false, holdable: false },
  'water-stone': { description: 'Får vissa Pokémon (Poliwhirl, Shellder, Staryu, Eevee) att utvecklas. Används från väskan.', kind: 'stone', price: 2100, usableInBattle: false, holdable: false },
  'thunder-stone': { description: 'Får vissa Pokémon (Pikachu, Eevee) att utvecklas. Används från väskan.', kind: 'stone', price: 2100, usableInBattle: false, holdable: false },
  'leaf-stone': { description: 'Får vissa Pokémon (Gloom, Weepinbell, Exeggcute) att utvecklas. Används från väskan.', kind: 'stone', price: 2100, usableInBattle: false, holdable: false },
  'moon-stone': { description: 'Får vissa Pokémon (Nidorina, Nidorino, Clefairy, Jigglypuff) att utvecklas. Används från väskan.', kind: 'stone', price: 2100, usableInBattle: false, holdable: false },
  'old-rod': { description: 'Ett gammalt fiskespö. Ställ dig vänd mot vatten och använd det: du kan fånga små fiskar.', kind: 'key', price: 0, usableInBattle: false, holdable: false },
  'good-rod': { description: 'Ett bra fiskespö: större fiskar nappar.', kind: 'key', price: 0, usableInBattle: false, holdable: false },
  'super-rod': { description: 'Det bästa fiskespöet: de sällsynta fiskarna nappar.', kind: 'key', price: 0, usableInBattle: false, holdable: false },
  'antidote': { description: 'Botar gift.', kind: 'cure', price: 50, usableInBattle: true, holdable: false },
  'paralyze-heal': { description: 'Botar förlamning.', kind: 'cure', price: 100, usableInBattle: true, holdable: false },
  'oran-berry': {
    description: 'Hålls av en Pokémon: läker 10 HP en gång när den har under hälften av sitt liv kvar. Kan också matas till en Pokémon för förtroende.',
    kind: 'held', price: 100, usableInBattle: false, holdable: true,
  },
  'quick-claw': { description: 'Hålls: Pokémonens ATB-bar fylls 10 % snabbare.', kind: 'held', price: 800, usableInBattle: false, holdable: true },
  'silk-scarf': { description: 'Hålls: ökar kraften i Normal-attacker med 20 %.', kind: 'held', price: 600, usableInBattle: false, holdable: true },
  'charcoal': { description: 'Hålls: ökar kraften i Eld-attacker med 20 %.', kind: 'held', price: 600, usableInBattle: false, holdable: true },
  'mystic-water': { description: 'Hålls: ökar kraften i Vatten-attacker med 20 %.', kind: 'held', price: 600, usableInBattle: false, holdable: true },
  'leftovers': { description: 'Hålls: läker lite HP över tid under striden.', kind: 'held', price: 1000, usableInBattle: false, holdable: true },
}

const TM_PRICES: Record<string, number> = { 'double-team': 600, 'rest': 800, 'rock-tomb': 1000 }

export const TM_PREFIX = 'tm:'

export function tmId(move: string): string {
  return `${TM_PREFIX}${move}`
}

export function isTm(id: string): boolean {
  return id.startsWith(TM_PREFIX)
}

export function itemInfo(data: GameData, id: string): ItemInfo {
  if (isTm(id)) {
    const move = id.slice(TM_PREFIX.length)
    const moveName = data.moves[move]?.displayName ?? move
    return {
      id,
      name: `TM ${moveName}`,
      description: `Lär en kompatibel Pokémon ${moveName}. Används inte upp.`,
      kind: 'tm',
      price: TM_PRICES[move] ?? 1000,
      usableInBattle: false,
      holdable: false,
      tmMove: move,
    }
  }
  const base = BASE[id]
  if (!base) throw new Error(`Unknown item "${id}"`)
  return { id, name: data.items[id]?.displayName ?? id, sprite: data.items[id]?.sprite, ...base }
}

/** The shopkeeper pays half the price. */
export function sellPrice(data: GameData, id: string): number {
  return Math.floor(itemInfo(data, id).price / 2)
}

export interface ShopItem {
  item: string
  /** Appears once the player owns at least this many badges. */
  badges: number
}

const always = (...items: string[]): ShopItem[] => items.map(item => ({ item, badges: 0 }))

/** What every Pokémart sells; stock grows with the badges: Great Ball (1), Super Potion (2), Ultra Ball (3), Hyper Potion (4). */
const COMMON: ShopItem[] = [
  ...always('poke-ball', 'potion', 'antidote', 'paralyze-heal', 'oran-berry'),
  { item: 'great-ball', badges: 1 },
  { item: 'super-potion', badges: 2 },
  { item: 'ultra-ball', badges: 3 },
  { item: 'hyper-potion', badges: 4 },
]

/** The extra items of each town's mart (its own TMs; the harbour town also sells the evolution stones). Keys are map ids. */
export const SHOP_EXTRAS: Record<string, ShopItem[]> = {
  gruss_mart: always('tm:double-team', 'tm:rest'),
}

export function shopStock(shopId: string, badges: number): string[] {
  return [...COMMON, ...(SHOP_EXTRAS[shopId] ?? [])].filter(s => badges >= s.badges).map(s => s.item)
}

/** Ball items in the order shown in the battle menu. */
export const BALLS = ['poke-ball', 'great-ball', 'ultra-ball']

/** The three starters the professor offers. */
export const STARTERS = [
  { speciesId: 1, blurb: 'Lugn och uthållig. Bra mot Vatten, Mark och Sten.' },
  { speciesId: 4, blurb: 'Het och snabb. Bra mot Gräs och Insekt.' },
  { speciesId: 7, blurb: 'Stadig och sval. Bra mot Eld, Mark och Sten.' },
]
export const STARTER_LEVEL = 5
export const STARTER_BALLS = 5
