# PROGRESS

| Milestone | Status |
|---|---|
| M1 - Projekt och data | done |
| M2 - Stridsmotorn (headless) | done |
| M3 - Strids-UI | done |
| M4 - Överkartan | done |
| M5 - Kopplingen karta <-> strid | todo |
| M6 - Lag, items, relation | todo |
| M7 - Gym, sparning, polish | todo |
| M8 - Balans och avslut | todo |

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
