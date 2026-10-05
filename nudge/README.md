# Viska

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

Viska needs no login (the rest of this project, the gladiator game, does). There are three save slots on the title screen. They live in your browser's `localStorage`
(`nudge:slot:1..3`) and, when Supabase is set up (below), are also synced to the cloud so you can continue on another device.

## Supabase (accounts and cloud saves)

An account is needed to play (e-mail + password, or a sign-in link). It uses the same Supabase project as the rest of this app (`@nuxtjs/supabase`):

1. Environment variables, see `.env.example`: `SUPABASE_URL` and `SUPABASE_KEY` (the **publishable/anon** key, the only one the browser ever sees). The secret key (`NUXT_SUPABASE_SECRET_KEY`) is used by server routes only (creating accounts at `/api/auth/register`, upgrading old anonymous ones at `/api/nudge/upgrade`) and never reaches the browser.
2. Run `supabase/migrations/0014_nudge_saves.sql` (cloud saves, table `save_slots`) and `0015_nudge_profiles.sql` (table `profiles`: trainer name + unique player id like `#1452`, functions `ensure_profile` and `pick_free_tag`) in the SQL Editor or with `supabase db push`. They only add new objects, with row level security.
3. Anonymous sign-in is no longer needed. Players who played anonymously are asked to "Skapa konto för att fortsätta"; the user id stays, so their saves follow. For sign-in links and password reset, allow a redirect URL to `/nudge` under Authentication -> URL Configuration.

Players are shown as `Name #1452` (the name is the trainer name from the intro). Saves are written to the browser at once (`nudge:slot:1..3`) and to the cloud a few seconds later; when a slot changed both here and in the cloud, a dialog lets you pick which one to keep.
For development without an account, add `?noauth=1` to `/nudge` or `/nudge/play` (ignored in production builds).

## Online matches

The computer in every Pokémon Center has a **Nätverk** menu: *Bracket* (send in a team of exactly 3 Pokémon within a level bracket 1-9 ... 90-99, 100; you are matched asynchronously against another player's current team with a near rating), *Utmana* (challenge a player by their id `#1452`, bracket or free),
*Inkorg*, *Repriser* (watch saved matches, pause/1x/2x/4x/skip) and *Standings* (your place and the whole ladder per bracket, ELO). Matches are played on autopilot (no nudges) on the **server**: the Edge Functions `submit-bracket`, `send-challenge` and `respond-challenge` validate the teams, run the same battle engine and save the result
and the event log. The code they share with the game is copied by `npm run sync-functions` to `supabase/functions/_shared/nudge/` (a test fails when the copy is out of date). Setup: run migrations `0014`-`0017` and deploy the three functions (see the box at the top of `PROGRESS.md`).

## Graphics themes

Settings -> Grafiktema switches theme live: **Tuxemon** (default), **Ninja Adventure**, **Pipoya** (32x32) and **Kenney**. A theme is plain data (`nudge/game/themes/<id>.ts`: which piece of which sheet is grass, path, water, trees, houses,
characters ...) and the logical map (collisions, grass, warps) is identical in all of them. Tiles a theme has no piece for are painted in plain colours. The credits page is generated from the themes' credit entries.

```bash
npm run fetch-assets     # downloads the graphics packs (itch.io / GitHub) into assets-raw/ (gitignored)
npm run copy-graphics    # copies the used sheets to public/assets/themes/<theme>/
```

**Pipoya's files must never be committed or published** (its licence forbids redistribution): `public/assets/themes/pipoya/` is gitignored. Without those files the theme falls back to placeholders.

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
  `?noauth=1&map=gruss&x=11&y=13&starter=1&party=charmander:12,pidgey:8&balls=10&money=3000&badges=1&open=starter|shop&menu=party|bag|summary&encounter=16:3&say=Hej`
* `/nudge/dev/battle?p=bulbasaur:46,pidgey:12&e=chansey:30&kind=trainer&badges=2&seed=7&go=1`

## The world and the map builder

Sixteen places from Hemstad to the Wilderness, four gyms (Granit, Kajsa, Ture, Lilja), a rival who shows up three times, three fishing rods, evolution stones, a Pokédex, fast travel from the Pokémon Centers once you have two badges and
gifts (Eevee, a fossil, Hitmonlee/Hitmonchan, Lapras). Maps are not drawn by hand; they are written with a small builder (`nudge/game/mapBuilder.ts`) that compiles to the same `MapDef` the game always used:

```ts
const m = mapBuilder('route4', 34, 36, { name: 'Väg 4', encounterTable: 'route4' })
m.border('tree', 2)
m.path([[14, 34], [14, 28], [6, 28]], { width: 2, wobble: 0.15 })   // roads, ponds, grass patches ...
m.blob(20, 27, 6, 4, 'grass', { onlyOn: '.#o' })
road(m, 's', 14, 'hamn', 11)                                       // maps/layout.ts: a road to another map (warps, arrival tile)
const mart = enterable(m, 'mart', 26, 4, 'gnistby_mart', { name: 'Pokémart' })
m.trainer(trainer('r4-hanna', 'Hanna', 'picnicker', { x: 12, y: 26, facing: 'auto' }, [[43, 17], [70, 18]]))  // trainerClasses.ts
```

`npm run dump-map -- route5` prints any map as text (N = NPC, T = trainer, > = warp, i / ? = items). `npm run check-world` prints a world report: reachability with the badge gates, warp and entity problems, species/move problems
and how many of the 151 Pokémon can be obtained. The same checks run in `npm test` (`world.test.ts`, `maps.test.ts`, `worldStore.test.ts`).

## Scripts

```bash
npm test                 # Vitest: engine, data, maps and world checks, controller, whole-game flow, saves, themes, automatic playthroughs (300+ tests)
npm run typecheck        # vue-tsc for the Viska Vue code + tsc for the engine (no DOM/Node types) and for everything else under nudge/
npm run fetch-data       # (re)generate nudge/data/*.json from PokeAPI (cached in .cache/pokeapi/)
npm run sim -- --battles 1500 --player charmander:12 --enemy bulbasaur:12   # headless batch simulation, with and without the nudge bot
npm run sim-gyms         # win rates of the expected team against each gym leader, without and with a simple nudge strategy
npm run check-world      # world report (reachability, warps, coverage)
npm run dump-map -- <id> # a map as text
npm run sync-functions   # copy the engine, data and server code to the Edge Functions' shared folder
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
  game/        maps (+ the map builder), themes, tiles, trainers, encounters, items, world logic, post-battle sequence, saves
  scripts/     fetch-data, sim, sim-gyms, check-world, dump-map, fetch-assets, copy-graphics, copy-audio
  tests/       Vitest tests (+ the playthrough bot)
  PLAN.md      (the original plan lives outside the repo)  DECISIONS.md  PROGRESS.md
app/pages/nudge/        index (title), play, dev/battle
app/components/nudge/   battle, overworld, game (modals), menu
app/stores/nudge/       Pinia: settings, battle, world, player, game, storage
```

All balance numbers are in `nudge/engine/balance.ts`. Decisions and the balance log are in `DECISIONS.md`, milestone status in `PROGRESS.md`.

## Not in the game

Abilities, double battles, a story beyond the four gyms and the Wilderness, mobile controls, Tiled map import, trading between players.
