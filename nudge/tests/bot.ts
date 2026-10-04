// A simple automatic player that drives the real stores from a fresh game to the first gym badge: it takes a starter from the
// professor, walks (with the real controller), fights, catches, heals, shops and learns moves. Used by playthrough.test.ts to prove the
// game can be finished without crashing, and to collect numbers for balancing.
import { useBattleStore } from '../../app/stores/nudge/battle'
import { useGameStore } from '../../app/stores/nudge/game'
import { usePlayerStore } from '../../app/stores/nudge/player'
import { useWorldStore } from '../../app/stores/nudge/world'
import { gameData } from '../data'
import { applyNudgeStrategy } from '../engine/headless'
import { maxHpOf } from '../engine/pokemon'
import { MAPS } from '../game/maps'
import { DIRECTIONS, type Direction } from '../game/types'

export interface BotOptions {
  /** Species id of the starter to pick. */
  starter?: number
  /** The bot grinds until its lead Pokémon reaches this level before challenging the gym. */
  gymLevel?: number
  /** Nudge strategy used in battles. */
  strategy?: 'none' | 'best'
  /** Called to let fake timers run (battle transition delays). */
  advanceTimers: (ms: number) => void
  maxActions?: number
}

export interface BotReport {
  gotBadge: boolean
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
    gotBadge: false, actions: 0, steps: 0, wildBattles: 0, trainerBattles: 0, wins: 0, losses: 0, blackouts: 0, caught: 0, healTrips: 0,
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
    while (this.report.actions < max && !this.world.world!.hasFlag('badge-granit')) {
      this.report.actions++
      this.act()
    }
    this.report.gotBadge = this.world.world!.hasFlag('badge-granit')
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
        this.shop()
        this.game.closeShop()
        break
      case 'learn': {
        const pokemon = this.player.findPokemon(o.uid)!
        const newPower = gameData.moves[o.move].power ?? 0
        // Forget the weakest move if the new one is better.
        let worst = 0
        let worstPower = Infinity
        pokemon.moves.forEach((m, i) => {
          const power = gameData.moves[m.move].power ?? 0
          if (power < worstPower) { worstPower = power; worst = i }
        })
        this.game.resolveLearn(newPower > worstPower ? worst : null)
        break
      }
      case 'evolve':
        this.game.resolveEvolve(true)
        break
      case 'nickname':
        this.game.resolveNickname(null)
        break
      case 'pc':
        this.game.closePc()
        break
      case 'favorite':
        this.game.resolveFavorite()
        break
    }
  }

  private shop() {
    const buy = (item: string, wanted: number, price: number) => {
      while (this.player.count(item) < wanted && this.player.money >= price) {
        this.player.spend(price)
        this.player.addItem(item)
      }
    }
    buy('potion', 6, 150)
    buy('poke-ball', 6, 100)
    this.log(`Shopped (money left ${this.player.money})`)
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
      const eng = battle.engine!
      if (strategy !== 'none') {
        const before = eng.active('player').nudgesUsed
        applyNudgeStrategy(eng, strategy)
        if (eng.active('player').nudgesUsed > before) this.report.nudges++
      }
      const me = eng.active('player')
      // Heal when low (potions), throw a ball at a weakened wild Pokémon while the team is small.
      if (!me.fainted && me.hp < me.stats.hp * 0.3 && player.count('potion') > 0 && eng.state.cooldowns.itemMs <= 0) {
        const result = battle.act({ type: 'item', item: 'potion', targetIndex: me.teamIndex })
        if (result?.accepted) { player.removeItem('potion'); this.report.potionsUsed++ }
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
        this.report.losses++
        this.report.blackouts++
      }
      if (result === 'caught') this.report.caught++
      this.battleStarted = false
      this.game.finishBattle(battle.outcome)
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

  private plan() {
    const w = this.world.world!
    if (!w.hasFlag('starter')) return this.goAndTalk({ mapId: 'proflab', x: 4, y: 3, face: 'up' })

    const needsHeal = this.partyHealth() < 0.45 || !this.player.hasAbleParty
    if (needsHeal) {
      this.report.healTrips++
      return this.goAndTalk(this.nearestHealSpot())
    }

    const ready = this.leadLevel() >= (this.options.gymLevel ?? 14)
    if (!ready) {
      // Grind in the tall grass of Route 1 until strong enough (the Pokémon Center in Grusstad is far, so go home when hurt).
      return this.grind()
    }
    // Journey to Grusstad: heal, shop, then the gym leader.
    if (!w.hasFlag('visited-center')) {
      w.setFlag('visited-center')
      return this.goAndTalk({ mapId: 'gruss_center', x: 4, y: 4, face: 'up' })
    }
    if (!w.hasFlag('shopped')) {
      w.setFlag('shopped')
      return this.goAndTalk({ mapId: 'gruss_mart', x: 4, y: 4, face: 'up' })
    }
    return this.goAndTalk({ mapId: 'gruss_gym', x: 5, y: 3, face: 'up' })
  }

  private nearestHealSpot(): Goal {
    const w = this.world.world!
    const candidates: Goal[] = [{ mapId: 'hemhus', x: 3, y: 3, face: 'up' }]
    if (w.hasFlag('visited-center')) candidates.push({ mapId: 'gruss_center', x: 4, y: 4, face: 'up' })
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

  /** Walks into the tall grass on Route 1 and paces around in it to trigger encounters (and its trainers on the way). */
  private grind() {
    const w = this.world.world!
    const target: Goal = { mapId: 'route1', x: 3, y: 26 }
    if (w.state.mapId !== 'route1' || w.state.x > 4 || w.state.y < 24 || w.state.y > 28) return this.walk(target)
    // Pace up and down inside the grass patch.
    const dir: Direction = w.state.y >= 28 ? 'up' : w.state.y <= 24 ? 'down' : (this.report.actions % 2 === 0 ? 'down' : 'up')
    this.hold(dir, 180)
  }

  // ---------------------------------------------------------------------------
  // Walking with the real controller
  // ---------------------------------------------------------------------------

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
        const warp = world.warpAt(x, y, map)
        if (warp?.requires && !world.hasFlag(warp.requires)) continue
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
