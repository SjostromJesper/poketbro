import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { finalStats, raceById } from '#shared/game/races'
import { maxHealth, simulateBattle } from '#shared/game/battle'
import { tacticById } from '#shared/game/tactics'
import { applyPassiveRegen } from '#shared/game/regen'
import { MAX_ADVENTURE_TIME, timeCostForBattle } from '#shared/game/stamina'
import { MAX_LEVEL } from '#shared/game/progression'
import { withStats } from '#shared/game/character'
import { applyItemBonuses } from '#shared/game/items'
import { resolveSkills } from '#shared/game/skills'
import { arenaBeastById, beastRewardGold, beastRewardXp, buildBeastCombatant } from '#shared/game/arenaBeasts'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Not authenticated' })
  }

  const body = await readBody<{ beastId?: string, tacticId?: string, giveUpPercent?: number }>(event)
  const beast = body.beastId ? arenaBeastById(body.beastId) : undefined
  if (!beast) {
    throw createError({ statusCode: 400, statusMessage: 'Okänd best' })
  }

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
  if (character.level < MAX_LEVEL) {
    throw createError({ statusCode: 400, statusMessage: 'Du måste vara examinerad (nivå 4) för att slåss mot arenans bestar' })
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
    buildBeastCombatant(beast),
  )

  const won = result.winnerName === character.name
  const goldGained = won ? beastRewardGold(beast.grade) : 0
  const xpGained = won ? beastRewardXp(beast.grade) : Math.round(beastRewardXp(beast.grade) * 0.2)
  const timeCost = timeCostForBattle(result.rounds)

  const { data: updated, error: updateError } = await admin
    .from('characters')
    .update({
      current_hp: result.aFinalHp,
      last_regen_at: regen.lastRegenAt,
      time_remaining: Math.max(0, timeRegen.hp - timeCost),
      last_time_regen_at: timeRegen.lastRegenAt,
      default_tactic_id: tacticId,
      default_give_up_percent: giveUpPercent,
      gold: character.gold + goldGained,
      xp: character.xp + xpGained,
    })
    .eq('user_id', user.sub)
    .select()
    .single()

  if (updateError || !updated) {
    throw createError({ statusCode: 500, statusMessage: updateError?.message ?? 'Kunde inte uppdatera gladiatorn' })
  }

  await admin.from('matches').insert({
    kind: 'beast',
    player_a_user_id: user.sub,
    player_a_name: character.name,
    player_b_user_id: null,
    player_b_name: beast.name,
    winner_name: result.winnerName,
    loser_name: result.loserName,
    reason: result.reason,
    rounds: result.rounds,
    log: result.log,
  })

  const droppedItem = won ? await maybeGrantLoot(admin, user.sub, Math.round(beast.grade / 4) + 1) : null

  const outcomeText = won
    ? `Du besegrade ${beast.name}! +${xpGained} XP, +${goldGained} guld.${droppedItem ? ` Du hittade "${droppedItem.name}"!` : ''}`
    : `${beast.name} var för mycket den här gången. +${xpGained} XP för försöket.`

  return { result, character: withStats(updated, equippedItems), outcomeText, xpGained, goldGained, droppedItem }
})
