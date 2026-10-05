// Trainer classes for the big world: a class gives the title, the look and a pool of things to say, so a route can have ten trainers
// without ten hand-written dialogs. `trainer()` defines and registers one trainer and returns its placement for `MapBuilder.trainer`.
import type { SpriteKey } from './themes/types'
import { RIVAL_NAME, rivalTeam } from './rival'
import { registerTrainer } from './trainers'
import type { Direction, TrainerDef, TrainerMon } from './types'

interface TrainerClass {
  title: string
  sprite: SpriteKey
  look: TrainerDef['look']
  intro: string[]
  defeated: string[]
}

export type ClassId =
  | 'youngster' | 'lass' | 'bugcatcher' | 'hiker' | 'fisher' | 'sailor' | 'picnicker' | 'scientist' | 'karate' | 'psychic' | 'swimmer' | 'gymstudent'

export const CLASSES: Record<ClassId, TrainerClass> = {
  youngster: {
    title: 'Ung tränare', sprite: 'youngster', look: 'boy',
    intro: ['Hallå där! Vi slåss!', 'Du har Pokémon, jag har Pokémon. Då så!', 'Jag har tränat hela veckan. Nu ska det bli av!', 'Ögonkontakt! Det betyder strid!'],
    defeated: ['Aj! Du var starkare än jag trodde.', 'Jag förlorade... Jag måste träna mer.', 'Okej, okej, du vann.', 'Wow! Du är bra!'],
  },
  lass: {
    title: 'Ung tränare', sprite: 'lass', look: 'girl',
    intro: ['Ska vi slåss? Mina Pokémon är gulliga men starka!', 'Jag har ett lag jag är jättestolt över!', 'Titta! Du har Pokémon! Då slåss vi!', 'Jag har väntat på någon att slåss med!'],
    defeated: ['Åh nej, mina söta Pokémon!', 'Du var bättre än jag. Grattis!', 'Det var en bra strid!', 'Nästa gång vinner jag!'],
  },
  bugcatcher: {
    title: 'Insektsfångare', sprite: 'bugcatcher', look: 'bugcatcher',
    intro: ['Jag älskar insekter! Vill du se mina?', 'Mitt håv är fullt av starka insekter!', 'Insekter är de bästa Pokémonen. Bevisa motsatsen!', 'Hör du surret? Det är mina Pokémon som vill slåss!'],
    defeated: ['Mina insekter! De var starkare i mitt huvud...', 'Du krossade mina kryp!', 'Okej, en insekt är inte allt.', 'Jag ska fånga fler och komma tillbaka!'],
  },
  hiker: {
    title: 'Bergsklättrare', sprite: 'hiker', look: 'hiker',
    intro: ['Bergsluften gör en stark! Vi slåss!', 'Jag har gått hela dagen. Nu behöver jag en strid!', 'Stenhårda Pokémon! Försök knäcka dem!', 'Ingen går förbi mig utan att slåss!'],
    defeated: ['Du var hårdare än berget!', 'Mina ben... och min stolthet...', 'Bra gjort. Vägen är din.', 'Det där var ett riktigt jordskred!'],
  },
  fisher: {
    title: 'Fiskare', sprite: 'fisher', look: 'old',
    intro: ['Fiskelyckan har inte varit med mig. Men striden kanske!', 'Håll i ditt spö! Vi slåss!', 'Jag fiskar alla dagar. Mina Pokémon är uthålliga!', 'Det nappar inte, så då slåss vi!'],
    defeated: ['Den där slank mellan fingrarna!', 'Du drog i land en seger!', 'Jag var bara oturlig.', 'Bra fångst!'],
  },
  sailor: {
    title: 'Sjöman', sprite: 'sailor', look: 'boy',
    intro: ['Ahoj! Vill du prova sjögången?', 'Jag har seglat över alla hav! Slåss vi?', 'Man överbord! Eller... du vill slåss?', 'Mina Pokémon tål vågorna. Tål du dem?'],
    defeated: ['Skeppet sjönk!', 'Du har sjöben, vännen.', 'Fyra famnar vatten under kölen... jag förlorade.', 'Ahoj, och tack för striden!'],
  },
  picnicker: {
    title: 'Picknickare', sprite: 'picnicker', look: 'girl',
    intro: ['Vi åt lunch, men en strid är roligare!', 'Mina Pokémon har ätit gott. Nu vill de leka!', 'Vill du ha en macka? Efter striden, då!', 'Solskenet gör mig på bra humör. Slåss!'],
    defeated: ['Min picknick är förstörd!', 'Du var duktig!', 'Okej, du får en macka ändå.', 'Det var kul!'],
  },
  scientist: {
    title: 'Forskare', sprite: 'scientist', look: 'professor',
    intro: ['Fascinerande! En testperson! Vi slåss!', 'Min forskning kräver data. Slåss med mig!', 'Jag har en teori om dina Pokémon. Låt oss testa!', 'Vänta, jag skriver ner det här. Sådär. Nu kör vi!'],
    defeated: ['Min hypotes var fel!', 'Data insamlad. Du vann.', 'Intressant... mycket intressant.', 'Jag måste revidera mina anteckningar.'],
  },
  karate: {
    title: 'Karatekämpe', sprite: 'karate', look: 'boy',
    intro: ['Hyaa! Visa vad du går för!', 'Kämpaglädje! Jag vill träna mot dig!', 'Respekt och strid! Det är min väg!', 'Min dojo har lärt mig allt. Kom an!'],
    defeated: ['Hyaa... jag böjer mig.', 'Du slog igenom mitt försvar!', 'Din strid var ärlig. Tack.', 'Jag tränar mer. Osu!'],
  },
  psychic: {
    title: 'Medium', sprite: 'psychic', look: 'girl',
    intro: ['Jag visste att du skulle komma. Jag såg det.', 'Dina tankar är lätta att läsa. Slåss!', 'Stjärnorna sa att jag skulle möta dig idag.', 'Blunda... och förbered dig!'],
    defeated: ['Det där såg jag inte komma.', 'Mina syner var suddiga idag.', 'Du har en stark vilja.', 'Framtiden är ovisst, trots allt.'],
  },
  swimmer: {
    title: 'Simmare', sprite: 'sailor', look: 'boy',
    intro: ['Plask! Redo för en dyk i strid?', 'Jag simmar varje morgon. Min kondition är grym!', 'Vattnet är fint. Striden blir finare!', 'Hoppa i! Jag menar, slåss!'],
    defeated: ['Jag sjönk som en sten...', 'Du gjorde vågor!', 'Bra simtag!', 'Nästa gång simmar jag ifatt dig.'],
  },
  gymstudent: {
    title: 'Gymelev', sprite: 'youngster', look: 'boy',
    intro: ['Du kommer inte förbi mig till ledaren!', 'Jag är ledarens elev. Du måste slå mig först!', 'Gymmet har regler. Regel ett: slåss!', 'Bra att du tog dig hit. Nu får du göra det på riktigt!'],
    defeated: ['Ledaren blir besviken...', 'Jag förlorade men lärde mig något.', 'Gå vidare. Ledaren väntar.', 'Du är värd att möta ledaren.'],
  },
}

