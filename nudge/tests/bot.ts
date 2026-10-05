// A simple automatic player that drives the real stores from a fresh game to the first gym badge (or on through all four gyms to the Wilderness): it takes a starter from the
// professor, walks (with the real controller), fights, catches, heals, shops and learns moves. Used by playthrough.test.ts to prove the
// game can be finished without crashing, and to collect numbers for balancing.
import { useBattleStore } from '../../app/stores/nudge/battle'
import { useGameStore } from '../../app/stores/nudge/game'
import { usePlayerStore } from '../../app/stores/nudge/player'
import { useWorldStore } from '../../app/stores/nudge/world'
import { gameData } from '../data'
import { BALANCE } from '../engine/balance'
import { createRng } from '../engine/rng'
import { createPokemon } from '../engine/pokemon'
import { expectedTeam, smartMoves, speciesOfSlot } from '../game/expectedTeams'
import { applyNudgeStrategy } from '../engine/headless'
import { maxHpOf } from '../engine/pokemon'
import { MAPS } from '../game/maps'
import { shopStock } from '../game/items'
import { DIRECTIONS, type Direction } from '../game/types'
import { finishBattle, weakestMove } from './sequence'

export interface BotOptions {
  /** Species id of the starter to pick. */
  starter?: number
  /** The bot grinds until its lead Pokémon reaches this level before challenging the first gym. */
  gymLevel?: number
  /** Where to stop: after the first badge (default), after badge 2, after all four badges and Lapras ('all'). */
  goal?: 'badge1' | 'badge2' | 'all'
  /** Lead levels to reach before challenging gym 1-4 (default 15, 21, 24, 28). */
  gymLevels?: number[]
  /**
   * Debug shortcut (allowed by PLAN-3 P3-M7): before gym 2-4 the party is replaced by the "expected team" of that gym (see expectedTeams.ts),
   * as a player who has trained a whole party would bring. The bot only trains one Pokémon, which cannot beat a gym alone. Default: on.
   */
  boost?: boolean
  /** Nudge strategy used in battles. */
  strategy?: 'none' | 'best'
  /** Called to let fake timers run (battle transition delays). */
  advanceTimers: (ms: number) => void
  maxActions?: number
}

export interface BotReport {
  gotBadge: boolean
  /** Whether the goal of the run was reached (all gyms + Lapras for 'all'). */
  done: boolean
  badges: string[]
  /** Lead level at the moment each gym leader was challenged. */
  levelsAtGym: number[]
  gotLapras: boolean
  actions: number
  steps: number
  wildBattles: number
  trainerBattles: number
  wins: number
  losses: number
  blackouts: number
  caught: number
  healTrips: number
  potionsUsed: number
  nudges: number
  battleSeconds: number
  leadLevel: number
  partyLevels: number[]
  money: number
  log: string[]
}

interface Goal {
  mapId: string
  x: number
  y: number
  /** Direction to face when arrived (for talking). */
  face?: Direction
}

export class Bot {
  readonly game = useGameStore()
  readonly player = usePlayerStore()
  readonly world = useWorldStore()
  readonly battle = useBattleStore()
  readonly report: BotReport = {
    gotBadge: false, done: false, badges: [], levelsAtGym: [], gotLapras: false, actions: 0, steps: 0, wildBattles: 0, trainerBattles: 0, wins: 0, losses: 0, blackouts: 0, caught: 0, healTrips: 0,
    potionsUsed: 0, nudges: 0, battleSeconds: 0, leadLevel: 0, partyLevels: [], money: 0, log: [],
  }
  private battleStarted = false

  constructor(private readonly options: BotOptions) {}

  private log(text: string) {
    if (this.report.log.length < 400) this.report.log.push(text)
  }

  // ---------------------------------------------------------------------------
  // Main loop
  // ---------------------------------------------------------------------------

