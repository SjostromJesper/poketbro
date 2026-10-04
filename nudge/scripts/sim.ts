// Headless batch simulation. Examples:
//   npm run sim
//   npm run sim -- --battles 2000 --player charmander:12 --enemy geodude:10 --trust 120 --trait calm
//   npm run sim -- --player bulbasaur:15,pidgey:10 --enemy brock --compare
// Options: --battles N --seed N --player SPEC --enemy SPEC --trust N --trait ID --strategy none|best|always-best --compare --badges N
//          --set KEY=JSON  (override a balance value for the experiment, e.g. --set NUDGE_BUDGET_BASE=4 --set 'NUDGE_CURVE=[0.7,0.5,0.3,0.2,0.1]')
import { gameData } from '../data'
import { createTrainerPokemon, createWildPokemon } from '../engine/ai'
import { BALANCE, type TraitId } from '../engine/balance'
import { runBattle, type NudgeStrategy } from '../engine/headless'
import { classifyMove } from '../engine/moves'
import { createPokemon } from '../engine/pokemon'
import { createRng } from '../engine/rng'
import type { OwnedPokemon } from '../engine/types'

interface Args {
  battles: number
  seed: number
  player: string
  enemy: string
  trust: number
  trait: TraitId | null
  strategy: NudgeStrategy
  compare: boolean
  badges: number
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    battles: 1000, seed: 1, player: 'charmander:12', enemy: 'geodude:10,onix:13', trust: 120, trait: null, strategy: 'best', compare: true, badges: 0,
  }
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i]
    const value = argv[i + 1]
    switch (key) {
      case '--battles': args.battles = Number(value); i++; break
      case '--seed': args.seed = Number(value); i++; break
      case '--player': args.player = value; i++; break
      case '--enemy': args.enemy = value; i++; break
      case '--trust': args.trust = Number(value); i++; break
      case '--trait': args.trait = value as TraitId; i++; break
      case '--strategy': args.strategy = value as NudgeStrategy; args.compare = false; i++; break
      case '--badges': args.badges = Number(value); i++; break
      case '--set': {
        const eq = value.indexOf('=')
        ;(BALANCE as unknown as Record<string, unknown>)[value.slice(0, eq)] = JSON.parse(value.slice(eq + 1))
        i++
        break
      }
      case '--compare': args.compare = true; break
      default: break
    }
  }
  return args
}

function speciesByName(name: string): number {
  const species = Object.values(gameData.species).find(s => s.name === name.toLowerCase())
  if (!species) throw new Error(`Unknown species "${name}"`)
  return species.id
}

function parseTeam(spec: string): { speciesId: number, level: number }[] {
  return spec.split(',').map((part) => {
    const [name, level] = part.split(':')
    return { speciesId: speciesByName(name), level: Number(level ?? 5) }
  })
}

interface Tally {
  wins: number
  losses: number
  timeouts: number
  totalSeconds: number
  playerMoves: Map<string, number>
  enemyMoves: Map<string, number>
  /** Share of chosen moves by category: attack / defense / support (both sides). */
  categories: { attack: number, defense: number, support: number }
  nudgesUsed: number
  nudgesFollowed: number
  nudgesTotal: number
  leftHp: number
}

function simulate(args: Args, strategy: NudgeStrategy): Tally {
  const tally: Tally = {
    wins: 0, losses: 0, timeouts: 0, totalSeconds: 0, playerMoves: new Map(), enemyMoves: new Map(), categories: { attack: 0, defense: 0, support: 0 },
    nudgesUsed: 0, nudgesFollowed: 0, nudgesTotal: 0, leftHp: 0,
  }
  const playerSpec = parseTeam(args.player)
  const enemySpec = parseTeam(args.enemy)
  for (let i = 0; i < args.battles; i++) {
    const rng = createRng(args.seed * 100003 + i)
    const player: OwnedPokemon[] = playerSpec.map(s => createPokemon({
      data: gameData, balance: BALANCE, rng, speciesId: s.speciesId, level: s.level, trust: args.trust, trait: args.trait ?? undefined,
    }))
    const enemy: OwnedPokemon[] = enemySpec.map(s => (enemySpec.length > 1 || args.enemy.includes('!')
      ? createTrainerPokemon({ data: gameData, balance: BALANCE, rng, speciesId: s.speciesId, level: s.level, trainerName: 'sim' })
      : createWildPokemon({ data: gameData, balance: BALANCE, rng, speciesId: s.speciesId, level: s.level })))
    const kind = enemy.length > 1 ? 'trainer' : 'wild'
    const result = runBattle({ player, enemy, kind, rng, balance: BALANCE, data: gameData, badges: args.badges }, { strategy, collectEvents: true })
    if (result.timedOut) tally.timeouts++
    else if (result.outcome?.result === 'win') tally.wins++
    else tally.losses++
    tally.totalSeconds += result.durationMs / 1000
    for (const event of result.events) {
      if (event.type === 'move-chosen') {
        const moveData = gameData.moves[event.move]
        if (moveData) tally.categories[classifyMove(moveData, BALANCE)]++
        const map = event.side === 'player' ? tally.playerMoves : tally.enemyMoves
        map.set(event.moveName, (map.get(event.moveName) ?? 0) + 1)
        if (event.side === 'player' && event.followedNudge !== null) {
          tally.nudgesTotal++
          if (event.followedNudge) tally.nudgesFollowed++
        }
      }
    }
    for (const b of result.engine.state.player.battlers) tally.nudgesUsed += b.nudgesUsed
    tally.leftHp += result.engine.state.player.battlers.reduce((sum, b) => sum + b.hp / b.stats.hp, 0) / result.engine.state.player.battlers.length
  }
  return tally
}

function distribution(map: Map<string, number>): string {
  const total = [...map.values()].reduce((a, b) => a + b, 0) || 1
  return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([move, n]) => `${move} ${(100 * n / total).toFixed(0)}%`).join(', ')
}

function report(label: string, args: Args, tally: Tally): void {
  const n = args.battles
  console.log(`\n== ${label} ==`)
  console.log(`win rate:        ${(100 * tally.wins / n).toFixed(1)}%  (losses ${tally.losses}, timeouts ${tally.timeouts})`)
  console.log(`avg duration:    ${(tally.totalSeconds / n).toFixed(1)} s`)
  console.log(`avg HP left:     ${(100 * tally.leftHp / n).toFixed(0)}% of max (team average)`)
  console.log(`nudges:          ${(tally.nudgesUsed / n).toFixed(2)} used per battle, followed ${tally.nudgesTotal ? (100 * tally.nudgesFollowed / tally.nudgesTotal).toFixed(0) : 0}% of the time`)
  const catTotal = tally.categories.attack + tally.categories.defense + tally.categories.support || 1
  console.log(`move categories: attack ${(100 * tally.categories.attack / catTotal).toFixed(0)}%, defense ${(100 * tally.categories.defense / catTotal).toFixed(0)}%, support ${(100 * tally.categories.support / catTotal).toFixed(0)}%`)
  console.log(`player moves:    ${distribution(tally.playerMoves)}`)
  console.log(`enemy moves:     ${distribution(tally.enemyMoves)}`)
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  console.log(`Simulating ${args.battles} battles: [${args.player}] vs [${args.enemy}] (trust ${args.trust}${args.trait ? `, trait ${args.trait}` : ', random trait'}, seed ${args.seed})`)
  if (args.compare) {
    report('no nudges', args, simulate(args, 'none'))
    report('nudge strategy ("best")', args, simulate(args, 'best'))
  } else {
    report(`strategy "${args.strategy}"`, args, simulate(args, args.strategy))
  }
}

main()
