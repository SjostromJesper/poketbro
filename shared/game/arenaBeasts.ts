import type { Combatant } from './battle'
import { WEAPON_TYPE_SKILL_KEY, type WeaponType } from './items'
import { emptyStats, type StatBlock } from './races'
import { tacticById } from './tactics'

/** Fractional emphasis across general stats + the beast's own weapon skill - must sum to 1. */
interface StatFocus {
  strength: number
  endurance: number
  health: number
  initiative: number
  evasion: number
  weapon: number
}

const BRUTE: StatFocus = { strength: 0.30, endurance: 0.15, health: 0.25, initiative: 0.05, evasion: 0.05, weapon: 0.20 }
const FAST: StatFocus = { strength: 0.15, endurance: 0.10, health: 0.15, initiative: 0.25, evasion: 0.25, weapon: 0.10 }
const TANKY: StatFocus = { strength: 0.20, endurance: 0.25, health: 0.30, initiative: 0.05, evasion: 0.05, weapon: 0.15 }
const BALANCED: StatFocus = { strength: 0.15, endurance: 0.15, health: 0.20, initiative: 0.15, evasion: 0.15, weapon: 0.20 }
const SKIRMISHER: StatFocus = { strength: 0.20, endurance: 0.10, health: 0.15, initiative: 0.20, evasion: 0.15, weapon: 0.20 }

export interface ArenaBeast {
  id: string
  name: string
  description: string
  /** 1-20 difficulty tier - purely a scaling/display number, since characters cap at level 4 and everyone graduated can challenge any beast on this list. */
  grade: number
  weaponType: WeaponType
  statFocus: StatFocus
}

/**
 * A fixed, named roster in the spirit of Lanista's arena beast list (per the
 * screenshot) - not a copy of their specific creatures, made up fresh per "var
 * fantasifull". Reaching level 4 (graduated) unlocks the whole list; the "grade"
 * only scales how tough each one is, since our own leveling stops at 4.
 */