  run(): BotReport {
    this.game.newGame()
    const max = this.options.maxActions ?? 3000
    while (this.report.actions < max && !this.finished()) {
      this.report.actions++
      this.act()
    }
    this.report.gotBadge = this.world.world!.hasFlag('badge-granit')
    this.report.done = this.finished()
    this.report.badges = [...this.player.badges]
    this.report.gotLapras = this.player.party.some(p => p.speciesId === 131) || this.player.box.some(p => p.speciesId === 131)
    this.report.steps = this.world.world!.state.steps
    this.report.money = this.player.money
    this.report.partyLevels = this.player.party.map(p => p.level)
    this.report.leadLevel = Math.max(0, ...this.report.partyLevels)
    return this.report
  }

  private act() {
    const { game, world, battle } = this
    if (game.overlay) return this.handleOverlay()
    if (world.dialog) return world.advanceDialog()
    if (game.screen === 'transition') return this.options.advanceTimers(1000)
    if (game.screen === 'battle') return this.fight()
    if (world.mode === 'busy') return this.settle()
    if (world.mode === 'menu') return world.closeMenu()
    if (world.mode !== 'walk') return this.settle()
    void battle
    this.plan()
  }

  /** Lets the world update for a moment (approaching trainers, fades, ...). */
  private settle(ms = 200) {
    for (let t = 0; t < ms; t += 16) this.world.update(16)
  }

  // ---------------------------------------------------------------------------
  // Overlays
  // ---------------------------------------------------------------------------

  private handleOverlay() {
    const o = this.game.overlay!
    switch (o.kind) {
      case 'starter':
        this.game.chooseStarter(this.options.starter ?? 7)
        this.log('Took a starter')
        break
      case 'shop':
        this.shop(o.shopId)
        this.game.closeShop()
        break
      case 'evolve':
        this.game.resolveEvolve(true)
        break
      case 'pc':
        this.game.closePc()
        break
      case 'gift':
        this.game.chooseGift(0)
        break
      case 'travel':
        this.game.closeOverlay()
        break
    }
  }

  private shop(shopId: string) {
    const stock = shopStock(shopId, this.player.badges.length)
    const buy = (item: string, wanted: number, price: number) => {
      if (!stock.includes(item)) return
      while (this.player.count(item) < wanted && this.player.money >= price) {
        this.player.spend(price)
        this.player.addItem(item)
      }
    }
    // The best healing the shop has (potions are what the bot uses in battle), then a few balls.
    const potions: [string, number][] = [['hyper-potion', 800], ['super-potion', 400], ['potion', 150]]
    const [potion, price] = potions.find(([id]) => stock.includes(id)) ?? potions[2]
    buy(potion, 6, price)
    buy('poke-ball', 6, 100)
    this.log(`Shopped at ${shopId} (money left ${this.player.money})`)
  }

  // ---------------------------------------------------------------------------
  // Battles
  // ---------------------------------------------------------------------------

  private fight() {
    const { battle, player } = this
    const engine = battle.engine
    if (!engine) return
    if (!this.battleStarted) {
      this.battleStarted = true
      battle.setSpeed(3)
      if (engine.state.kind === 'wild') this.report.wildBattles++
      else this.report.trainerBattles++
    }
    const strategy = this.options.strategy ?? 'best'
    for (let i = 0; i < 400 && !battle.result; i++) {
      battle.frame(16)
      // The guided first battle: the professor's pauses are read, and the "try a move" prompt waits for a nudge.
      if (battle.tutorialPrompt) {
        if (battle.tutorialPrompt.waitsForNudge) battle.nudge(0)
        else battle.dismissTutorial()
      }
      const eng = battle.engine!
      if (strategy !== 'none') {
        const before = eng.active('player').nudgesUsed
        applyNudgeStrategy(eng, strategy)
        if (eng.active('player').nudgesUsed > before) this.report.nudges++
      }
      const me = eng.active('player')
      // Heal when low (potions), throw a ball at a weakened wild Pokémon while the team is small.
      const potion = ['hyper-potion', 'super-potion', 'potion'].find(id => player.count(id) > 0)
      if (!me.fainted && me.hp < me.stats.hp * 0.3 && potion && eng.state.cooldowns.itemMs <= 0) {
        const result = battle.act({ type: 'item', item: potion, targetIndex: me.teamIndex })
        if (result?.accepted) { player.removeItem(potion); this.report.potionsUsed++ }
      }
      const foe = eng.active('enemy')
      if (eng.state.kind === 'wild' && player.party.length < 3 && player.count('poke-ball') > 0 && foe.hp < foe.stats.hp * 0.5 && eng.state.cooldowns.ballMs <= 0) {
        const result = battle.act({ type: 'ball' })
        if (result?.accepted) {
          player.removeItem('poke-ball')
          battle.resolveCapture()
        }
      }
    }
    if (battle.result) {
      const result = battle.result
      this.report.battleSeconds += (battle.engine?.state.timeMs ?? 0) / 1000
      if (result === 'win' || result === 'caught') this.report.wins++
      if (result === 'lose') {
        const st = this.world.world!.state
        this.log(`Lost at ${st.mapId} ${st.x},${st.y} (${this.battle.engine?.state.kind} vs ${this.battle.engine?.state.enemy.battlers.map(b => `${gameData.species[b.speciesId].name} ${b.level}`).join(', ')}) with lead ${this.leadLevel()}, party ${this.player.party.map(p => p.level).join('/')}`)
        this.report.losses++
        this.report.blackouts++
      }
      if (result === 'caught') this.report.caught++
      this.battleStarted = false
      finishBattle(this.game, battle.outcome, { replace: (uid, move) => weakestMove(this.player.findPokemon(uid)!, move) })
    }
  }

