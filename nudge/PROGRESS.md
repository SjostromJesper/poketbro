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
| P3-M1 - Temasystem | todo |
| P3-M2 - Strids-avslut | todo |
| P3-M3 - Supabase | todo |
| P3-M4 - Världens system | todo |
| P3-M5 - Världen del 1 | todo |
| P3-M6 - Världen del 2 | todo |
| P3-M7 - Balans och genomspelning | todo |
