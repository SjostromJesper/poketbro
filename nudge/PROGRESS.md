> ## ⚠ Supabase: två saker att göra (P3-M3)
>
> Spelet fungerar redan med bara lokal sparning, men för molnsparningen behöver du:
>
> 1. **Kör SQL:en** i `supabase/migrations/0014_nudge_saves.sql` i Supabase SQL Editor (projektet `xduqbyjrditfzsibcujz`). Den skapar bara en ny tabell, `save_slots`, med RLS-policyer och en trigger. Supabase CLI är inte inloggad/länkad här, så jag kunde inte köra den själv.
> 2. **Slå på anonym inloggning:** Authentication → Sign In / Providers → "Allow anonymous sign-ins". Idag svarar projektet "Anonymous sign-ins are disabled" (kontrollerat i dev-servern), därför visar inställningarna "Sparar bara i den här webbläsaren".
>
> För att kunna koppla e-post och logga in på andra enheter måste dessutom e-postinloggning och en redirect-URL till `/nudge` vara tillåtna (Authentication → URL Configuration).

# PROGRESS

| Milestone | Status |
|---|---|
| M1 - Projekt och data | done |
| M2 - Stridsmotorn (headless) | done |
| M3 - Strids-UI | done |
| M4 - Överkartan | done |
| M5 - Kopplingen karta <-> strid | done |
| M6 - Lag, items, relation | done |
| M7 - Gym, sparning, polish | done |
| M8 - Balans och avslut | done |

## M1 - Projekt och data
- Nuxt/Pinia/Vitest/tsx set up inside the existing project, scripts `dev`, `build`, `test`, `typecheck`, `fetch-data`, `sim`.
- `npm run fetch-data` produces `nudge/data/*.json` (151 species, 302 moves, 18-type chart, 25 natures, 6 growth rates, 10 items). 741 requests, ~12 s, cached in `.cache/pokeapi/`.
- Verified: Bulbasaur has the correct FireRed/LeafGreen learnset (tests in `nudge/tests/data.test.ts`), the type chart and natures are correct.
- `/nudge` route works without login (placeholder title screen).

Known issues: none.

## M2 - Stridsmotorn (headless)
- `nudge/engine/*` complete per plan section 5 (ball/item/run/switch are fully implemented, not stubs).
- 128 Vitest tests (formulas, type chart incl. dual types and immunities, nature stats, ATB tempo, charge/recharge/priority, move choice
  distribution and p_final normalisation, nudge curve/budget per trait, obedience, status effects, XP/capture/flee, progression, determinism).
- `npm run sim` gives sensible numbers; the nudge bot gives a noticeable (~+5-7 pp win rate) but not overwhelming edge.
- `npm run typecheck` is green (Nudge code only, see DECISIONS.md).

Known issues / open balance questions (for M8): neutral natures make Pokémon use status moves fairly often (e.g. Growl ~35 %), paralysis is
mild because of the speed offset, equal-level 1v1s favour whoever has the type advantage. 60 moves are inert (listed in DECISIONS.md).

## M3 - Strids-UI
- `/nudge/dev/battle`: configurable test battle (wild/trainer, up to 6 Pokémon per side, trait/nature/trust/held item per Pokémon).
- Battle screen per plan 8.1: animated sprites, panels with HP bar + ATB bar (blinks while charging), status chips, stat stages, move buttons
  with type colours/PP, nudge pips and a glowing pending nudge, Boll / Väska / Byt / Fly, 1x-2x-3x and pause, log of the last 5 lines,
  emotes (!, ♪, ..., 💢, 💤), floating damage numbers, switch and bag menus, result overlay. Keys 1-4 nudge, P pauses, D toggles debug.
- Debug overlay (`?debug=1`) shows live p_auto/p_final per move, trust, nudge budget, ATB and effective speed.
- Verified in the browser: a full wild battle (Bulbasaur Solar Beam charge text, multi-hit, win overlay and XP), a trainer battle with team
  switching menu, nudge emotes/floaters/log, debug numbers updating after a nudge.

Known issues: none. (Visual verification of animations was limited because the automation pane is a hidden tab with no animation frames.)

