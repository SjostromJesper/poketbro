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

## P2-M4: map graphics

- **Sheets used** (Ninja Adventure, `Backgrounds/`, copied by `npm run copy-graphics` to `public/assets/nudge/tiles/`, 170 KB in all): `TilesetFloor` (grass, tufts, dirt path), `TilesetNature` (trees, bushes, tall grass tufts,
  flowers), `TilesetHouse` (buildings, fences, signs, counters), `TilesetWater` (pond), `Interior/TilesetInteriorFloor` (indoor floors), and the animated `Water Ripples` and `Plant` (daisy) sheets. The pack's interior
  wall kit is made of ring-shaped room frames that do not fit tile-by-tile maps, so indoor walls (and the door mat) stay drawn with canvas rectangles, recoloured to match the brick floors. The Kenney pack is not used.
- **`nudge/game/tileset-manifest.ts`** (pure) is the mapping from tile characters to sprites: `describeTile(map, tx, ty, {frame})` returns the stack of pieces for one tile, `SHEETS` lists the sheets with their size in tiles.
  `ninjaRenderer.ts` just draws what it says (and falls back to the old placeholder tiles for tiles without sprites, or for the whole map if a sheet fails to load). `TileRenderer.drawTile` now gets the map, so tiles
  can look at their neighbours.
- **Autotiling** for water and dirt paths: every autotile in the sheets is laid out as a 4x4 set (3x3 block, a vertical strip, a horizontal strip, one island piece). `autotilePiece(up, down, left, right)` picks from it with the
  four neighbours (outside the map counts as "same", so paths and lakes leave the map without a rim; a path above a door connects to it). No inner corners. Open water in the middle ripples through the 4 ripple frames.
- **Trees** are 2x2 pieces: along a row of `#` they pair up from the left end of the run, in a column from the bottom (trunk row, canopy row, ...); a tile without a partner becomes a small bush. Two tree kinds (round and pine).
  **Tall grass** sways between two tuft sprites every 450 ms; **flowers** are sunflowers, red flowers or the animated daisy.
- **Buildings.** `MapDef.buildings: { kind, x, y }[]` (top-left of the sprite). The sprite is drawn tile by tile from the house sheet, the ASCII under it stays `R`/`W` with a `D` at the door, so collision, warps and the map
  format are unchanged. Footprints are 4x3 (`houseOrange`, `houseCream`, `houseOrange2`, `houseRed`, `gym`) or 3x3 (`lab`, `center`, `mart`) with the door on the bottom row (`BUILDINGS[kind].door`). To fit the sprites I trimmed the
  taller ASCII buildings by one row (the freed row is walkable grass behind the house) in Hemstad and Grusstad. Recognisable Pokémon buildings: the Center is the round stone building with a red cross badge, the Mart the blue shop
  with an "M" badge, the gym the dark green dojo with a red "GYM" plate (the badges are tiny canvas drawings on the roof row above the door, `drawBadge`).
- **Tests** (`tileset.test.ts`): autotile pieces for every neighbour combination, lake corners, sprite coordinates inside the sheets for every tile of every map in every animation frame, sheet sizes equal the PNG files,
  every outdoor tile has sprites, every building footprint is solid except the door which is a warp, every `R`/`W`/`D` on an outdoor map belongs to a building, the three Pokémon buildings carry their badges.

## P2-M5: characters and UI

- **Script rename.** `copy-tiles` became `npm run copy-graphics` (`nudge/scripts/copy-graphics.ts`): it copies the tile sheets, 23 character sheets and their 38x38 face portraits from `assets-raw/` into `public/assets/nudge/`.
- **Characters** (`nudge/game/sprites.ts`, pure): Ninja Adventure sheets are 4 columns (down, up, left, right) x 7 rows of 16x16 frames; the first rows are the walk cycle (4 frames, 2 for the small `Child` and `OldWoman` sheets), the first
  frame is also the standing pose. `spriteFrame(id, facing, walk)` picks the piece; the walk progress of a step (0..1) steps through all frames, so the player, the walking trainers and the NPCs share one code path
  (`characterRenderer.ts`, which falls back to the old drawn figures until the sheets are loaded, and always for the PC object). The player is `Boy`.
- **`sprite` field** on `NpcDef` and `TrainerDef` (a character folder name); without it the `look` decides (`LOOK_SPRITE`: boy Villager, girl Woman, old OldMan, professor Master, nurse Princess, clerk Noble, mum Villager4,
  hiker Hunter, bugcatcher Child, leader KnightGold). All trainers have an explicit sprite; the gym leader Granit is the golden horned knight, which nobody else uses (tested).
