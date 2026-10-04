# PROGRESS

| Milestone | Status |
|---|---|
| M1 - Projekt och data | done |
| M2 - Stridsmotorn (headless) | todo |
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