## M4 - Överkartan
- `/nudge/play`: canvas overworld (15x11 viewport, smooth steps, camera, walk/run, dialog with typewriter, signs, NPCs, doors with fade + map name banner,
  menu stub). Placeholder graphics drawn in canvas; tileset plug-in point in place.
- Nine maps: Hemstad, home, lab, Väg 1, Viridianskogen, Grusstad, Pokémon Center, Pokémart, gym - with trainers, wild encounter tables, signs and NPCs defined
  (encounters/trainers/shop/healing are wired up in M5).
- 34 new tests (map validity and reachability, world logic, controller incl. a BFS-planned walk Hemstad -> Väg 1 -> forest -> Grusstad through the real controller).
- Verified with headless Chrome screenshots of Hemstad, Grusstad, the forest and the lab dialog.

Known issues: none.

## M5 - Kopplingen karta <-> strid
- Full loop in `/nudge/play`: talk to the professor and choose a starter (+5 balls, gate opens), walk through Väg 1 and the forest, wild encounters in tall
  grass with a flash transition, trainers that spot you and walk up, catching with Poké Balls, XP and level-ups, move replacement dialog, evolution prompt,
  blackout, Pokémon Center / Mum healing, Pokémart shop, money and gym badge + TM.
- 11 integration tests in `gameFlow.test.ts` on top of the earlier ones (173 tests in total).
- Verified with headless Chrome screenshots (starter choice, wild battle launched from the map, shop).

Known issues: none. The balance of XP/money/prices is untouched until M8.

## M6 - Lag, items, relation
- Menu with party screen (reorder, held items), summary screen (stats, nature as move preference, trait, trust hearts, moves with effects, habits) and bag
  (healing items, feeding berries, giving held items, TMs with the forget-move dialog).
- All trust sources from plan 4.2 are active; habits persist and influence the debug distribution.
- 17 new tests (190 in total). Headless screenshots of the party and summary screens checked.

Known issues: "Spara", "Inställningar" and "Titelskärm" in the menu do nothing until M7.

## M7 - Gym, sparning, polish
- Gym (two trainers + leader Granit) with badge and TM reward works end to end; the Granit badge and Rock Tomb TM are given by the leader.
- Autosave (map change / after battles / after the starter) + manual save, title screen with Fortsätt / Nytt spel / Inställningar, settings panel, save validation.
- An automatic bot plays the whole game from a new game to the badge for three seeds/starters without crashing (that test covers the full loop).
- 7 save tests + 3 playthrough tests (200 tests in total).

Known issues: pacing is grindy (the bot needs ~80-100 wild battles to reach level 15) - that is what M8 tunes.

## M8 - Balans och avslut
- Balance pass done with the simulator and the playthrough bot (see "Balance (M8)" in DECISIONS.md): category weights, stat-move saturation, paralysis, nudge curve, XP multiplier,
  gym level. Nudging cuts battle time by ~27 % and lost gym attempts by ~50 % over a whole run; trust matters a lot (18 % -> 48 % win rate in the hardest early fight).
- `nudge/README.md`: how to run, controls, debug switches, scripts and layout.
- `npm run build` succeeds (and the production server serves /nudge, /nudge/play); `npm test` 200 passed, 1 benchmark skipped by default; `npm run typecheck` is green.
- The game can be played through from a new game to the Granit badge (automatic bot, 3 seeds x 3 starters).

Known issues / ideas: see the open questions at the end of the M8 balance section; 60 inert moves; no sound; mobile controls out of scope.

# PLAN-2 progress

| Milestone | Status |
|---|---|
| P2-M0 - Hämta paketen | done (all packs downloaded; `npm run fetch-assets`) |
| P2-M1 - Fångst-systemet | done |
| P2-M1B - Favoritmove | done (`npm run sim -- --favorites` jämför lag med tränad favorit) |
| P2-M2 - Ljudmotorn | done (`npm run copy-audio`; musiken kommer i P2-M3) |
| P2-M3 - Musik på plats | done |
| P2-M4 - Kartgrafik | done (`npm run copy-graphics`) |
| P2-M5 - Karaktärer och UI | done (`npm run copy-graphics`) |

Missing packs: none. To fetch everything on a new machine: `npm run fetch-assets`.

# PLAN-3 progress