  // ---------------------------------------------------------------------------
  // Deciding where to go
  // ---------------------------------------------------------------------------

  private leadLevel(): number {
    return Math.max(0, ...this.player.party.map(p => p.level))
  }

  private partyHealth(): number {
    return this.player.totalHpFraction()
  }

  // The whole journey as a list of stages: each town's Center, Mart and gym, with the place where the bot trains before the gym.
  private static readonly STAGES: { badge: string, town: string, gym: string, grind: Goal, minLevel: number }[] = [
    { badge: 'granit', town: 'gruss', gym: 'gruss_gym', grind: { mapId: 'route1', x: 4, y: 14 }, minLevel: 15 },
    { badge: 'kajsa', town: 'hamn', gym: 'hamn_gym', grind: { mapId: 'route3', x: 14, y: 22 }, minLevel: 21 },
    { badge: 'ture', town: 'gnistby', gym: 'gnistby_gym', grind: { mapId: 'route4', x: 20, y: 27 }, minLevel: 24 },
    { badge: 'lilja', town: 'blomstad', gym: 'blomstad_gym', grind: { mapId: 'route6', x: 14, y: 20 }, minLevel: 28 },
  ]

  /** Where to stand to talk to the nurse / clerk / gym leader of a town (all interiors of a kind share a layout). */
  private spot(kind: 'center' | 'mart' | 'gym', town: string): Goal {
    if (kind === 'gym') return { mapId: `${town}_gym`, x: 6, y: 3, face: 'up' }
    if (kind === 'center') return { mapId: `${town}_center`, x: 5, y: 4, face: 'up' }
    return { mapId: `${town}_mart`, x: Math.floor(MAPS[`${town}_mart`].tiles[0].length / 2), y: 4, face: 'up' }
  }

  private finished(): boolean {
    const w = this.world.world!
    const goal = this.options.goal ?? 'badge1'
    if (goal === 'badge1') return w.hasFlag('badge-granit')
    if (goal === 'badge2') return w.hasFlag('badge-kajsa')
    return w.hasFlag('badge-lilja') && w.hasFlag('lapras')
  }

