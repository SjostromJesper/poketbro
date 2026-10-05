import { gameData } from '../data'
import type { BattleOutcome } from '../engine/types'
import type { SequenceStep } from '../game/postBattle'
import type { useGameStore } from '../../app/stores/nudge/game'

export interface FinishChoices {
  /** Which move slot to forget when a new move does not fit (null = do not learn it). Default: do not learn it. */
  replace?: (uid: string, move: string) => number | null
  /** Nickname for a caught Pokémon (null = skip). */
  nickname?: string | null
}

/**
 * Plays the battle scene's post-battle sequence the way a player pressing through it would, then closes the battle.
 * Returns the steps that were played.
 */
export function finishBattle(game: ReturnType<typeof useGameStore>, outcome: BattleOutcome | null, choices: FinishChoices = {}): SequenceStep[] {
  if (outcome) game.beginPostBattle(outcome)
  const steps = [...(game.sequence ?? [])]
  for (const step of steps) {
    if (step.type === 'moveReplace') game.learnChoice(step.uid, step.move, choices.replace?.(step.uid, step.move) ?? null)
    else if (step.type === 'nickname') game.giveNickname(step.uid, choices.nickname ?? null)
  }
  game.finishBattle()
  return steps
}

/** Bot choice: forget the weakest move if the new one is better. */
export function weakestMove(pokemon: { moves: { move: string }[] }, newMove: string): number | null {
  const newPower = gameData.moves[newMove].power ?? 0
  let worst = 0
  let worstPower = Infinity
  pokemon.moves.forEach((m, i) => {
    const power = gameData.moves[m.move].power ?? 0
    if (power < worstPower) { worstPower = power; worst = i }
  })
  return newPower > worstPower ? worst : null
}