const pick = <T>(list: T[], id: string): T => list[[...id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % list.length]

export type TeamSpec = (TrainerMon | [number, number] | [number, number, string[]])[]

/**
 * Defines (and registers) a trainer of a class and returns the placement for `MapBuilder.trainer`.
 * `team` is a list of `[speciesId, level]` (or full `TrainerMon`s with moves). `sprite` overrides the class look, `say` the lines.
 */
export function trainer(
  id: string, name: string, cls: ClassId, position: { x: number, y: number, facing: Direction | 'auto', sight?: number }, team: TeamSpec,
  extra: { sprite?: SpriteKey, intro?: string[], defeated?: string[], title?: string } = {},
): { id: string, x: number, y: number, facing: Direction | 'auto', sight?: number } {
  const c = CLASSES[cls]
  registerTrainer({
    id,
    name,
    title: extra.title ?? c.title,
    look: c.look,
    sprite: extra.sprite ?? c.sprite,
    team: team.map(t => (Array.isArray(t) ? { speciesId: t[0], level: t[1], ...(t[2] ? { moves: t[2] } : {}) } : t)),
    intro: extra.intro ?? [pick(c.intro, id)],
    defeated: extra.defeated ?? [pick(c.defeated, id)],
  })
  return { id, ...position }
}

/** A rival battle (round 1-3). The real team is chosen when the battle starts (see rival.ts); the one here only gives the prize its level. */
export function rivalTrainer(
  id: string, round: 1 | 2 | 3, position: { x: number, y: number, facing: Direction | 'auto', sight?: number }, lines: { intro: string[], defeated: string[] },
): { id: string, x: number, y: number, facing: Direction | 'auto', sight?: number } {
  registerTrainer({
    id, name: RIVAL_NAME, title: 'Rivalen', look: 'boy', sprite: 'rival', rival: { round }, team: rivalTeam(round, 4), intro: lines.intro, defeated: lines.defeated,
  })
  return { id, ...position }
}

/** A gym leader: the badge, a TM that fits the gym's type and what they say. Returns the placement. */
export function gymLeader(
  id: string, name: string, sprite: SpriteKey, position: { x: number, y: number, facing: Direction | 'auto', sight?: number }, team: TeamSpec,
  gym: NonNullable<TrainerDef['gym']>, lines: { intro: string[], defeated: string[] },
): { id: string, x: number, y: number, facing: Direction | 'auto', sight?: number } {
  registerTrainer({
    id, name, title: 'Gymledare', look: 'leader', sprite,
    team: team.map(t => (Array.isArray(t) ? { speciesId: t[0], level: t[1], ...(t[2] ? { moves: t[2] } : {}) } : t)),
    intro: lines.intro, defeated: lines.defeated, gym,
  })
  return { id, ...position, sight: position.sight ?? 0 }
}