  private plan() {
    const w = this.world.world!
    if (!w.hasFlag('starter')) return this.goAndTalk({ mapId: 'proflab', x: 5, y: 3, face: 'up' })

    const needsHeal = this.partyHealth() < 0.45 || !this.player.hasAbleParty
    if (needsHeal) {
      this.report.healTrips++
      return this.goAndTalk(this.nearestHealSpot())
    }

    const stage = Bot.STAGES.find(s => !w.hasFlag(`badge-${s.badge}`))
    if (!stage) {
      // All four badges: into the Wilderness and the gift at the lake.
      return this.goAndTalk({ mapId: 'vildmarken', x: 36, y: 28, face: 'right' })
    }
    const index = Bot.STAGES.indexOf(stage)
    const needed = index === 0 ? (this.options.gymLevel ?? this.options.gymLevels?.[0] ?? stage.minLevel) : (this.options.gymLevels?.[index] ?? stage.minLevel)
    if (this.leadLevel() < needed) return this.grind(stage.grind)
    // Heal and shop in the town, then the leader. Visiting the Center and Mart once per town.
    if (!w.hasFlag(`bot-center-${stage.town}`)) return this.visit(this.spot('center', stage.town), `bot-center-${stage.town}`)
    if (!w.hasFlag(`bot-mart-${stage.town}`)) return this.visit(this.spot('mart', stage.town), `bot-mart-${stage.town}`)
    if (index >= 1 && (this.options.boost ?? true) && !w.hasFlag(`bot-boost-${index}`)) {
      w.setFlag(`bot-boost-${index}`)
      this.boostParty(index + 1 as 2 | 3 | 4)
      return
    }
    if (this.report.levelsAtGym.length <= index) this.report.levelsAtGym[index] = this.leadLevel()
    return this.goAndTalk(this.spot('gym', stage.town))
  }

  private boostParty(gym: 2 | 3 | 4) {
    const starter = [1, 4, 7].find(id => this.world.world!.hasFlag(`starter-${id}`)) ?? 4
    const rng = createRng(gym * 77)
    const team = expectedTeam(gym).slots.map(([slot, level]) => {
      const speciesId = speciesOfSlot(slot, starter, level)
      return createPokemon({ data: gameData, balance: BALANCE, rng, speciesId, level, trust: 120, moves: smartMoves(gameData, speciesId, level) })
    })
    this.player.party.splice(0, this.player.party.length, ...team)
    this.log(`Boosted the party for gym ${gym}: ${team.map(p => p.level).join('/')}`)
  }

  private nearestHealSpot(): Goal {
    const w = this.world.world!
    const candidates: Goal[] = [{ mapId: 'hemhus', x: 3, y: 4, face: 'up' }]
    for (const c of w.state.visitedCenters) candidates.push(this.spot('center', c.mapId))
    let best = candidates[0]
    let bestLength = Infinity
    for (const c of candidates) {
      const path = this.findPath(c)
      if (path && path.length < bestLength) {
        bestLength = path.length
        best = c
      }
    }
    return best
  }

  /** Walks into the tall grass (or cave floor) at `target` and paces around in it to trigger encounters (and the trainers on the way). */
  private grind(target: Goal) {
    const w = this.world.world!
    if (w.state.mapId !== target.mapId || Math.abs(w.state.x - target.x) > 3 || Math.abs(w.state.y - target.y) > 3) return this.walk(target)
    // Pace between neighbouring tiles that are walkable (preferring encounter tiles).
    const options = (['up', 'down', 'left', 'right'] as Direction[]).filter((d) => {
      const { dx, dy } = DIRECTIONS[d]
      return w.isWalkable(w.state.x + dx, w.state.y + dy) && !w.warpAt(w.state.x + dx, w.state.y + dy) && Math.abs(w.state.x + dx - target.x) <= 3 && Math.abs(w.state.y + dy - target.y) <= 3
    })
    // Stay in the grass: prefer steps onto encounter tiles, otherwise walk back towards the target.
    const grassy = options.filter((d) => {
      const { dx, dy } = DIRECTIONS[d]
      return w.tileAt(w.state.x + dx, w.state.y + dy)?.encounter
    })
    const pool = grassy.length ? grassy : options
    const dir = pool.length ? pool[this.report.actions % pool.length] : 'down'
    this.hold(dir, 180)
  }

  // ---------------------------------------------------------------------------
  // Walking with the real controller
  // ---------------------------------------------------------------------------

  /** Walks to `goal`, talks to whoever is there and remembers (with a flag) that the visit is done. */
  private visit(goal: Goal, flag: string) {
    const w = this.world.world!
    if (w.state.mapId === goal.mapId && w.state.x === goal.x && w.state.y === goal.y) w.setFlag(flag)
    this.goAndTalk(goal)
  }

