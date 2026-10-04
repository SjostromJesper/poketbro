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

## Battle UI (M3)

- **Structure.** `app/stores/nudge/battle.ts` (Pinia) owns the `BattleEngine` (in a `shallowRef`, never made reactive), drives it from the UI
  frame loop, and turns events into log lines, emotes, floating numbers and sprite animations. `nudge/game/battleView.ts` (pure TS) builds
  a plain-object snapshot of the running battle each frame; components only ever read that snapshot. `BattleScene.vue` is the reusable
  battle screen (props: `bag` - `null` means unlimited items for dev battles; emits `finished`, `item-used`), used by the dev page now
  and by the real game later.
- **Frame loop.** `requestAnimationFrame`, real elapsed time capped at 100 ms per frame (a background tab must not fast-forward a fight),
  multiplied by the 1x/2x/3x setting. Pause just stops calling `tick` (the engine's `setPaused` only matters for the nudge-while-paused flag).
  Note for automated testing: a hidden browser tab gets no animation frames; tests drive `store.frame(dt)` directly.
- **Animations** use the Web Animations API on the sprite wrappers (so the animated GIF is never re-created) and scale with the game speed.
  HP bars animate with a CSS transition. Damage numbers and emotes are transient elements removed after ~1 s.
- **Log** shows the 5 latest lines. Damage amounts are not written in the log (floating numbers and the HP bar show them); super-effective /
  not very effective / critical hit lines are.
- **HP numbers** are shown for the player's Pokémon only; the opponent just has a bar (like the original games).
- **Dev page** `/nudge/dev/battle`: team editors for both sides (species, level, trait, nature, trust, held item), wild/trainer, badges, seed,
  debug overlay. Shortcut query: `?p=bulbasaur:46,pidgey:12&e=chansey:30&kind=trainer&badges=2&seed=7&debug=1&go=1`.
  After a battle it applies the outcome to the party (XP, level-ups, habits, trust) and prints a summary.
- **Debug overlay** (`?debug=1` or the D key): per side trait/nature/trust/smartness, ATB value, fill/s, effective speed, HP, nudge budget and
  pending nudge (move + strength), category weights and a table with p_auto, p_final and expected damage per move.
- **Fonts:** Press Start 2P (headings/buttons) and Pixelify Sans (body) from Google Fonts, falling back to monospace offline.

## Overworld (M4)

- **Split.** `nudge/game/world.ts` is the pure logic (discrete tile positions, collisions, warps, interaction, trainer sight, wild encounter
  rolls, blackout); `app/stores/nudge/world.ts` is the real-time part (input, step animation, fades, dialog typewriter); the canvas component
  only draws. The logical position changes the moment a step starts, the picture interpolates over `WALK_STEP_MS` (150) / `RUN_STEP_MS` (90).
  Triggers (warp, trainer sight, grass) are processed when the step animation finishes, like in the original games.
- **Controls.** Arrows/WASD walk, a direction tapped from standing still only turns (a brief `TURN_MS` delay before walking if held), Shift runs,
  Space/Enter/Z talk or advance dialog, Esc/X open the menu (and also advance dialog). "Håll ner för att springa" is implemented as Shift.
- **Map format** (`nudge/game/maps/*.ts`): ASCII rows plus warps/npcs/trainers/signs. Tiles: `.` ground, `,` tall grass, `#` tree (wall indoors),
  `~` water, `=` path, `o` flowers, `f` fence, `R` roof, `W` wall, `D` door, `S` sign, `F` floor, `T` counter, `M` door mat. Water is a wall (no Surf in the MVP).
  Warps always land the player one tile *inside* the destination so there is no ping-pong; doors/mats are the warp tiles. Map-edge exits
  are two-wide road openings with warp tiles on the border row.
- **Maps.** Hemstad (+ your home and the professor's lab), Väg 1, Viridianskogen, Grusstad (+ Pokémon Center, Pokémart, gym). Trainers: 2 on Väg 1,
  3 in the forest, 2 gym trainers and the leader Granit (a trainer entry with `sight: 0`, so he only fights when spoken to).
  Tests check that every map is rectangular, every door/mat has a warp, signs and tiles match, entities stand on walkable tiles, all warps land
  on walkable non-warp tiles, everything is reachable from the start, and a BFS-planned walk through the real controller reaches Grusstad.
- **Gate.** The north exit of Hemstad is blocked (with a dialog) until the `starter` flag is set; the professor sets it in M5.
- **Counters.** You can talk to an NPC across one counter tile (nurse, clerk).
- **Placeholder graphics.** Everything is drawn with canvas primitives and cached per tile variant/frame (`app/components/nudge/overworld/render.ts`).
  `TileRenderer` is the plug point: `createTilesetRenderer(image, mapping)` is ready for a real tileset; characters are simple 16x16 figures
  with a facing indicator and a walk bob. Interiors draw `#` as a wall instead of a tree.
- **Viewport** is 15x11 tiles (240x176 internal pixels) scaled by CSS with `image-rendering: pixelated`; smaller maps are centred.
- **Testing the UI.** The in-app browser pane has no animation frames while hidden, so visual checks use headless Chrome screenshots
  (`--screenshot`) with dev shortcuts (`/nudge/play?map=gruss&x=11&y=13&starter=1&say=...`), and behaviour is tested through the Pinia store.

## Map <-> battle (M5)

- **Stores.** `player` (party, box, money, bag, badges, pokedex, step counter; serialisable), `game` (the orchestrator: starter, healing, shop,
  encounters, trainers, post-battle queue, blackout) next to `world` and `battle`. `GameRoot.vue` composes the overworld, the HUD, the modal screens
  (starter choice, shop, move replacement, evolution) and the full-screen battle layer.
- **Encounters** are rolled when a step onto tall grass finishes (`ENCOUNTER_RATE` 10 %); the screen flashes white/black, then the battle layer opens.
  Without a Pokémon able to fight no encounter starts.
- **Trainers.** Spotting: "!" for 0.8 s, then the trainer walks up to the tile in front of the player (drawn at an offset, snapped back to its
  spot after the fight). Talking to a trainer skips the walk. Intro dialog -> battle -> win dialog -> prize money (`TRAINER_MONEY_PER_LEVEL` x highest
  level in their team) -> trainer marked as beaten. The gym leader additionally gives the badge flag, the badge in `player.badges` and the TM.
- **After a battle** a queue plays in order: caught-Pokémon message, trainer dialogs and rewards, then for every level-up: "nådde nivå N", moves learned
  automatically, a replace dialog per move that does not fit (forget which one, or do not learn it) and the evolution prompt (evolve / cancel with X).
- **Blackout** (all Pokémon fainted): half the money is lost, the player wakes up at the last healed-at place (`lastCenter`, set by the nurse and by Mum),
  the party is healed (without the Center trust bonus) and the trainer fight is not counted as won.
- **Heal** (nurse / Mum) heals HP, status and PP and gives +1 trust (the plan says once per visit; the dialog flow makes it once per conversation).
- **Starter.** The professor's long dialog explains the nudge, then a choice of Bulbasaur / Charmander / Squirtle (level 5, trust 120, loyal-or-random trait)
  and 5 Poké Balls; the north gate of Hemstad opens (`starter` flag). The professor offers it only once.
- **Shop** (Pokémart in Grusstad): Poké Ball 100, Potion 150, Antidote 50, Paralyze Heal 100, Oran Berry 100, TM Double Team 600, TM Rest 800;
  selling pays half. TM Rock Tomb (1000) comes from the gym. Starting money is 500. Prices are balance placeholders (M8).
- **Items in battle**: the bag comes from the player store; a successful ball throw or potion use emits `item-used`, which removes one from the bag.
- **Trust from walking**: +1 per 100 steps for every party member (`player.addSteps`).
- **Dev shortcuts** on `/nudge/play`: `?map=&x=&y=&starter=1&party=charmander:12,pidgey:8&balls=10&money=3000&badges=1&open=starter|shop&encounter=16:3&debug=1&say=...`.
- **Tests.** `gameFlow.test.ts` drives the real stores in Node with fake timers and a seeded `Math.random`: starter from the professor, healing, shop opening,
  trust per steps, wild battle and XP, catching (party and box), level-up with the replace dialog, evolution (cancel and accept), a trainer that spots
  the player and walks up, the gym leader reward and a blackout.

## Team, items, relation (M6)

- **Menu** (Esc/X): Lag, Väska, Spara, Inställningar, Titelskärm, Stäng. Sub-screens fill the viewport; Esc/X steps back one level first (the world store lets the open
  menu consume "back" via `setMenuBack`). Save/Settings/Title entries are wired in M7.
- **Party screen:** reorder by drag and drop or with the arrow buttons; shows HP, status, trait, trust hearts and held item (with a "ta" link). The first Pokémon
  that can fight leads in battle, and the next one in order takes over when it faints (engine behaviour from M2).
- **Summary screen** is built from `nudge/game/summary.ts` (pure, tested): stats with nature markers, XP progress, 5 trust hearts (`ceil(trust / 255 * 5)`), trait with its
  explanation, the nature expressed as a move preference ("Föredrar attacker (58 %), därefter stödmoves (21 %)"), held item, original trainer, moves with category,
  power, accuracy, PP and Swedish effect lines, and habits ("Föredrar: Ember" once a move has >= 3 habit points).
- **Bag screen:** tabs (Alla, Läkning, Bollar, Hålls, TM); Potion/Antidote/Paralyze Heal on a Pokémon (disabled when pointless), held items can be given (swapping
  returns the old one to the bag), Oran Berry can also be *fed* (+5 trust, +10 HP), TMs are taught to compatible Pokémon (from the species' `machine` learnset) with a
  forget-which dialog when all four slots are full. TMs are not consumed. Forgetting a move drops its habit.
- **Trust sources** now all wired: +1 per 100 steps, +3 level up, +2 win (participated and standing), +1 Pokémon Center / Mum, +5 fed berry, +1 (x2 for Proud) for a followed
  nudge in a won battle, -5 for fainting. "Bitter healing items" from the plan were not added.
- **Habits** are saved in `OwnedPokemon.habits`, grow only in won battles and feed the choice algorithm (tested end to end: win -> habit -> summary "favourite" -> higher p_auto).

## Gym, saving, polish (M7)

- **Save format** (`nudge/game/save.ts`, key `nudge:save:v1`): `{ version, savedAt, player, world }`, validated on load (Pokémon must reference known species/moves/natures,
  numbers must be numbers, ...). A corrupt or wrong-version save is reported instead of loaded; a save pointing at an unknown map or a solid tile restarts in Hemstad.
  The storage wrapper (`app/stores/nudge/storage.ts`) falls back to memory when `localStorage` is unavailable.
- **Autosave** on every map change, after the starter is chosen, and after a battle once its dialogs/choices are done. Manual save in the menu; "Titelskärm" saves first.
  Nothing is saved before the player owns a Pokémon.
- **Title screen** (`/nudge`): Fortsätt (when there is a valid save, with a summary: lead Pokémon, place, badges, money, time), Nytt spel (asks before replacing the old
  save, which is only overwritten at the next save), Inställningar, Teststrid. `/nudge/play` continues a save by default; `?new=1` forces a new game, dev shortcuts imply a new game.
- **Settings:** default battle speed, debug overlay in battle, delete save. Sound is not part of the prototype (the plan makes it optional).
- **Automatic playthrough** (`nudge/tests/bot.ts` + `playthrough.test.ts`): a bot drives the real stores and controller from a new game: professor and starter, walks with BFS
  paths, grinds in the Route 1 grass, fights trainers that spot it, nudges with the "best move" strategy, catches a couple of Pokémon, heals at Mum / the Pokémon Center,
  shops, learns moves, evolves, and beats the gym. It succeeds for three seeds and three starters in under a second of test time; it is also the source of the pacing
  numbers used for balancing in M8.
- **Polish already in place:** flash transition into battles, fades with a map-name banner, "!" and walking trainers, HP bar animation, emotes, floating damage numbers,
  screen-wide Swedish texts (species and move names stay English because PokeAPI has no Swedish ones).

## Balance (M8)

Method: `npm run sim` for single fights (1000-2500 battles each, seeded, with and without a "best expected damage" nudge bot) and
`BENCH=1 npx vitest run nudge/tests/bench.test.ts` for whole playthroughs (the automatic bot, 18 runs = 6 seeds x 3 starters per setting). All numbers below were measured *after* the
values were actually in `balance.ts` (an early measurement ran with an unapplied edit and was redone).

| What | Before | After | Why / evidence |
|---|---|---|---|
| Category weights (nature -> attack/defense/support) | neutral .50/.25/.25, attack-nature .65/.15/.20 | neutral **.62/.19/.19**, attack **.78/.09/.13**, defense .45/.35/.20, support .45/.13/.42 | Starters used Growl/Tail Whip 33-37 % of the time and only 57-63 % of all moves were attacks. Now Growl is ~27 % and attacks are 66-72 % of the moves (natures still shift this: support natures use more status moves). |
| Stat-move saturation in `choice.ts` | `1 -/+ stage/7` | **`1 -/+ stage/3`** | After 2-3 Growls the move is almost worthless, so Pokémon stop spamming it. |
| Paralysis | effective speed x0.5 (only ~15-25 % slower bar because of the +100 speed offset) | **bar fill rate x0.5** (`PARALYSIS_FILL_MULT`) + 25 % lost turns | Plan 5.7 says "halverad ATB-hastighet"; now it really is. Tested: a paralysed Pokémon completes about half as many bars. |
| Nudge curve | [0.60, 0.40, 0.25, 0.15, 0.10] | **[0.70, 0.50, 0.30, 0.20, 0.10]** (budget stays 3 + trait) | Charmander vs Bulbasaur (calm, trust 120): no nudge 95.3 % / 93 losses per 2000; nudge bot with the new curve 97.2 % / 56 losses (-40 % losses, -15 % fight time). The old curve was only slightly weaker once the choice weights were fixed (96.8 % vs 97.2 % per 2500), so this is a small bump, not a big lever. A nudge does not rescue a type-disadvantaged boss fight. |
| Trust | unchanged (`SMART_MIN` .15 .. `SMART_MAX` 1, nudge x0.5..1.2, endure at 200) | unchanged | Verified that it matters a lot: Charmander Lv15 vs the gym leader (no nudges) wins 18 % at trust 40, 31 % at trust 120, 48 % at trust 230. |
| XP | Gen 3 formula | x **`XP_MULTIPLIER` 1.5** on top | The bot needed ~100 wild fights (16-20 battle-minutes) to reach Lv15 on Route 1; with x1.5 ~65 fights (10-14 min). x2 felt too fast (48-56 fights, 8-11 min). Real play also includes the forest and its trainers, so a human takes longer. |
| Granit (gym leader) | Geodude Lv10, Onix Lv13 | Geodude Lv10, Onix **Lv12** | Charmander is the hard route by design (rock/ground resist fire): Lv14 wins ~12 %, Lv15 ~24-28 % (nudge bot). Squirtle Lv11 wins 87-92 %, Bulbasaur Lv11 75-80 %. A 2-level change swings the fight enormously because Onix's Defense is a wall (Charmander Lv14 vs Onix 13: 6-8 %). |
| Encounter rate / levels | 10 %, Route 1 Lv2-4, forest Lv3-6 | unchanged | The playthrough bot meets enough fights; trainers (Lv3-7) give the XP boost. |
| Prices, money | Ball 100, Potion 150, trainers 40 x level | unchanged | The bot ends the run with 1300-1600 kr after shopping. |

Whole-run pacing (bot, XP x1.5, gym challenged once the lead is Lv14; 18 runs each):

| | no nudges | nudge bot |
|---|---|---|
| wild battles | 68 | 63 |
| battle time | 13.6 min | **9.9 min (-27 %)** |
| blackouts (lost gym attempts) | 1.7 | **0.8 (-53 %)** |
| lead level at the badge | 16.1 | 15.9 |

Open questions: the early-game bot overstates grinding (it only farms Route 1), a human probably reaches the gym at Lv12-13 via the forest; Charmander players will want a second Pokémon
(catching and switching are supported but the bot does not use switching); 60 moves are still inert (see the M2 section).

# PLAN-2 (music, sound, capture, favourite moves, real graphics)

## P2-M0: packs

- **`npm run fetch-assets`** (`nudge/scripts/fetch-assets.ts`) downloads and unpacks everything into `assets-raw/` (gitignored), skipping packs that already exist and checking that
  each download really is a zip. Sources that worked:
  - Ninja Adventure (pixel-boy, CC0): the itch.io "Download Now" flow done by hand (game page -> csrf token -> `POST .../download_url` -> download page -> `POST .../file/16981275`
    returns a short-lived Cloudflare R2 URL). Upload "Ninja Adventure - Asset Pack.zip" (id 16981275).
  - Juhani Junkala packs from OpenGameArt, direct links: JRPG Pack 1 Exploration, 2 Towns, 4 Calm, 5 Action, "5 Action Chiptunes", "The Essential Retro Video Game Sound Effects
    Collection [512 sounds]" (all under `https://opengameart.org/sites/default/files/`).
  - Kenney Tiny Town (CC0) from `https://kenney.nl/media/pages/assets/tiny-town/.../kenney_tiny-town.zip` (link found on the page); only a fallback.
- **What is in them:** Ninja Adventure also ships its own music (40 `.ogg` tracks), jingles and sound effects (`.wav`), so those are candidates next to the Junkala packs. Junkala SFX are 512 `.wav`.
  Music is `.ogg`; sound effects stay `.wav` (short, universally supported, and no ffmpeg/sox is available to convert; `afconvert` can only make AAC/CAF). Only the files actually used are copied
  into `public/assets/`.

## P2-M1: capture

- **Formula** (`engine/formulas.ts`, `captureValue/captureChance/rollCapture`): `a = ((3 maxHP - 2 HP) * rate * ball) / (3 maxHP) * status * level`, `a >= 255` is an automatic catch (three shakes),
  otherwise up to four shake checks against `b = 1048560 / sqrt(sqrt(16711680 / a))`; shakes shown = checks passed before the first failure (0-3), all four = caught. The result also carries the theoretical
  chance `(b / 65536)^4` for the debug overlay. All constants in `balance.ts`: `BALL_BONUS` (1 / 1.5 / 2), `STATUS_CAPTURE_BONUS` (sleep/freeze 2, paralysis/poison/burn 1.5), `CAPTURE_LEVEL_REF` 30
  (bonus `max(1, (30 - level) / 10)`, capped at `CAPTURE_LEVEL_BONUS_MAX` 2), `CAPTURE_FAIL_ATB_BONUS` 200.
- **Engine phase.** `playerAction({ type: 'ball', ball })` decides the result at once (RNG) but only sets `state.capture` and emits a `capture` event; while it is set `tick()` does nothing, nudges and all other actions
  are refused (`capturing`). The UI plays the animation and calls `resolveCapture()`, which emits `capture-result` (the Swedish log text) and then either ends the battle (`caught`) or gives the wild Pokémon
  +200 ATB and starts the ball cooldown. The old `BALL_LOCK_MS` is gone.
- **Animation** (`CaptureAnimation.vue`, Web Animations API): arc throw (650 ms) -> white flash + the Pokémon shrinks into the ball (450 ms) -> drop with a bounce (600 ms) -> one 600 ms wobble (+-20 deg) per shake with
  200 ms between -> caught: ball dims, star burst / failed: flash, ball vanishes, the Pokémon pops back. Roughly 2.5-5 s. At 2x/3x everything scales by `max(0.5, 1/speed)` so the wobbles stay visible.
  The scene reacts to the animation's cues (`absorb`, `release`, `done`), the buttons and the keys 1-4 are disabled meanwhile. Ball sprites come from the PokeAPI item sprites in `items.json`.
- **Balls.** Great Ball (300 kr, sold in the Pokémart once you own a badge) and Ultra Ball (600 kr, not sold yet; the shop code supports it) exist as items. With more than one kind in the bag the "Boll" button opens a small picker.
- **Debug overlay** shows the live catch chance for all three balls in wild battles.
- **PC box and nicknames.** `player.box` already existed; now there is a PC in the Pokémon Center (an NPC with the `pc` action) with a simple screen to move Pokémon between party and box (the party keeps at
  least one Pokémon that can fight, max 6). After a catch the player may give a nickname (max 12 characters, can be skipped).
- **Tests** (`capture.test.ts`): a >= 255 always catches, 1 HP vs full HP, status/ball/level multipliers, 10 000 seeded throws match the theoretical shake distribution, the engine pauses and resolves correctly.

## P2-M1B: favorite move

- **Progress = habits.** No separate counter: a move's progress is its `habits` value (so the old "Föredrar" line is replaced by the real favorite). Each won battle adds `min(plain uses, 5) + min(nudged uses, 5) x mult`
  per move, where "nudged" = the move was picked because a nudge was followed (`Battler.nudgedUses`, reported as `PartyUpdate.nudgedMoves`). The mult is `TraitDef.nudgedProgress`: 2 normally, 3 for Loyal.
- **Forming.** After each won battle (`progression.updateFavorite`): no favorite yet, no cooldown, trust >= `FAVORITE_MIN_TRUST` (150) and some move has progress >= `FAVORITE_THRESHOLD` (20, x the trait's multiplier:
  Proud/Stubborn 0.7/0.75, Playful 1.5) -> the highest one becomes the favorite. `applyBattleOutcome` returns `favorites` events, the game store queues a `FavoriteScene` (hopping sprite, floating hearts, the
  text from the plan) after the level-ups. The jingle comes with P2-M2.
- **Switching.** A rival whose progress is >= favorite + `FAVORITE_THRESHOLD x FAVORITE_SWITCH_FACTOR (1.5)` x trait switch mult (Stubborn 2.5, Proud 1.2, Playful 0.6) takes over; the old favorite's progress is halved.
- **Forgetting.** `learnMove` returns whether the forgotten move was the favorite; then `loseFavorite`: favorite removed, trust -10, `favoriteCooldown = FAVORITE_COOLDOWN_BATTLES (10)` participated battles. Both
  the level-up dialog and the bag (TMs) ask "X älskar Y. Är du säker?" first.
- **In battle** (`engine/favorite.ts`, `choice.ts`, `moveExec.ts`, `battle.ts`): weight x2 (Proud x1.25, Playful x0.75) after nature/smartness; power x1.1; +100 ATB on the next bar after using it; a ♥ emote
  replaces the usual nudge note when it is used. Nudging towards it is free (no budget, no curve step); a nudge away from it is x0.8 as strong (Proud 0.85) as long as it has PP. No bonus (weight, power, head start) if the
  move would be completely ineffective against the target and trust >= `FAVORITE_SMART_TRUST` (200): the Pokémon "knows better"; with lower trust it keeps stubbornly loving it.
- **UI:** summary shows a ♥ by the favorite and up to five small hearts for the other moves (progress / threshold); the move button shows ♥ and "gratis nudge"; the debug overlay shows the favorite multiplier or
  progress/threshold per move.
- **Sim** (`npm run sim -- --favorites`): giving the team its strongest attack as favorite moves win rate for Charmander 14 vs Geodude 12 from 43 % to 56 % without nudges, 47 % to 65 % with the "best" nudge strategy;
  for an easy matchup it barely matters (99.3 -> 99.9 %). Noticeable but not decisive, so the constants from the plan stay as they are.
- **Tests** (`favorite.test.ts`): trust + threshold gating, nudged progress x2 / x3 (Loyal), one favorite at a time with the switch margin and trait differences, forget -> trust loss + cooldown, weight, immune + high
  trust, free nudge, nudge away.

## P2-M2: audio engine

- **Structure.** `nudge/game/audio.ts` is the logic (`AudioManager`: music with a 600 ms crossfade, jingles that duck the music to 20 % and resolve when they end (8 s safety release), freely overlapping SFX, separate
  music/sfx volume + mute, everything silent until `unlock()`), written against a small `AudioBackend` interface so it is tested in Node with a fake backend (`audio.test.ts`). `audioBackend.ts` is the browser
  implementation: Web Audio buffers for short sounds (cheap overlap, pitch via `playbackRate`, buffers cached, failures cached as "null" and warned about once) and one looping `<audio>` element per music track.
  Missing files / blocked autoplay / decode errors are swallowed everywhere, the game just plays on silently.
- **Sound table.** `audio-manifest.ts` maps ids to files and a per-file gain; `nudge/scripts/copy-audio.ts` (`npm run copy-audio`) copies exactly those files from `assets-raw/` to `public/assets/nudge/audio/` (about 5 MB).
  A test checks that every manifest file exists in `public/`. UI/battle/overworld SFX are mostly from Juhani Junkala's retro pack, some (cancel, miss, ball throw, heal, encounter alert) from Ninja Adventure; jingles are Ninja
  Adventure's `Success`/`LevelUp`/`Secret`/`GameOver` files. I could not listen to them, so they were picked by name and category; swapping one is a one-line change in `copy-audio.ts` and the manifest.
- **Settings.** `settingsStore` now has `musicVolume` (default 0.5), `sfxVolume` (0.7) and `muted`, saved in localStorage (`nudge:settings:v2`); sliders and a mute box in the settings panel. The old unused `sound` flag is gone.
- **Autoplay.** `NudgeFrame` listens for the first pointer/key press and calls `audio.unlock()`; the title screen shows a blinking "Tryck för att börja" until then. Music requested before the unlock starts right after it.
- **Cues.** `audioCues.ts` is a pure mapping from battle events to sounds (tested): hit sound by effectiveness/crit, miss, no effect, faint (thud + lower pitched cry, `faint` events now carry `speciesId`), stat up/down,
  status, heal, nudge accepted / followed / ignored, run. The battle store plays them from `handleEvents`. The capture animation's cues (throw, absorb = ball opens, each shake, caught = click, release = break out) play
  in `BattleScene`. Every button also gets a confirm/cancel sound in `NudgeFrame` (cancel when the label starts with Avbryt/Tillbaka/Stäng/Nej..., opt out with `data-sound="none"`, as the move buttons do because the nudge has its own sound).
- **Overworld / game.** Wall bump (throttled to every 350 ms), door/warp, encounter alert at battle start, coins for a trainer prize and selling, buy sound, level-up and evolution and heal and badge and favorite jingles.
- **Cries.** `fetch-data.ts` stores `cry` (PokeAPI `cries.legacy`, `latest` as fallback) per species; the sounds are loaded from raw.githubusercontent.com at runtime exactly like the sprites (it sends CORS headers). Played on
  send-out, on faint at pitch 0.7, and when a summary screen opens.

## P2-M3: music

- **`MapDef.music`** (a key in `MUSIC` in `audio-manifest.ts`). The game store plays the map's loop on start/continue, on every map change and after a battle (`playMapMusic`, also after a blackout teleport); `nudge/game/music.ts`
  holds the pure picks (`mapMusic`, `battleMusic`) and `music.test.ts` checks that every map has an existing track.
- **Tracks** (chosen by mood from the descriptions and file names, I cannot listen; all loops are `.ogg`, copied by `npm run copy-audio` into `public/assets/nudge/audio/music/`, about 28 MB in all):

  | Where | Track | Pack |
  | --- | --- | --- |
  | Title screen | Adventure Begin | Ninja Adventure |
  | Hemstad | Town1 - Home Town | Junkala JRPG 2 (Towns) |
  | Ditt hem, Professorns labb | Calm1 - A Place I Call Home | Junkala JRPG 4 (Calm) |
  | Väg 1 | Exploration1 - Grasslands | Junkala JRPG 1 (Exploration) |
  | Viridianskogen | Exploration5 - Sneaking Around | Junkala JRPG 1 |
  | Grusstad | Town2 - Where Time Stands Still | Junkala JRPG 2 |
  | Pokémon Center, Pokémart | Calm3 - Peaceful Days | Junkala JRPG 4 |
  | Grusstads gym | Exploration2 - Military Base | Junkala JRPG 1 |
  | Wild battle | Action3 - Preparing For Battle | Junkala JRPG 5 (Action) |
  | Trainer battle | 17 - Fight | Ninja Adventure |
  | Gym leader battle | Action1 - Encounter With The Witches | Junkala JRPG 5 |

  The chiptune pack (`chiptunes/*.wav`) is not used: the files are 8-14 MB uncompressed and there is no tool here to convert them. Heavy tracks (Town3 4.5 MB, Town4 4 MB, Action2 4.4 MB) were skipped to keep the repo smaller.
- **Battle flow.** Battle music starts when the battle transition starts (`wild` / `trainer` / `gym` if the trainer has `gym`). On `battle-end` the loop fades out and a jingle plays (victory = win, catch = caught, game over = lose;
  fleeing is silent); the map music fades back in when the player presses "Fortsätt". Other jingles: heal (Pokémon Center), badge, level-up, evolution, favorite, item (taking the starter and balls).
- **Pages.** The title screen asks for `title` (it starts at the first click), the dev battle page uses the battle loops. `NudgeFrame` silences everything only when the player leaves Nudge altogether (a short timeout lets the
  next Nudge page ask for its own music first, so title -> game is a crossfade).
- **`AudioManager`** got a `catalog` option so the tests can use their own tracks.
