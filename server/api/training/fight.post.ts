import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { RACES, finalStats, randomAllocation, raceById } from '#shared/game/races'
import { maxHealth, simulateBattle } from '#shared/game/battle'
import { tacticById } from '#shared/game/tactics'
import { applyPassiveRegen } from '#shared/game/regen'
import { MAX_ADVENTURE_TIME, timeCostForBattle } from '#shared/game/stamina'
import { MAX_LEVEL, POINTS_PER_LEVEL, XP_TO_LEVEL, levelForXp } from '#shared/game/progression'
import { withStats } from '#shared/game/character'
import { applyItemBonuses } from '#shared/game/items'
import { resolveSkills } from '#shared/game/skills'
import { WIN_GOLD } from '#shared/game/shop'

const WIN_XP = 25
const LOSS_XP = 8
const MAX_TRAINING_DIFFICULTY = 5
/** How much extra opponent stat pool each training-difficulty tier adds, on top of the character-level scaling. */
const DIFFICULTY_POOL_BONUS = 25
/** Extra XP per training-difficulty tier above 1, on a win - harder dummies are worth more, matching real Lanista. */
const DIFFICULTY_XP_BONUS = 5

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Not authenticated' })
  }

  const body = await readBody<{ tacticId?: string, giveUpPercent?: number }>(event)
  const tacticId = body.tacticId ?? 'normal'
  const giveUpPercent = Math.min(90, Math.max(0, Number(body.giveUpPercent ?? 20)))

  let tactic
  try {
    tactic = tacticById(tacticId)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Okänd taktik' })
  }

  const admin = serverSupabaseServiceRole(event)

  const { data: character, error: fetchError } = await admin
    .from('characters')
    .select('*')
    .eq('user_id', user.sub)
    .single()

  if (fetchError || !character) {
    throw createError({ statusCode: 404, statusMessage: 'Ingen gladiator hittades' })
  }
  if (character.level >= MAX_LEVEL) {
    throw createError({ statusCode: 400, statusMessage: 'Du är examinerad och kan inte längre träna i gladiatorskolan' })
  }

  const timeRegen = applyPassiveRegen(character.time_remaining, MAX_ADVENTURE_TIME, character.last_time_regen_at)
  if (timeRegen.hp < 5) {
    throw createError({ statusCode: 400, statusMessage: 'Du är för trött för att slåss (kräver minst 5 tid, fylls på över tid).' })
  }

  const race = raceById(character.race_id)
  const equippedItems = await fetchEquippedItems(admin, user.sub)
  const gear = resolveEquippedGear(equippedItems)
  const stats = applyItemBonuses(finalStats(race, character.allocated), equippedItems)
  const maxHp = maxHealth(stats)
  const regen = applyPassiveRegen(character.current_hp, maxHp, character.last_regen_at)

  const level = character.level
  const difficulty = Math.min(MAX_TRAINING_DIFFICULTY, Math.max(1, character.training_difficulty ?? 1))
  const opponentRace = RACES[Math.floor(Math.random() * RACES.length)]
  const opponentPool = 80 + level * 25 + (difficulty - 1) * DIFFICULTY_POOL_BONUS
  const opponentAllocation = randomAllocation(opponentPool)
  const opponentStats = finalStats(opponentRace, opponentAllocation)
  const opponentName = `Träningsdocka (nivå ${level}, svårighetsgrad ${difficulty})`

  const result = simulateBattle(
    {
      name: character.name,
      stats,
      tactic,
      giveUpPercent,
      startingHp: regen.hp,
      skills: resolveSkills(character.skill_ids),
      weaponType: gear.weaponType,
      weaponExtraAttackChance: gear.weaponExtraAttackChance,
      weaponMinDamage: gear.weaponMinDamage,
      weaponMaxDamage: gear.weaponMaxDamage,
      weaponRecommendedSkill: gear.weaponRecommendedSkill,
      hasShield: gear.hasShield,
      shieldMaxBlocksPerRound: gear.shieldMaxBlocksPerRound,
      shieldAbsorption: gear.shieldAbsorption,
      shieldMinAbsorption: gear.shieldMinAbsorption,
      shieldRecommendedSkill: gear.shieldRecommendedSkill,
      weaponBreakThreshold: gear.weaponBreakThreshold,
      shieldBreakThreshold: gear.shieldBreakThreshold,
      offWeaponBreakThreshold: gear.offWeaponBreakThreshold,
      offWeaponType: gear.offWeaponType,
      offWeaponExtraAttackChance: gear.offWeaponExtraAttackChance,
      offWeaponMinDamage: gear.offWeaponMinDamage,
      offWeaponMaxDamage: gear.offWeaponMaxDamage,
      offWeaponRecommendedSkill: gear.offWeaponRecommendedSkill,
    },
    {
      name: opponentName,
      stats: opponentStats,
      tactic: tacticById('normal'),
      giveUpPercent: 0,
    },
  )

  const won = result.winnerName === character.name
  // Win -> advance to a harder opponent next time (more XP too); lose -> demoted one
  // step back to easier ground. Matches real Lanista's gladiatorskolan progression.
  const newDifficulty = won ? Math.min(MAX_TRAINING_DIFFICULTY, difficulty + 1) : Math.max(1, difficulty - 1)
  const xpGain = won ? WIN_XP + (difficulty - 1) * DIFFICULTY_XP_BONUS : LOSS_XP
  const newXp = character.xp + xpGain
  const newLevel = levelForXp(character.level, newXp)
  const leveledUp = newLevel > character.level
  const pointsGained = (newLevel - character.level) * POINTS_PER_LEVEL
  const goldGained = won ? WIN_GOLD : 0
  const timeCost = timeCostForBattle(result.rounds)

  const { data: updated, error: updateError } = await admin
    .from('characters')
    .update({
      xp: newXp,
      level: newLevel,
      training_difficulty: newDifficulty,
      current_hp: result.aFinalHp,
      last_regen_at: regen.lastRegenAt,
      time_remaining: Math.max(0, timeRegen.hp - timeCost),
      last_time_regen_at: timeRegen.lastRegenAt,
      default_tactic_id: tacticId,
      default_give_up_percent: giveUpPercent,
      unspent_points: character.unspent_points + pointsGained,
      gold: character.gold + goldGained,
    })
    .eq('user_id', user.sub)
    .select()
    .single()

  if (updateError || !updated) {
    throw createError({ statusCode: 500, statusMessage: updateError?.message ?? 'Kunde inte uppdatera gladiatorn' })
  }

  await admin.from('matches').insert({
    kind: 'training',
    player_a_user_id: user.sub,
    player_a_name: character.name,
    player_b_user_id: null,
    player_b_name: opponentName,
    winner_name: result.winnerName,
    loser_name: result.loserName,
    reason: result.reason,
    rounds: result.rounds,
    log: result.log,
  })

  const droppedItem = won ? await maybeGrantLoot(admin, user.sub, character.level) : null

  const levelUpText = leveledUp ? ` Du går upp till nivå ${newLevel} och får ${pointsGained} poäng att fördela!` : ''
  const outcomeText = won
    ? `Du vann! +${xpGain} XP, +${goldGained} guld.${levelUpText}${droppedItem ? ` Du hittade "${droppedItem.name}"!` : ''}`
    : `Du förlorade denna gång. +${xpGain} XP för försöket.${levelUpText}`

  return { result, character: withStats(updated, equippedItems), outcomeText, xpGain, goldGained, leveledUp, droppedItem }
})
