# PROGRESS

| Milestone | Status |
|---|---|
| M1 - Projekt och data | done |
| M2 - Stridsmotorn (headless) | done |
| M3 - Strids-UI | todo |
| M4 - Överkartan | todo |
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
