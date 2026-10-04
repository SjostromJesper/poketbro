# DECISIONS

Running log of decisions taken while building Nudge from `PLAN.md` (newest sections at the bottom).

## Project setup (M1)

- **Lives inside the existing gladiator project** (`game-proj`), as the user asked for a "new page in the same project".
  Everything Nudge-specific is namespaced:
  - headless TypeScript (engine, data, game content, scripts, tests): `nudge/`
  - Vue code: `app/pages/nudge/`, `app/components/nudge/`, `app/stores/nudge/`
  - docs: `nudge/DECISIONS.md`, `nudge/PROGRESS.md`, `nudge/README.md`
  The plan's top-level `/engine`, `/data`, ... therefore became `nudge/engine`, `nudge/data`, ...
- **npm instead of pnpm.** The project already uses npm (`package-lock.json`) and pnpm is not installed. The script names are
  the ones from the plan (`npm run dev|build|test|typecheck|fetch-data|sim`).
- **Added dependencies:** `pinia` + `@pinia/nuxt` (state), `vitest` (tests), `tsx` (scripts), `typescript`, `vue-tsc`, `@types/node`.
  TypeScript is pinned to `~5.9.3`: `latest` is 7.x, which `vue-tsc` cannot run on.
- **SPA only for Nudge.** `routeRules` set `ssr: false` for `/nudge` and `/nudge/**`; the rest of the app keeps SSR.
  `@nuxtjs/supabase`'s login redirect is disabled for `/nudge` and `/nudge/*` (Nudge needs no account, saves go to `localStorage`).
- **`app.vue` skips the gladiator shell** (header/sidebar/theme) on `/nudge` routes; Nudge pages are full-screen.
- **`npm run typecheck` only covers Nudge code**: `vue-tsc` on `nudge/tsconfig.vue.json` (Nudge pages/components/stores),
  `tsc` on `nudge/engine/tsconfig.json` (no DOM, no node types, so the engine provably has no Vue/Nuxt/DOM/Node dependencies)
  and `tsc` on `nudge/tsconfig.json` (everything else under `nudge/`). The older gladiator game has ~300 pre-existing type
  errors (`noUncheckedIndexedAccess`, untyped Supabase client) and is deliberately not included. One genuine error in
  `server/api/characters/create.post.ts` was fixed because Nuxt's generated types pull that file in.
- **Dev server on port 3100** (`.claude/launch.json` has a `nudge-dev` entry) because port 3000 is used by another project.
- **Git:** the repository had no commits yet. Milestone commits only stage Nudge files plus the shared config they touch
  (`package.json`, `package-lock.json`, `nuxt.config.ts`, `app/app.vue`, `vitest.config.ts`, `.claude/launch.json`).
  The gladiator game stays untracked as before.

## Data (M1)

- **Moves are identified by their PokeAPI name** (`razor-leaf`), species by numeric id. JSON files:
  `pokemon.json` (array, one species per line), `moves.json` (keyed by name), `types.json` (attacker -> defender -> multiplier,
  only non-1 entries), `natures.json`, `growth-rates.json` (index = level -> cumulative XP), `items.json`.
- **Modern types and type chart** (18 types incl. Fairy, so Clefairy is Fairy) straight from PokeAPI, not the Gen 3 chart.
- **Swedish names:** PokeAPI has no Swedish names for these species, so every display name falls back to English.
- **Evolutions:** only `trigger: level-up` with a `min_level`, and only when both species are inside #1-151.
- **Learnsets:** `firered-leafgreen`; `level-up` -> level-up moves, `machine` -> TM compatibility. Level 0 entries are treated as level 1.
- **Sprites:** the animated Gen 5 sprites (`front`/`back`) with static fallback, and `front_default` as the menu icon; loaded at runtime
  straight from the PokeAPI sprite repo on GitHub.