- **Portraits.** Dialogs carry an optional `portrait` (the speaker's sprite id): NPC talk, trainer intros, the "you won" talk and the badge talk show the face in a framed 76 px box on the left of the dialog box.
- **Battle backdrops** (`nudge/game/battleThemes.ts` + `BattleBackdrop.vue`): five painted themes built from the map's own tile sheets on a 320x128 canvas - meadow (tree line, grass), forest (dark, two tree rows), town (row of houses), indoor
  (cream wall, brick floor) and gym (grey hall with banners, arena ring). `themeForMap(mapId)` chooses (indoor maps: gym or indoor, Viridianskogen: forest, maps with buildings: town, otherwise meadow); the battle store keeps the
  theme and the platforms under the Pokémon change colour with it. The dev battle page has a "Bakgrund" selector (`?theme=`).
- **UI palette.** The blue-grey chrome clashed with the warm sprites, so all UI colours (panels, buttons, rows, text greys, dialog box) were remapped to a wood/parchment palette (26 colours, mechanically across the `.vue` files; yellow
  accents, HP bar greens, type colours and the red primary button are unchanged).
- **Credits** (`/nudge/credits`, linked from the title screen): Ninja Adventure by pixel-boy and AAA, Juhani Junkala's JRPG music packs and SFX collection, PokéAPI (plus the Pokémon trademark note). Kenney Tiny Town was
  downloaded in P2-M0 but is not used, so it is not credited (tested). Links only point to pages named in the packs' own READMEs/INFO files.
- **Browser note.** Synthetic key presses from the test tool are too short for the walking code (it polls held keys per frame), so facing/talking was checked by calling the world store's `keyDown`/`keyUp` with a delay.

# PLAN-3

## P3-M0: graphics packs

- `npm run fetch-assets` now also fetches (into the gitignored `assets-raw/`): **Tuxemon** (theme A) by a shallow, sparse `git clone` of `Tuxemon/Tuxemon` (branch `development`) with only `mods/tuxemon/gfx/tilesets`
  (about 100 tilesheets, e.g. `core_outdoor*.png`, `core_buildings.png`, `core_indoor_*.png`, `Interior_*`, `Outdoor_*`), `mods/tuxemon/sprites` (about 200 overworld character sheets), `gfx/sprites/player`
  and `ATTRIBUTIONS.md` (copied to `assets-raw/tuxemon/ATTRIBUTIONS.md`); **Pipoya** tileset and free character sprites (theme B) through the same itch.io click flow as Ninja Adventure (the resolver now takes
  the page URL and the upload's file name); **Kenney Tiny Dungeon** next to Tiny Town (theme C).
- The OpenGameArt "Tuxemon tileset" page was not needed: the repository has far more.
- **Licences.** Tuxemon is mostly CC-BY-SA 4.0 / CC-BY (attribution needed; the credits screen will be generated from each theme's `credits.ts`, and 371 attribution entries are in `ATTRIBUTIONS.md`). Pipoya
  may not be redistributed: `assets-raw/` was already gitignored and `public/assets/themes/pipoya/` is now too (the repository has no remote, but the rule is kept in case it gets one).
- The scripts use npm (the project has `package-lock.json`); PLAN-3 says pnpm, the commands are the same under npm.

## P3-M1: theme system

- **Themes are data** (`nudge/game/themes/<id>.ts`, type `ThemeManifest` in `themes/types.ts`); one generic engine (`themes/engine.ts`, pure) turns a logical map tile into a stack of layers: `describeTile(theme, map, tx, ty, {frame})`. Layers
  are sheet pieces (`Ref`: sheet, tile coordinates, size in tiles), plain colours, rims for fill tiles, canvas-painted houses and the small badges (red cross, M, GYM, door mat). The logical map (collision, grass, warps, ASCII) is identical
  in all themes. `themeRuntime.ts` (app) loads a theme's images once and draws tiles, characters and portraits; a missing sheet or character warns once and falls back to the placeholder tile/figure.
- **Tile size.** Sheets declare their own tile size; the canvas is drawn at `tileSize / 16` times the logical size (`ctx.setTransform`), so a 32x32 theme (Pipoya) keeps its detail and one logical tile always takes the same room on screen.
- **Changing theme** is `settings.theme` (saved in the settings, default `tuxemon`): the overworld, the dialog portraits and the battle backdrops all watch it and switch without a reload. The settings panel lists the themes.
- **Autotiling.** Four forms: `Autotile` with strips (Ninja's 4x4 layout), block-only autotiles (3x3, transparent corners over ground), `Fill` (a plain tile with a procedurally painted rim where the neighbour differs; used by Tuxemon, Pipoya
  and Kenney because their sheets are RPG-Maker style terrain sets with inner corners) and a single `Ref`. No inner corners anywhere. Trees are `2x2`, `1x2` or `1x1` with bushes for unpaired tiles.
- **Buildings have one logical footprint in every theme: 5 x 4 tiles with the door in the middle of the bottom row** (`nudge/game/buildings.ts`; the old per-theme sizes (4x3/3x3) were replaced and the maps' ASCII widened). A theme draws a sprite of up
  to that size, aligned to the door and the bottom; the rest of the footprint gets the theme's hedge tile, so solid tiles never look empty. Sprites are a sheet rectangle (Ninja, Tuxemon), a grid of modular tiles (Kenney) or a house painted with
  canvas (Pipoya, whose tileset has no small houses). A test checks that every sprite fits and its door lines up. Kind ids are generic (`houseA`..`houseD`, `lab`, `center`, `mart`, `gym`).
- **Characters** are theme independent looks (`SpriteKey`: 23 of them: player, rival, professor, nurse, clerk, mum, old, boy, girl, youngster, lass, bugcatcher, hiker, fisher, sailor, picnicker, scientist, karate, psychic, leader1-4) that each theme maps to its
  sheets (`CharacterLayout` describes rows/columns for directions, the walk cycle, 16x16/16x32/32x32 frames, and single-pose sheets that mirror and bob). NPC and trainer `sprite` fields now use these keys. Face portraits: Ninja has real ones; the other
  themes show the head of the standing sprite, enlarged.
- **Themes and assets.** Tuxemon (default, GBA look): ground/tall grass/path from `outdoor.png`, water and fences from Basic Buch, trees from George's vegetation sheet, buildings (Pokémon Center with red cross, Mart with blue roof, the dark gym, houses and
  lab) and flowers from the Kelvin Shadewing city sheet, floors from George's interior floors, 23 overworld character sheets (16x32, three frames, four directions). Ninja Adventure: as before, migrated to the new system. Kenney: Tiny Town tiles with
  modular houses, Tiny Dungeon characters. Pipoya: grass, long grass, dirt, water and trees from its autotile files and BaseChip sheet, painted houses, 23 character sheets.
  Interior walls and the door mat stay canvas drawings in every theme (the sheets only have ring-shaped room frames). Files live in `public/assets/themes/<theme>/` (copied by `npm run copy-graphics`); **Pipoya's directory is gitignored** (not redistributable), the tests
  skip its file checks when the files are missing.
- **Battle backdrops** are now small tile maps (`backdropMap` in `battleThemes.ts`: tree line, houses, indoor walls) drawn with the active theme.
- **Credits** are generated from the themes (`credits.ts` = every theme's `credits` + audio + PokéAPI); Tuxemon's entry is marked as needing attribution and links the copied `ATTRIBUTIONS.md` (`/assets/themes/tuxemon/ATTRIBUTIONS.md`).
- **Tests** (`themes.test.ts`): autotile pieces, tree pairing, rims, and for every theme: sheets exist with the declared size, every piece drawn for every tile of every map in every frame is inside its sheet, all outdoor tiles have something to draw, building sprites fit the footprint,
  all 23 looks have sheets with valid frames and a walk cycle, credits.

## P3-M2: the end of a battle

- **Stays in the battle scene.** When the engine reports the result, `BattleScene` emits `ended`; the game store (`beginPostBattle`) builds `game.sequence` and `PostBattleSequence.vue` plays it over the scene (900 ms after the result, so the faint
  and the capture animations finish). The scene closes after the last step (`finishBattle`) and the map comes back. The dev battle page still shows the old result panel (it passes no sequence).
- **Pure builder** (`nudge/game/postBattle.ts`, tested): `applyAndNarrate` applies the outcome to the party and returns steps: `message` (lines, optional speaker + face, jingle, XP bar), `xpBar` (a bar that fills on its own after a level-up), `levelUp` (per level:
  stat gains, then totals), `moveReplace`, `favorite`, `nickname`. Order: the foe's faint, the trainer's words and prize, then per participating Pokémon: "X fick N XP!" with the bar filling, for every level reached "nådde nivå N!" + jingle +
  the stat panel + learned moves (free slot: "lärde sig X!"; full: "vill lära sig X, men kan bara ha 4 moves." + the forget dialog) + the bar restarting at 0, then trust ("litar mer på dig nu!" when a heart is gained) and favorite scenes. The gym reward comes
  after the XP. Evolutions come after the scene closes, in their own scene.
- **State is applied atomically** when the sequence is built (XP, levels, trust, habits, favorites, money, badge, TM, defeated flags), so closing the tab halfway never leaves a half-applied battle; the open choices (which move to forget, nickname) are applied
  when confirmed (`learnChoice`, `giveNickname`). If the page is closed during a forget dialog, the move is simply not learned (it is not offered again).
- **Capture gives no XP** (only Pokémon that fainted earlier in the battle count); a caught Pokémon gets "X lades till i laget!" and the nickname question inside the scene. Losing: "Du har inga Pokémon kvar..." in the scene, the blackout (money, healing, teleport)
  after it closes. Fleeing closes the scene at once.
- **Input.** Space, Enter, Z or a click advance. The first press while text is typed shows the whole line, the next advances. Key repeats are ignored and each step locks for 260 ms, so holding the key never skips a level-up or a move choice. The
  move dialog uses arrows/1-4 to select and Space/Enter to confirm (X skips; favorites ask "är du säker" first; it also ignores presses in its first 300 ms); the speed setting only changes animation and typing speed.
- **Evolution scene**: the sprite flickers between the forms (faster and faster) for about five seconds and then evolves; X, B or Esc cancels at any time ("utvecklades inte").
- **Tests**: `postBattle.test.ts` (level count for big XP, bars, stat changes equal the formula, move at the right level, replacement keeps PP rules and drops the habit, atomic apply) and the game-flow/bot tests now play the sequence through a helper
  (`tests/sequence.ts`).

## P3-M3: saving (slots and Supabase)

- **Existing setup.** The project already uses `@nuxtjs/supabase` (env `SUPABASE_URL`, `SUPABASE_KEY` = anon key, `NUXT_SUPABASE_SECRET_KEY` only for the server routes of the old game) and `supabase/migrations/0001-0013` for the gladiator game. The CLI is installed but not logged in or linked,
  so the migration `0014_nudge_saves.sql` is only written (instructions at the top of `PROGRESS.md`). It uses the table from the plan plus a trigger that sets `updated_at` on the server (clients never rely on their own clocks) and `with check` on the update policy. Nothing existing is
  touched. The browser only ever has the anon key.
- **Data.** Three slots; each slot holds the whole `SaveData` (version 2) as `data`, a `summary` for the menu (player name, party icons, badges, play time, place, money, saved-at). `save_version` is also a column. `migrateSave(data, toVersion)` (in `saveSlots.ts`, tested)
  upgrades step by step (`MIGRATIONS[n]`: n -> n+1; v1 -> v2 adds `playTimeMs`) and refuses saves from the future. The old single `nudge:save:v1` save is moved to slot 1 on the first start after the update (and removed).
- **Local.** Each slot is one localStorage value (`nudge:slot:N`: the save, summary, `cloudUpdatedAt` it was last in sync with, a `dirty` flag and a revision counter). Local writes happen at once; localStorage is the reliable copy, the cloud is the extra.
- **`SaveSync`** (pure, injected cloud/store/timers, tested with fakes): `write` saves locally and schedules one upload after 3 s (debounced per slot); `flush` uploads at once (used on `visibilitychange` -> hidden and `pagehide`, best effort);
  `sync()` at start compares slot by slot with `decideSync`: one side only -> copy it; same base -> upload if dirty; only the cloud changed -> download; both changed -> **conflict** (unless both describe the same moment). Conflicts are never resolved silently:
  the title screen shows both summaries and asks. A failed upload keeps the slot dirty, sets state `error` (a small "☁✗" in the HUD; the title screen says "ej synkad") and the next write/flush retries. Deleting also deletes in the cloud; if that fails a tombstone is
  kept so the slot does not come back. An upload that overlaps a newer local write never marks the newer data clean.
- **Login.** `saves.connect(client)` (the page passes `useSupabaseClient()` in; composables only work inside components): existing session, else `signInAnonymously()`. If that fails (it is currently disabled in the project) or the table does not exist, the cloud is
  simply off and the settings say why. Settings -> "Molnsparning": for an anonymous user "Koppla konto" does `auth.updateUser({ email })` (an e-mail link upgrades the anonymous user in place, so the user id and the saves stay) and "Logga in med länk" does `signInWithOtp`
  for a second device. Both need the project's e-mail/redirect settings (`PROGRESS.md`).
- **UI.** The title screen lists the three slots (party icons, place, badges, play time, money, saved-at, sync state; Fortsätt / Nytt spel / Radera) and the conflict dialog. `play?slot=N&continue=1|new=1` picks the slot; dev shortcut sessions (`?map=...`) never save.
  Play time is approximate: earlier sessions plus the running one (idle time counts).
- **Not verified against a live Supabase** (anonymous sign-ins are off and the table is missing); the cloud adapter (`app/stores/nudge/cloud.ts`) is thin and the sync logic is tested with fakes. Offline behaviour was verified in the browser (it saves and loads locally and
  migrates the old save).

## P3-M4: systems the big world needs

- **Map builder** (`nudge/game/mapBuilder.ts`): `mapBuilder(id, w, h, opts)` with `fill`, `border`, `path(points, {width, wobble})` (L-shaped segments, optionally winding), `blob` (organic ellipse: fields, ponds), `scatter`, `ledge`, `building(kind, x, y, door)`
  (stamps the 5x4 footprint and adds the door warp), `warp/exit`, `npc`, `trainer`, `sign`, `pickup`, and `build()`; `room(id, w, h, {exit})` makes an interior with walls and an exit mat. Tile names (`tree`, `grass`, `water`, `path`, `sand`, `ledge`, `rock`, `cave`, ...) or
  single characters; everything is seeded from the map id, so maps are identical on every build. `build()` throws if an NPC, trainer or pickup is on a blocked tile. It compiles to the same `MapDef` as before (the dekoration layer of PLAN-2 is the theme's job, so nothing extra
  is needed). Tiled import was not built (it was optional).
- **New tiles**: sand `s`, ledge `L`, rock `^`, cave floor `c` (wild encounters like tall grass), cave wall `X`, stairs `A`, shelf `H`, table `B`, bed `K`. Themes have optional pieces for them; a theme without one gets the neutral placeholder drawing and one console warning
  (Tuxemon, Pipoya and Kenney have a sand tile, the rest are placeholders for now).
- **Ledges** are one-way: walking down onto a ledge tile jumps over it to the tile behind (which must be free); every other direction is blocked.
- **Badge gates**: an NPC with `gate: { badges: n }` blocks its tile (and is drawn) until the player has `n` badges, then it is gone; warps can have `requiresBadges`. `World.badgeCount` is set by the game store (`syncBadges`).
- **Fishing**: three rods as key items (`old-rod`, `good-rod`, `super-rod`). Pressing the action key facing water with a rod casts; `World.rollFishing(rod)` (bite chance 75 %, `FISHING_BITE_CHANCE`) uses `FISHING_TABLES[map.fishingTable ?? map.encounterTable][rod]`; a bite starts a
  wild battle ("Napp!"), otherwise "Inget nappade". The best rod in the bag is used. Without a rod nothing happens.
- **Evolution stones** (fire, water, thunder, leaf, moon): `evolutions` in the data now has `item` (PokeAPI item name) and `trade` entries (`fetch-data` reads `use-item` and `trade` triggers). Stones are used from the bag (a new "Stenar & spön" tab): the evolution scene
  opens, and the stone is only consumed if the evolution happens (cancelling keeps it). **Trade evolutions** (Kadabra, Machoke, Graveler, Haunter) evolve at level 38 (`TRADE_EVOLUTION_LEVEL` in `balance.ts`) through the normal level-up path.
- **Pokédex**: `player.pokedexSeen` (species met in battle) next to `pokedex` (owned), a Pokédex screen in the menu (sprites/types for seen species, a ball for owned ones, and where to find it - only shown for seen ones), computed from the encounter and fishing tables, NPC gifts
  and evolution (`nudge/game/pokedex.ts`). Save version 3 (migration 2 -> 3 copies owned species into seen and fills `visitedCenters`).
- **Fast travel**: after `TRAVEL_MIN_BADGES` (2) badges, the "Resekarta" terminal in every Pokémon Center (NPC action `travel`) lists the centers used before (`world.visitedCenters`, filled when the nurse heals) and puts you outside the chosen one.
- **Hidden items and gifts**: `PickupDef` (visible ones are drawn as a small ball and block their tile until picked up; hidden ones are found by interacting with the tile; collected ones are remembered as `pickup-<id>` flags); NPCs with `give: { flag, items?, pokemon? }`
  (action `give`) hand things over once, and several Pokémon open a choice dialog (Hitmonlee/Hitmonchan); `dialogAfter` shows the later line.
- **Shops**: the stock grows with the badges (Great Ball 1, Super Potion 2, Ultra Ball 3, Hyper Potion 4; `shopStock(shopId, badges)`; Super Potion heals 50 HP and Hyper Potion 120, `POTION_HEALS`), each town's mart adds its own TMs (`SHOP_EXTRAS[mapId]`). The shop id is the mart's map id.
- **Rival** (`rival.ts`): `TrainerDef.rival = { round: 1 | 2 | 3 }`; the team comes from `rivalTeam(round, playerStarter)`; the rival's starter is the one with the type advantage (fire beats grass, water fire, grass water) and the player's starter is remembered as a
  `starter-<id>` flag. Teams: round 1 Pidgey 6 + starter 7; round 2 Pidgeotto 19, Abra 18, evolved starter 21; round 3 Pidgeotto 25, Kadabra 24, Growlithe 25, evolved starter 29.
- **World checks** (`nudge/game/worldCheck.ts`, used by `world.test.ts` and `npm run check-world`): warps (target exists and is walkable, a way back), reachability (a search over maps, tiles, ledges, warps and gate NPCs; whenever a gym leader's map is reached
  the next badge counts as won and the search repeats), nobody on blocked tiles or on top of each other, valid species/moves/items in tables, teams and gifts, and the coverage count (legendaries and Mew/Mewtwo excluded). The required coverage in the test is raised
  at each milestone (12 now, 100 at P3-M6).

## P3-M5: världen del 1

- **Karttyper och storlekar** ligger i `nudge/game/maps/layout.ts` (`SIZES`): alla kartor byggs med `mapBuilder`, och `road()` / `enterable()` / `stairs()` ser till att varp, vägar och interiörer hänger ihop (en väg landar alltid en ruta innanför motsatt kant på målkartan).
- **De åtta första platserna**: Hemstad (30x24), Väg 1, Skogen, Grusstad (gym 1, Granit), Väg 2, Månberget (3 våningar), Väg 3 (kust, fiske), Hamnstad (gym 2, Kajsa). De gamla handritade kartorna är gjorda om med buildern (inga ASCII-filer kvar för hand).
  Hamnstads norra väg och vakterna vid den (`requiresBadges` 2) kommer i P3-M6 när Väg 4 finns.
- **Gamla enhetstester** pekade på gamla koordinater; de är uppdaterade till de nya kartorna (Hemstad start (14,12), hemmet (6,8) -> (3,5), labbet, centret i Grusstad, gymmet) och boten går nu Hemstad -> Väg 1 (gräset vid x 3-6, y 12-16) -> Grusstad.
- **Teman utan egna bitar** för sand, klippa, avsats, grotta och trappa målar nu enkla färgade ersättare i `describeTile` (inte rutan "saknas") så varje tema kan visa varje karta; temats egna bitar går före.
  Skyltar i grottor står på grottgolv. Hus utan dörr (kuliss) har en solid vägg där dörren skulle vara.
- **Månberget våning 1**: Torstens ruta var instängd av en slumpad grottavägg; en liten yta fylld som grotta binder ihop den (hittades av `maps.test.ts`).

## P3-M6: världen del 2

- **Platserna 9-16**: Väg 4 (äng) + Kraftverket (2 våningar, valfritt, med Åskstenen), Gnistby (gym 3, Ture, elektrisk; Karatedojon ger Hitmonlee/Hitmonchan), Väg 5 (bergsväg med avsatser) + Spöktornet (3 våningar, valfritt, toppen ger Superspöet),
  Väg 6 (sjö + skog, fiske, rival 3), Blomstad (gym 4, Lilja, gräs) och Vildmarken (bara med fyra märken, sällsynta Pokémon och Lapras som present vid sjön). Totalt 41 kartor.
- **Spärrar**: Hamnstads norra väg kräver 2 märken, Gnistbys norra väg 3, Blomstads östra väg 4 (varje gång både `requiresBadges` på varpen och två vakter som blockerar vägen). Gnistby nås från Väg 4 utan att gå genom Kraftverket.
- **Gym 3 och 4**: Ture har Voltorb 18, Pikachu 21, Raichu 24 (TM Thunderbolt, Gnistmärket); Lilja har Victreebel 24, Tangela 26, Vileplume 29 (TM Mega Drain, Blommärket). Gymeleverna har lag med 2-3 Pokémon i samma typ. Finjustering i P3-M7.
- **Rival 3** står på Väg 6 (fyra märken är inte krav, men han kommer efter Gnistby). Laget kommer från `rivalTeam(3, ...)` (Pidgeotto 25, Kadabra 24, Growlithe 25, starterns andra form 29).
- **Fiske**: egna tabeller för Väg 6 och Vildmarken (`FISHING_TABLES.route6/vildmarken`); Dratini kommer med Superspöet i Vildmarken. Hamnstad använder Väg 3:s tabell.
- **Pokédex-täckning**: 146 av 146 arter (utan legendariska och Mew/Mewtwo) går att få; kravet i `world.test.ts` är 100. Snorlax, Aerodactyl, Dragonair och Electabuzz är mycket sällsynta (vikt 1-3).
- **Butiker**: Gnistby säljer Thunder Wave, Light Screen och Agility, Blomstad Sleep Powder, Razor Leaf och Reflect (`SHOP_EXTRAS`); Hamnstad har fortfarande stenarna.
- **Hjälpfunktioner** i `maps/layout.ts`: `linkStairs` (två trappor som landar under varandra), `fillCenter` och `fillMart`. Tränare placeras aldrig i smala gångar (en besegrad tränare står kvar): `maps.test.ts` går igenom alla kartor med tränare som hinder.
- **Test**: `worldStore.test.ts` går hela vägen Hemstad -> Vildmarken med riktiga kontrollern (alla grindar öppna) och bekräftar att första grinden är stängd utan märke.

## P3-M7: balans och genomspelning

- **Gym-simulatorn** (`npm run sim-gyms`, `nudge/scripts/sim-gyms.ts`) låter det "förväntade laget" (`nudge/game/expectedTeams.ts`) möta varje gymledare 500 gånger, utan nudges och med nudge-strategin `best`.
  Förväntade lag: gym 1 starter 16 + två kompisar på 13-14; gym 2 fyra Pokémon på 17-21; gym 3 på 22-24; gym 4 på 26-28. Spelaren behåller sina bästa attacker (`smartMoves`: de fyra starkaste attackerna den lärt sig, STAB räknas extra), eftersom
  standardmoves (de fyra senast lärda) ofta tappar den enda riktiga attacken (Weepinbell utan Vine Whip).
- **Resultat** (medel över de tre starters, 500 strider per ruta): Granit 72 % utan nudges / 76 % med; Kajsa 68 / 78; Ture 68 / 79; Lilja 65 / 82. Alla ligger i 55-75 % utan nudges, och nudges hjälper mer ju längre in man kommer. Typfördelen slår igenom
  tydligt (Granit: Bulbasaur/Squirtle ~97 %, Charmander ~24 %), vilket är avsiktligt, men Charmander får andra Pokémon och fler nivåer att komma runt det.
- **Ändrade ledare** (jämfört med planens spann): Granit Geodude 14 + Onix 18 (planen: 12-14; uppmätt nivå vid gymmet är ~16 eftersom Väg 1 och skogen ger mycket XP), Ture Voltorb 20, Pikachu 23, Raichu 26 (planen: 18-24). Ledarnas Pokémon har egna attackval
  (inga Recover/Stockpile-tomgångar, som gjorde att Starmie nästan inte gick att slå): Kajsa Water Gun/Bubble Beam/Swift, Ture Thunderbolt/Quick Attack/Thunder Wave/Slam, Lilja Razor Leaf/Mega Drain/Sleep Powder.
- **Tränarnivåer på vägarna** sänktes där en utvecklad Pokémon var för stark för platsen (Bengts Gyarados blev Magikarp, Vildmarkens Rhydon blev Rhyhorn, Ylvas Kadabra blev Abra, m.fl.).
- **Genomspelning med boten** (`playthrough.test.ts`): boten går med den riktiga kontrollern från Hemstad genom alla städer, handlar i varje Mart, helar i Centren, tar fyra märken i ordning och hämtar Lapras i Vildmarken, för alla tre starters. Genvägar (tillåtna i planen):
  före gym 2-4 byts laget mot det förväntade laget för gymmet, eftersom boten bara tränar en enda Pokémon. Gym 1 spelas utan genväg.
- **Fynd under vägen**: en instängd tränare i Månberget, en tränare som stod i en smal gång i Kraftverket (en besegrad tränare står kvar och blockerar), boten besökte aldrig Center/Mart (flaggan sattes innan den kommit fram),
  och `registerTrainer` kastade fel vid hot reload i dev-servern (nu tillåtet där, aldrig i test/build).

## P4-M1: cutscene-motorn

- `nudge/game/cutscene.ts` är en ren TypeScript-motor (`CutsceneRunner`): en lista steg (`text`, `showSprite`, `hideSprite`, `playCry`, `playMusic`, `jingle`, `input`, `choice`, `fade`, `wait`, `highlight`) plus `label`/`jump` (för "Så du heter X? Nej -> fråga igen"),
  `run` (kod som kan sätta variabler eller hoppa) och variabler som skrivs in i texten (`{player}`). Tysta steg körs rakt igenom, motorn stannar vid text, frågor, väntan och toningar. Allt utanför (rop, musik, jinglar) går via `hooks`.
- **Inmatningsregler** som i strids-avslutet: ett tryck avslutar skrivandet av raden, nästa tryck går till nästa rad/steg; 260 ms spärr efter ett tryck som går vidare (120 ms efter ett som bara visar hela raden), så en nedhållen tangent eller ett dubbeltryck kan inte hoppa över något.
  Tryck besvarar aldrig en fråga (namn och val kräver ett riktigt svar). Motorn räknar sin egen tid (`update(ms)`), så testerna körs utan klocka.
- `CutsceneScene.vue` ritar scenen (scen med upp till tre platser, textruta, små illustrationer för ATB-bar, move-knapp, hjärta och prickar, namnfält med förslagsknappar, valknappar, svart täckskikt) och skickar vidare tryck. Karaktärer ritas ur det aktiva temat (`StageCharacter.vue`), Pokémon som bilder.
  Dev-sida: `/nudge/dev/cutscene`.

## P4-M2: introt

- **Flödet** (`nudge/game/text/intro.ts`, alla texter där): svart skärm -> Professor Ek glider in -> Eevee dyker upp med rop och jingle -> fem rutor om det som är annorlunda (med små illustrationer: ATB-bar, blinkande move-knapp, nudge-prickar, hjärta) -> namn (max 10 tecken, tre förslag, "Så du heter X? Ja/Nej",
  "Nej" frågar igen) -> utseende (två spelar-sprites bredvid varandra, hoppas över om temat bara har ett) -> rivalen med namnförslag och bekräftelse -> avslutning, spelaren krymper, svart skärm och spelet fortsätter i spelarens rum (`hemhus`).
  Introt startas av `play.vue` för varje nytt spel som inte startas med dev-genvägar (`?map=...` osv.).
- **Namn och val sparas**: `player.name`, `player.rivalName`, `player.look` (`player`/`player2`) och `player.introDone` ligger i sparfilen, som nu är version 4. Migreringen 3 -> 4 ger gamla spel rivalen "Elias", första utseendet och `introDone = true` (de hoppar över introt).
  Sparning är nu tillåten så fort introt är klart (inte först när man fått en Pokémon), så namnen överlever om man stänger spelet före starter-valet.
- **Namn i all text**: text kan innehålla `{player}` och `{rival}` (`nudge/game/names.ts`, `fillNames`); de fylls i när en dialogruta öppnas, i tränarnas namn och i strids-avslutets texter. Rivalen heter `{rival}` i tränardatan (`RIVAL_NAME`).
- **Andra utseendet**: ny sprite-nyckel `player2` i alla fyra teman (Tuxemon "heroine", Ninja Adventure "Princess", Kenney en annan karaktär, Pipoya återanvänder `girl`); det är det enda som behövdes för att temat ska kunna visa det.

## P4-M3: starter och guidad första strid

- **Starter-valet** visar nu varje starters drag (trait) och natur med förklaring (samma texter som sammanfattningen). De slumpas första gången labbet öppnas (`player.starterRolls`, sparas i sparfilen), så valet är personligt och inte kan "omrullas" genom att ladda om.
  Professor Ek (labbets professor heter inte längre Almqvist) hälsar med `{player}` och förklarar att natur och drag påverkar striderna.
- **Första striden** (`game/tutorial.ts`, rent och testat) startar direkt efter valet: professorn kommenterar, rivalen kliver in med den starter som slår spelarens (`rivalTeam(0, ...)`, nivå 5 mot nivå 5, tränaren `rival-0` finns inte på någon karta) och striden börjar.
  Striden pausar fyra gånger: (1) ATB-baren (markerad), (2) "tryck på en attack" (väntar tills spelaren har nudgat, kan inte stängas med tryck), (3) efter nästa val förklaras ♪ eller … beroende på om Pokémonen följde, (4) nudge-prickarna. Ett tryck stänger en ruta (260 ms spärr, nyckel-repeat ignoreras). Knapp "Hoppa över förklaringarna" finns redan; själva valet för senare nya spel kommer i P4-M4.
- **Kan inte förloras så att spelet stoppas**: vid förlust läks Pokémonen, ingen blackout, inga pengar förloras, rivalen får sin replik; vid vinst får man inga pengar. Båda vägarna fortsätter med professorns scen: 5 Poké Balls, Pokédex (flaggan `pokedex`, menyknappen visas först då) och en kort förklaring av fångst ("ju svagare, desto lättare").
  Poké Balls ges alltså inte längre vid valet. Äldre spel som redan har en starter får Pokédex-flaggan i migreringen.
- **Boten** läser tutorial-rutorna (nudgar på "prova nu") och håller sig nu i gräset när den tränar (en ändrad slumpföljd visade att den annars kunde pendla utanför gräset).

## P4-M4: hoppa över och anteckningar

- **Hoppa över**: introt kan hoppas över bara när det har spelats förut på enheten (`settings.introSeen`, i webbläsarens inställningar, inte i sparfilen). Håll Esc eller X i en sekund; en liten indikator uppe till höger fyller sig. Då visas en kort version (`quickIntroSteps`: namn, utseende, rival med samma bekräftelser)
  och flaggan `tutorial-off` sätts, så professorns pauser i första striden hoppas över (striden, rivalen och gåvorna är desamma). Första gången på en enhet visas ingen hoppa över-indikator.
- **Professorns anteckningar** (`game/text/notes.ts`, menyknappen "Anteckningar"): ATB, nudge, natur, drag, förtroende, favoritattack, fångst, lydnad och märken. Avsnitt låses upp när spelet förklarar dem: ATB/nudge/förtroende i introt, natur/drag när man väljer starter, fångst efter första striden,
  favorit när första favoritattacken dyker upp, lydnad vid första gymmärket eller första gången en Pokémon ignorerar en. Efter ett hoppat intro är alla läsbara direkt, och spel som redan var igång (migrering 3 -> 4) har alla upplåsta. Låsta avsnitt visas som "???". Ett litet meddelande säger "Ny anteckning: ..." när något låses upp på kartan.

## P4-M5: konton och spelar-ID

- **Konto krävs** (`AuthScreen.vue` före titelskärmen, `play.vue` skickar tillbaka till `/nudge` utan konto): e-post + lösenord, skapa konto (samma serverroute `/api/auth/register` som gladiatorspelet, kontot är bekräftat direkt), inloggningslänk (magic link) och "glömt lösenord" (Supabase `resetPasswordForEmail`).
  Den automatiska anonyma inloggningen är borttagen. Samma Supabase-användare som i gladiatorspelet kan logga in.
- **Gamla anonyma spelare** ser "Skapa konto för att fortsätta"; `/api/nudge/upgrade` (servern, service role) sätter e-post + lösenord på samma användare med admin-API:t, så användar-id och därmed sparfilerna är kvar. Ingen bekräftelsemejl behövs (som vid vanlig registrering).
- **Profil och spelar-ID** (`supabase/migrations/0015_nudge_profiles.sql`): tabellen `profiles` (`display_name` 1-10 tecken, `tag` unik). RLS: alla inloggade får läsa, ägaren får bara ändra `display_name` (kolumnrättighet, inte `tag`), inga direkta insert/delete. Raden skapas av `ensure_profile(namn)` (security definer) som drar ett ledigt
  tal 1000-9999 på servern; är intervallet fullt (sökning över lediga tal) går den över till 10000-99999 (det noteras här). `pick_free_tag` är inte anropbar från klienten. Tränarnamnet från introt blir visningsnamnet (`account.setDisplayName` anropas när introt är klart); före introt visas bara e-posten.
  `Namn #1452` visas på titelskärmen och överst i menyn (och senare på datorn).
- **Hjälpfunktioner** i `nudge/game/account.ts` (tolka `#1452`, formatera, rensa namn, kontrollera formuläret, vem får spela). Migrationen har tester som kontrollerar att den bara skapar nya objekt, har RLS och att taggen sätts på servern.
- **Dev**: `?noauth=1` på `/nudge` och `/nudge/play` hoppar över kontot, bara i dev-servern (`import.meta.dev`). Inloggnings- och kontoflödet är inte provat mot riktiga Supabase (jag skapar inga konton där): skärmen och spärren är kontrollerade i webbläsaren.

## P4-M6: servern, lag, simulering och matcher

- **Autopilot-läge** = stridstypen `pvp` i motorn: `nudge()` och alla spelarhandlingar nekas (`reason: 'autopilot'`), båda sidorna gör lydnadsslumpen (gymmärkesgränsen är avstängd, men slapphet vid lågt förtroende gäller båda), allt annat (natur, drag, förtroende, vanor, favorit, held item, IV:er, moves) gäller som vanligt. Tidsgräns `PVP_MAX_BATTLE_MS` (5 min stridstid, i `balance.ts`):
  därefter vinner sidan med störst andel kvarvarande HP, exakt lika är oavgjort. `PVP_ALLOW_DUPLICATE_SPECIES` (på) är flaggan för regeln om samma art flera gånger. `ENGINE_VERSION` (`engine/version.ts`) sparas med varje match.
- **Servern kör samma kod som spelet**: `nudge/engine`, `nudge/data` och nya `nudge/server` (brackets, ögonblicksbild + validering, autopilot-simulering, matchning, de tre operationerna) kopieras med `npm run sync-functions` till `supabase/functions/_shared/nudge/` med Deno-importer (`.ts`, `with { type: 'json' }`).
  Ett test kontrollerar att kopian är aktuell, att koden inte har Node-/webbläsarberoenden och att en match körd som vanliga moduler utanför byggverktygen (Node) ger exakt samma resultat och händelselogg som i spelet. Deno finns inte här, så själva Edge Functions är inte körda.
- **Validering** (`validateTeam`): exakt 3 Pokémon, nivå inom bracketen, art, IV 0-31, natur, drag, förtroende 0-255, 1-4 olika attacker som är lagliga (nivåattacker upp till nivån för arten eller dess tidigare former, eller TM), held item som går att hålla, vanor, favorit bland attackerna, unika instans-id och **inga okända fält** (påhittade stats avvisas;
  stats räknas alltid ut av servern ur arten). Alla fel returneras på svenska.
- **De tre operationerna** (`handlers.ts`, mot ett litet `Db`-gränssnitt: supabase-js i Edge Functions, minnesversion i testerna): `submit-bracket` (ersätter lagets plats i bracketen, väljer motståndare med närmast rating bland topp 5 inom ±150 och undviker de tre senaste, väntar om ingen finns, spelar annars matchen och sparar den),
  `send-challenge` (via ID, max 10 obesvarade och 20 per timme, ger ingen rating) och `respond-challenge` (avböj, eller anta med egna 3 Pokémon i samma bracket; ogiltigt efter 7 dagar). Bracket-matcher är max 30 per timme och spelare.
  Matchen sparas med `nudge_record_match` (en transaktion: match, rating för båda och den antagna utmaningen). Ratinguträkningen (ELO) kommer i P4-M9; tills dess är betygsförändringen `null`.
- **Händelseloggens storlek**: en typisk match är 5-11 kB (40-95 händelser), även nivå 100 ligger under 10 kB, så loggen ligger inline som `jsonb` i `matches.events` (`events_path` finns kvar för framtida stora loggar).
- **Databasen** (`0016_nudge_matches.sql`): som planen, med RLS (betyg läsbara för alla inloggade, matcher för de två spelarna, utmaningar för avsändare och mottagare, eget lag i bracketen) och inga skrivrättigheter för webbläsaren.