| Milestone | Status |
|---|---|
| P3-M0 - Hämta grafik | done (all packs downloaded; `npm run fetch-assets`) |
| P3-M1 - Temasystem | done (Tuxemon standard, Ninja Adventure, Pipoya, Kenney; `npm run copy-graphics`) |
| P3-M2 - Strids-avslut | done |
| P3-M3 - Supabase | done in code; **two dashboard steps are needed before the cloud works** (see the box at the top of this file) |
| P3-M4 - Världens system | done (`npm run check-world` skriver ut en rapport) |
| P3-M5 - Världen del 1 | done (8 platser spelbara från start till märke 2; 21 kartor nåbara, 0 problem i `check-world`) |
| P3-M6 - Världen del 2 | done (41 kartor, 4 gym, rival 1-3, 146/146 arter nåbara; `check-world` utan problem) |
| P3-M7 - Balans och genomspelning | done (gym-sim 65-77 % utan nudges, full genomspelning med boten, `npm run build` och `npm test` gröna) |


## PLAN-3: genomspelningsrapport (P3-M7)

**Vad som kördes.** `npm run build` och `npm test` (315 tester) är gröna, `npm run typecheck` likaså, `npm run check-world` ger 41 kartor nåbara från Hemstad, 0 problem med varp/entiteter/Pokémon/moves och 146 av 146 arter möjliga att få.
`playthrough.test.ts` kör en bot med spelets riktiga stores och den riktiga kontrollern, för alla tre starters och tre seeds:

| | Starter 4 (seed 1) | Starter 7 (seed 2) | Starter 1 (seed 3) |
|---|---|---|---|
| Fyra märken i ordning + Lapras | ja | ja | ja |
| Steg totalt | 4 414 | 4 645 | 4 775 |
| Vilda / tränarstrider | 127 / 47 | 138 / 48 | 122 / 49 |
| Förluster (blackout) | 16 | 18 | 15 |
| Ledarens nivå vid gym 1-4 | 16 / 21 / 24 / 28 | 17 / 21 / 24 / 28 | 17 / 21 / 24 / 28 |

Boten tränar bara en Pokémon och byter därför laget mot det förväntade laget före gym 2-4 (en tillåten genväg); gym 1 och all vandring mellan städerna sker utan genvägar. Det mesta av förlusterna kommer från rivalen på Väg 6 och från vilda/tränare i Vildmarken, dvs där man
förväntas ha ett fullt lag.

**Gym-balans** (`npm run sim-gyms`, medel över de tre starters, utan nudges / med enkel nudge-strategi): Granit 72 / 76 %, Kajsa 68 / 78 %, Ture 68 / 79 %, Lilja 65 / 82 %. Typfördelen avgör mycket (t.ex. Charmander mot Granit ~24 %), så det går bra med rätt lag och sämre med fel.

**Hittat och åtgärdat under genomspelningen:** Torsten i Månberget var instängd av en slumpad vägg; en tränare stod i en smal gång i Kraftverket; boten besökte aldrig Center/Mart; teman saknade bitar för sand/klippa/avsats/grottor (nu målade ersättare); `registerTrainer`
kraschade vid hot reload; över- och underbalanserade tränare på Väg 5/6 och i Vildmarken.

**Inte testat / att göra själv:** molnsparningen mot riktiga Supabase (rutan överst i den här filen: kör migrationen och slå på anonym inloggning), Pipoya-temat visas bara om du har filerna lokalt (de checkas aldrig in), och en handspelad genomgång i webbläsaren (boten ersätter den
inte för känslan av balans).


## PLAN-4

| Milestone | Status |
|---|---|
| P4-M1 - Cutscene-motorn | done (`game/cutscene.ts`, `CutsceneScene.vue`, dev-sida `/nudge/dev/cutscene`) |
| P4-M2 - Introt | done (`game/text/intro.ts`, namn och utseende i sparfilen v4) |
| P4-M3 - Starter och tutorial-strid | done |
| P4-M4 - Hoppa över och anteckningar | done |
| P4-M5 - Konton och spelar-ID | todo |
| P4-M6 - Servern: lag, simulering och matcher | todo |
| P4-M7 - Datorn i Pokémon Center | todo |
| P4-M8 - Repriser | todo |
| P4-M9 - ELO och topplistor | todo |
