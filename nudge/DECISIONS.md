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

## Battle engine (M2)

- **Layout.** `nudge/engine/`: `balance` (every number), `rng` (mulberry32, only `Rng` is ever used inside the engine), `types`, `formulas`,
  `atb`, `choice` (p_auto / p_final), `nudge`, `obedience`, `status`, `moves`, `moveExec`, `pokemon` (creation + Battler), `progression`
  (XP, level-ups, learning, evolution, habits, trust after a battle), `ai` (enemy generation), `messages` (Swedish log text),
  `headless` (runner + a nudge bot for tests/sim) and `battle` (`BattleEngine`). The engine has its own `tsconfig` without DOM/Node types,
  so it provably has no Vue/Nuxt/DOM/Node dependency. Data is injected (`GameData`), the engine never imports the JSON itself.
- **Fixed simulation step.** `tick(dtMs)` consumes whole 50 ms steps (`STEP_MS`) and keeps the remainder, so a battle plays out the same
  whatever the frame rate (tested: 16 ms vs 33 ms frames give identical event logs).
- **Action lock** (`ACTION_LOCK_MS` = 700 ms) freezes *all* simulated time, including damage over time, status timers and charge countdowns,
  not just the two bars. Cooldowns (switch/item/ball) keep running during locks. Pausing is purely a UI matter (do not call `tick`).
- **Events instead of strings.** The engine returns structured `BattleEvent`s (for animation, emotes, sound later); `messages.ts` turns them
  into Swedish log lines. Damage-over-time ticks are left out of the log on purpose (they would spam it).
- **Nudge budget is per Pokémon and battle** (the trait lives on the Pokémon), so a Pokémon that is switched out and in again keeps what it
  has used. The pending nudge is cleared when its Pokémon leaves the field. A nudge spent while loafing/napping is kept for the next real
  choice; a nudge that meets a "random move" disobedience is consumed (shown as "...").
- **Followed nudge** = the move the Pokémon picked equals the nudged move *and* the nudge had non-zero strength (so a stubborn Pokémon
  that ignores a status-move nudge shows "..." even if it happens to pick that move).
- **Category weights.** Plan 5.3 steps: category (attack/defense/support) -> nature weights -> smartness -> habits. Implementation detail:
  inside a category moves share the category weight proportionally to `situational^smart * habit`; on top of that the category weight is
  scaled by how useful its moves are right now (so a lone useless/inert status move does not keep its whole category share, and a
  healing move at low HP pulls weight towards the defense category). Neutral natures use `{attack .5, defense .25, support .25}` as the
  "even" baseline; this is tuned in M8.
- **Paralysis** halves *effective speed* (plan 5.2). Because the bar speed is `K * (speed + 100)` the bar slows by roughly 15-25 %, not
  50 %; plus the 25 % chance to lose a turn. Revisit in M8 if paralysis feels too weak.
- **Moves.** Supported: damage (fixed power, variable-power table, fixed-damage and OHKO moves), multi-hit, drain/recoil, crits (incl.
  high-crit moves), priority (clamped to +-3 steps), flinch, stat stages, healing, burn/poison/paralysis/sleep/freeze/confusion/leech seed,
  Focus Energy, Haze, Rest, Belly Drum, Protect/Detect, charge moves (Solar Beam, Skull Bash, Sky Attack, Razor Wind, Fly, Dig, Bounce, Dive)
  and recharge moves (Hyper Beam, Giga Impact, ...). Tri Attack picks burn/paralysis/freeze at random.
  **Inert (usable, but the effect is a no-op, shown as "Men inget hände..."):** aromatherapy, attract, baton-pass, block, camouflage,
  conversion, conversion-2, counter, curse, destiny-bond, disable, encore, endeavor, endure, follow-me, foresight, grudge, hail,
  helping-hand, imprison, ingrain, light-screen, lock-on, mean-look, metronome, mimic, mind-reader, mirror-coat, mirror-move, mist,
  mud-sport, nightmare, odor-sleuth, perish-song, psych-up, rain-dance, recycle, reflect, refresh, roar, role-play, safeguard, sandstorm,
  skill-swap, sleep-talk, snatch, spikes, spite, splash, substitute, sunny-day, super-fang, taunt, teleport, torment, transform, trick,
  water-sport, whirlwind, yawn. Trapping/infatuation side effects of damaging moves (Wrap, Bind, Fire Spin, ...) are ignored; the damage still happens.
  Inert moves are strongly de-prioritised by the choice algorithm (more so for smart Pokémon) but a low-trust Pokémon can still waste a turn.
- **Stat changes of damaging moves** apply to the target, except for a short list of self-affecting moves (`USER_STAT_CHANGE_MOVES`: Overheat,
  Superpower, Metal Claw, Meteor Mash, Steel Wing, Ancient Power, Silver Wind, Rapid Spin) because PokeAPI does not say which one it is.
- **Crit** is 1.5x with the Gen 6+ stage table (1/16, 1/8, 1/4, 1/3, 1/2); high trust (>= 200) adds +4 % crit chance.
  A crit ignores the attacker's negative attack stages and the defender's positive defense stages.
- **XP** uses the Gen 3 formula `floor(a * b * L / (7 * s))` (a = 1.5 against trainers, s = participants that are still on their feet).
  Only Pokémon that were on the field against the defeated enemy count as participants.
- **Capture and fleeing** use the Gen 3 formulas. Caught Pokémon keep the wild Pokémon's remaining HP/PP/status; Sleep and Freeze do not
  persist after a battle (cleared in the outcome), Burn/Poison/Paralysis do.
- **Flinch** multiplies the target's current ATB by 0.5 (interpretation of "nollställer motståndarens bar till 50 %").
- **Priority** headstart is clamped to +-3 steps (+-900 ATB) because some moves have extreme values (Helping Hand +5, Roar -6).
- **Double KO / simultaneous faints:** the enemy side is resolved first, so a win is awarded if the enemy side runs out in the same step.
- **Test notes.** 128 tests. Probability tests use big seeded samples with explicit tolerances. Tests run as `Charizard lvl 60 with 8 badges`
  etc. to avoid the obedience cap muddying unrelated checks.

## Simulation (M2)

`npm run sim -- --battles 1500 --player charmander:12 --enemy bulbasaur:12 --trait loyal` runs the same seeds with and without the nudge
bot (nudges the best expected-damage move late in a bar when the Pokémon is unlikely to pick it on its own). With a loyal, trust-120
starter the bot raises the win rate by roughly 5-7 points and cuts battle time by ~20 % in type-matchup fights. Smaller effects in fights
where the auto-choice is already fine. Balance is revisited in M8.
