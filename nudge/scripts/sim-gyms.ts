// Balance check for the four gym leaders (PLAN-3 4.6): a reasonable team of the expected level fights each leader many times, without nudges and
// with the simple "best" nudge strategy. Target: roughly 55-75 % wins without nudges, more with them. `npm run sim-gyms -- --battles 400 --trust 120`.
import { gameData } from '../data'
import { createTrainerPokemon } from '../engine/ai'
import { BALANCE } from '../engine/balance'
import { runBattle, type NudgeStrategy } from '../engine/headless'
import { createPokemon } from '../engine/pokemon'
import { createRng } from '../engine/rng'
import type { OwnedPokemon } from '../engine/types'
import { expectedTeam, smartMoves, speciesOfSlot } from '../game/expectedTeams'
import '../game/maps'
import { TRAINERS } from '../game/trainers'

const argv = process.argv.slice(2)
const option = (name: string, fallback: number) => {
  const i = argv.indexOf(name)
  return i >= 0 ? Number(argv[i + 1]) : fallback
}
const BATTLES = option('--battles', 300)
const TRUST = option('--trust', 120)
const QUIET = argv.includes('--quiet')

interface Gym {
  name: string
  leader: string
  n: 1 | 2 | 3 | 4
}

const GYMS: Gym[] = [
  { name: 'Granit (1)', leader: 'gym-granit', n: 1 },
  { name: 'Kajsa (2)', leader: 'hamn-kajsa', n: 2 },
  { name: 'Ture (3)', leader: 'gnistby-ture', n: 3 },
  { name: 'Lilja (4)', leader: 'blomstad-lilja', n: 4 },
]
const OFFSET = option('--offset', 0)

const STARTERS = [{ name: 'Bulbasaur', id: 1 }, { name: 'Charmander', id: 4 }, { name: 'Squirtle', id: 7 }]

function play(gym: Gym, starter: number, strategy: NudgeStrategy): { wins: number, hp: number, timeouts: number } {
  const def = TRAINERS[gym.leader]
  const team = expectedTeam(gym.n, OFFSET)
  let wins = 0
  let hp = 0
  let timeouts = 0
  for (let i = 0; i < BATTLES; i++) {
    const rng = createRng(1000 + i)
    const player: OwnedPokemon[] = team.slots.map(([slot, level]) => {
      const speciesId = speciesOfSlot(slot, starter, level)
      return createPokemon({ data: gameData, balance: BALANCE, rng, speciesId, level, trust: TRUST, moves: smartMoves(gameData, speciesId, level) })
    })
    const enemy = def.team.map(mon => createTrainerPokemon({
      data: gameData, balance: BALANCE, rng, speciesId: mon.speciesId, level: mon.level, moves: mon.moves, heldItem: mon.heldItem, trainerName: def.name,
    }))
    const result = runBattle({ player, enemy, kind: 'trainer', rng, balance: BALANCE, data: gameData, badges: team.badges }, { strategy, collectEvents: false })
    if (result.timedOut) timeouts++
    if (!result.timedOut && result.outcome?.result === 'win') wins++
    hp += result.engine.state.player.battlers.reduce((sum, b) => sum + b.hp / b.stats.hp, 0) / result.engine.state.player.battlers.length
  }
  return { wins: wins / BATTLES, hp: hp / BATTLES, timeouts: timeouts / BATTLES }
}

console.log(`Gym balance: ${BATTLES} battles per cell, trust ${TRUST}\n`)
for (const gym of GYMS) {
  const def = TRAINERS[gym.leader]
  console.log(`${gym.name}: ${def.team.map(m => `${gameData.species[m.speciesId].displayName} ${m.level}`).join(', ')}  (your team: ${expectedTeam(gym.n, OFFSET).slots.map(([id, l]) => `${id === 'starter' || id === 'starter2' ? 'starter' : gameData.species[id].displayName} ${l}`).join(', ')})`)
  let sumNone = 0
  let sumBest = 0
  for (const s of STARTERS) {
    const none = play(gym, s.id, 'none')
    const best = play(gym, s.id, 'best')
    sumNone += none.wins
    sumBest += best.wins
    if (!QUIET) console.log(`  ${s.name.padEnd(11)} no nudges ${(100 * none.wins).toFixed(0).padStart(3)} %   best ${(100 * best.wins).toFixed(0).padStart(3)} %${none.timeouts > 0.02 ? `   (timeouts ${(100 * none.timeouts).toFixed(0)} %)` : ''}`)
  }
  console.log(`  average      no nudges ${(100 * sumNone / STARTERS.length).toFixed(0).padStart(3)} %   best ${(100 * sumBest / STARTERS.length).toFixed(0).padStart(3)} %`)
}
