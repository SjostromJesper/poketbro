# Nudge

A Pokémon auto-battler prototype built into this Nuxt project. You explore a classic grid map (tall grass, trainers, a gym), but fights run **by themselves in real time**
on an ATB timer: each Pokémon picks its own moves, and you only *nudge* it by clicking one of its moves to make that move more likely at its next choice.
Everything you do beforehand (moves/TMs, held items, team order, nature, trust) shapes how well it listens and how smart it fights.

> Private hobby prototype. Pokémon data and sprites come from [PokeAPI](https://pokeapi.co); it must not be published or sold. Game text is Swedish, code is English.

## Run it

```bash
npm install
npm run dev                  # then open http://localhost:3000/nudge  (or whatever port Nuxt prints)
npm run dev -- --port 3100   # pick another port if 3000 is taken
```

| Page | What it is |
|---|---|
| `/nudge` | Title screen: Fortsätt / Nytt spel / Inställningar |
| `/nudge/play` | The game |
| `/nudge/dev/battle` | Test battle with any Pokémon, levels, traits, natures, trust, items |

Nudge needs no login (the rest of this project, the gladiator game, does). Saves live in your browser's `localStorage` (key `nudge:save:v1`).

## Controls

| | |
|---|---|
| Arrows / WASD | walk (tap = turn, hold = walk) |
| Shift | run |
| Space / Enter / Z | talk, read, advance dialog |
| Esc / X | menu (Lag, Väska, Spara, Inställningar, Titelskärm), also "back" |
| In battle: click a move, or 1-4 | **nudge** that move |
| P | pause the battle |
| D | toggle the debug overlay |
| 1x / 2x / 3x buttons | battle speed |

Nudge rules in short: a Pokémon has a small nudge budget per battle (3, depending on its trait), each nudge pulls less than the last, and higher **trust** makes a nudge stronger
and the Pokémon smarter. Pokémon above the badge level cap (15 + 10 per badge) sometimes ignore you.

## Debug

* In battle press **D**, or open the game with `?debug=1` (e.g. `/nudge/play?debug=1`, `/nudge/dev/battle?debug=1`), or tick "Debug-overlay" in the settings.
  The overlay shows, live, for both sides: trait, nature, trust, smartness, ATB value and fill rate, effective speed, HP, the nudge budget and the pending nudge, the category weights
  and for every move `p_auto` (what it would do on its own), `p_final` (with the nudge) and the expected damage.
* Dev shortcuts for `/nudge/play` (they start a new game, they do not touch your save):
  `?map=gruss&x=11&y=13&starter=1&party=charmander:12,pidgey:8&balls=10&money=3000&badges=1&open=starter|shop&menu=party|bag|summary&encounter=16:3&say=Hej`
* `/nudge/dev/battle?p=bulbasaur:46,pidgey:12&e=chansey:30&kind=trainer&badges=2&seed=7&go=1`

## Scripts

```bash
npm test                 # Vitest: engine, data, maps, controller, whole-game flow, saves, an automatic playthrough (200 tests)
npm run typecheck        # vue-tsc for the Nudge Vue code + tsc for the engine (no DOM/Node types) and for everything else under nudge/
npm run fetch-data       # (re)generate nudge/data/*.json from PokeAPI (cached in .cache/pokeapi/)
npm run sim -- --battles 1500 --player charmander:12 --enemy bulbasaur:12   # headless batch simulation, with and without the nudge bot
npm run build            # production build (the whole project)
BENCH=1 XP_MULTS=1.5 npx vitest run nudge/tests/bench.test.ts               # pacing benchmark with the playthrough bot
```

`npm run sim` options: `--battles N --seed N --player charmander:12,pidgey:8 --enemy geodude:10,onix:12 --trust N --trait loyal --strategy none|best|always-best --badges N --set KEY=JSON`
(`--set NUDGE_BUDGET_BASE=4` overrides any value in `engine/balance.ts` for the experiment).

## Layout

```
nudge/
  engine/      pure TypeScript battle engine (no Vue/DOM/Node): balance, rng, formulas, atb, choice, nudge, obedience, status, moveExec, battle, progression, ...
  data/        generated PokeAPI JSON (#1-151, FireRed/LeafGreen learnsets) + types
  game/        maps, tiles, trainers, encounters, items, world logic, summary, save format
  scripts/     fetch-data.ts, sim.ts
  tests/       Vitest tests (+ the playthrough bot)
  PLAN.md      (the original plan lives outside the repo)  DECISIONS.md  PROGRESS.md
app/pages/nudge/        index (title), play, dev/battle
app/components/nudge/   battle, overworld, game (modals), menu
app/stores/nudge/       Pinia: settings, battle, world, player, game, storage
```

All balance numbers are in `nudge/engine/balance.ts`. Decisions and the balance log are in `DECISIONS.md`, milestone status in `PROGRESS.md`.

## Not in the MVP

Abilities, double battles, more gyms / a rival / story, real tilesets and player sprites (the tile renderer has a plug-in point), sound, mobile controls, evolution stones/trades/friendship.