export const ARENA_BEASTS: ArenaBeast[] = [
  { id: 'forest_boar', name: 'Skogsvildsvin', description: 'Ett bångstyrigt vildsvin med huggtänder som flisar sköldar.', grade: 1, weaponType: 'thrust', statFocus: BRUTE },
  { id: 'young_werewolf', name: 'Ung varulv', description: 'Har ännu inte lärt sig kontrollera sin egen styrka - eller sitt raseri.', grade: 2, weaponType: 'chain', statFocus: FAST },
  { id: 'hawk_swarm', name: 'Rovfågelsvärm', description: 'Ett moln av näbbar och klor som anfaller från alla håll samtidigt.', grade: 3, weaponType: 'thrust', statFocus: FAST },
  { id: 'bog_beast', name: 'Träskodjur', description: 'Stiger upp ur dyn utan förvarning och drar sina offer ner i gyttjan.', grade: 4, weaponType: 'hammer', statFocus: TANKY },
  { id: 'crag_lurker', name: 'Klippnjur', description: 'Ser ut som sten tills den reser sig - då är det för sent att fly.', grade: 5, weaponType: 'hammer', statFocus: TANKY },
  { id: 'desert_scorpion', name: 'Ökenskorpion', description: 'Giftet i dess stjärt kan förlama en gladiator på ett enda hugg.', grade: 6, weaponType: 'thrust', statFocus: SKIRMISHER },
  { id: 'cave_troll', name: 'Grottroll', description: 'Enorm och dum, men stark nog att vika ett svärd i sina bara nävar.', grade: 7, weaponType: 'hammer', statFocus: BRUTE },
  { id: 'wild_hag', name: 'Vildhäxa', description: 'Viskar förbannelser mellan varje piskrapp av sin tornrankevisp.', grade: 8, weaponType: 'chain', statFocus: BALANCED },
  { id: 'mountain_giant', name: 'Bergsjätte', description: 'Varje steg den tar får arenans läktare att skaka.', grade: 9, weaponType: 'hammer', statFocus: BRUTE },
  { id: 'shadow_panther', name: 'Skuggpanter', description: 'Syns knappt förrän klorna redan har hittat sitt mål.', grade: 10, weaponType: 'sword', statFocus: FAST },
  { id: 'frost_wolf', name: 'Frostvarg', description: 'Andedräkten fryser svetten på huden innan tänderna ens når fram.', grade: 11, weaponType: 'chain', statFocus: FAST },
  { id: 'fire_salamander', name: 'Eldsalamander', description: 'Lämnar ett spår av förkolnad sand efter varje utfall.', grade: 12, weaponType: 'thrust', statFocus: SKIRMISHER },
  { id: 'basilisk', name: 'Basilisk', description: 'Möt inte dess blick - fokusera på fötterna och hoppas på det bästa.', grade: 13, weaponType: 'chain', statFocus: SKIRMISHER },
  { id: 'undead_knight', name: 'Odöd riddare', description: 'Dog på arenan för hundra år sedan. Har fortfarande inte fått nog.', grade: 14, weaponType: 'sword', statFocus: BALANCED },
  { id: 'griffon_chick', name: 'Griffonunge', description: 'Inte fullvuxen än - men redan stark nog att lyfta en gladiator i luften.', grade: 15, weaponType: 'thrust', statFocus: FAST },
  { id: 'chimera', name: 'Kimära', description: 'Tre huvuden, tre sätt att dö - helst inte samtidigt.', grade: 16, weaponType: 'axe', statFocus: BALANCED },
  { id: 'dragon_guard', name: 'Drakvakt', description: 'Fjällpansrad krigare i en forntida drakes tjänst.', grade: 17, weaponType: 'sword', statFocus: TANKY },
  { id: 'ancient_dragon', name: 'Åldrig drake', description: 'Har sett fler gladiatorer komma och gå än någon minns.', grade: 18, weaponType: 'hammer', statFocus: BRUTE },
  { id: 'demon_lord', name: 'Demonfurste', description: 'Förhandlar aldrig. Slåss bara för att se dig förlora.', grade: 19, weaponType: 'axe', statFocus: BALANCED },
  { id: 'primordial_horror', name: 'Urtidsvidunder', description: 'Äldre än Stenhem själv. Arenans yttersta prövning.', grade: 20, weaponType: 'hammer', statFocus: BRUTE },
]

export function arenaBeastById(id: string): ArenaBeast | undefined {
  return ARENA_BEASTS.find(b => b.id === id)
}

export function beastRewardGold(grade: number): number {
  return Math.round(3 + grade * 0.9)
}

export function beastRewardXp(grade: number): number {
  return Math.round(15 + grade * 4.5)
}

const BASE_BEAST_POOL = 70
const POOL_PER_GRADE = 14

/** Builds a full 1v1 Combatant for a named beast - own stat identity per archetype, no real item/equipment involved. */
export function buildBeastCombatant(beast: ArenaBeast): Combatant {
  const pool = BASE_BEAST_POOL + beast.grade * POOL_PER_GRADE
  const stats: StatBlock = emptyStats()
  stats.strength = Math.round(pool * beast.statFocus.strength)
  stats.endurance = Math.round(pool * beast.statFocus.endurance)
  stats.health = Math.round(pool * beast.statFocus.health)
  stats.initiative = Math.round(pool * beast.statFocus.initiative)
  stats.evasion = Math.round(pool * beast.statFocus.evasion)
  stats[WEAPON_TYPE_SKILL_KEY[beast.weaponType]] = Math.round(pool * beast.statFocus.weapon)

  const weaponMinDamage = Math.max(1, Math.round(2 + beast.grade * 0.8))
  const weaponMaxDamage = Math.max(weaponMinDamage + 2, Math.round(5 + beast.grade * 1.6))
  const weaponRecommendedSkill = Math.round(20 + beast.grade * 3)

  return {
    name: beast.name,
    stats,
    tactic: tacticById('normal'),
    giveUpPercent: 0,
    weaponType: beast.weaponType,
    weaponMinDamage,
    weaponMaxDamage,
    weaponRecommendedSkill,
  }
}