  private goAndTalk(goal: Goal) {
    const w = this.world.world!
    if (w.state.mapId === goal.mapId && w.state.x === goal.x && w.state.y === goal.y) {
      if (goal.face) w.turn(goal.face)
      this.world.action()
      this.settle(100)
      return
    }
    this.walk(goal)
  }

  private hold(dir: Direction, ms: number) {
    this.world.holdDirection(dir)
    for (let t = 0; t < ms && this.world.mode === 'walk'; t += 16) this.world.update(16)
    this.world.holdDirection(null)
    // finish the current step animation
    for (let t = 0; t < 400 && this.world.mode === 'walk' && this.world.visual.walk >= 0; t += 16) this.world.update(16)
  }

  /** Breadth-first search over (map, x, y); warp tiles lead to their destination. Returns the directions to take. */
  private findPath(goal: Goal): Direction[] | null {
    const world = this.world.world!
    type Node = { mapId: string, x: number, y: number }
    const key = (n: Node) => `${n.mapId}:${n.x},${n.y}`
    const start: Node = { mapId: world.state.mapId, x: world.state.x, y: world.state.y }
    const previous = new Map<string, { from: Node, dir: Direction }>()
    const seen = new Set([key(start)])
    const queue: Node[] = [start]
    while (queue.length) {
      const node = queue.shift()!
      if (node.mapId === goal.mapId && node.x === goal.x && node.y === goal.y) {
        const path: Direction[] = []
        for (let n = node; key(n) !== key(start);) {
          const step = previous.get(key(n))!
          path.unshift(step.dir)
          n = step.from
        }
        return path
      }
      const map = MAPS[node.mapId]
      for (const dir of ['up', 'down', 'left', 'right'] as Direction[]) {
        const { dx, dy } = DIRECTIONS[dir]
        const x = node.x + dx
        const y = node.y + dy
        if (!world.isWalkable(x, y, map)) continue
        const isGoal = node.mapId === goal.mapId && x === goal.x && y === goal.y
        if (!isGoal && world.entityAt(x, y, map)) continue
        const warp = world.warpAt(x, y, map)
        if (warp?.requires && !world.hasFlag(warp.requires)) continue
        if (warp?.requiresBadges && world.badgeCount < warp.requiresBadges) continue
        const next: Node = warp ? { mapId: warp.to, x: warp.toX, y: warp.toY } : { mapId: node.mapId, x, y }
        if (seen.has(key(next))) continue
        seen.add(key(next))
        previous.set(key(next), { from: node, dir })
        queue.push(next)
      }
    }
    return null
  }

  /** Walks along the planned path until done or until something (a battle, a dialog) interrupts. */
  private walk(goal: Goal) {
    const path = this.findPath(goal)
    if (!path) throw new Error(`No path to ${JSON.stringify(goal)} from ${JSON.stringify(this.world.world!.state)}`)
    const world = this.world.world!
    for (const dir of path) {
      if (this.world.mode !== 'walk') return
      const before = `${world.state.mapId}:${world.state.x},${world.state.y}`
      this.world.holdDirection(dir)
      let waited = 0
      while (`${world.state.mapId}:${world.state.x},${world.state.y}` === before && waited < 1500 && this.world.mode === 'walk') {
        this.world.update(16)
        waited += 16
      }
      this.world.holdDirection(null)
      // The mode changes while updating (fades, trainers), so read it through a function TypeScript cannot narrow.
      const mode = (): string => this.world.mode
      for (let t = 0; t < 1200 && (mode() === 'fade' || (mode() === 'walk' && (this.world.visual.walk >= 0 || this.world.visual.x !== world.state.x || this.world.visual.y !== world.state.y))); t += 16) {
        this.world.update(16)
      }
      if (`${world.state.mapId}:${world.state.x},${world.state.y}` === before && mode() === 'walk') {
        throw new Error(`Stuck at ${before} trying to go ${dir}`)
      }
    }
  }
}

export function leadHpFraction(bot: Bot): number {
  const lead = bot.player.party[0]
  return lead ? lead.currentHp / maxHpOf(gameData, lead) : 0
}
