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
import { WIN_GOLD } from '#shared/game/shop'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Not authenticated' })
  }

  const body = await readBody<{ targetUserId?: string, tacticId?: string, giveUpPercent?: number }>(event)
  const targetUserId = body.targetUserId
  const tacticId = body.tacticId ?? 'normal'
  const giveUpPercent = Math.min(90, Math.max(0, Number(body.giveUpPercent ?? 20)))

  if (!targetUserId || targetUserId === user.sub) {
    throw createError({ statusCode: 400, statusMessage: 'Ogiltig motståndare' })
  }

  let tactic
  try {
    tactic = tacticById(tacticId)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Okänd taktik' })
  }

  const admin = serverSupabaseServiceRole(event)

  const [{ data: me, error: meError }, { data: opponent, error: opponentError }] = await Promise.all([
    admin.from('characters').select('*').eq('user_id', user.sub).single(),
    admin.from('characters').select('*').eq('user_id', targetUserId).single(),
  ])

  if (meError || !me) {
    throw createError({ statusCode: 404, statusMessage: 'Ingen gladiator hittades' })
  }
  if (opponentError || !opponent) {
    throw createError({ statusCode: 404, statusMessage: 'Motståndaren hittades inte' })
  }
  if (me.level < MAX_LEVEL) {
    throw createError({ statusCode: 400, statusMessage: 'Du måste vara examinerad (nivå 4) för att utmana andra spelare' })
  }

  const meTimeRegen = applyPassiveRegen(me.time_remaining, MAX_ADVENTURE_TIME, me.last_time_regen_at)
  if (meTimeRegen.hp < 5) {
    throw createError({ statusCode: 400, statusMessage: 'Du är för trött för att slåss (kräver minst 5 tid, fylls på över tid).' })
  }
  const oppTimeRegen = applyPassiveRegen(opponent.time_remaining, MAX_ADVENTURE_TIME, opponent.last_time_regen_at)

  const [meEquipped, oppEquipped] = await Promise.all([
    fetchEquippedItems(admin, user.sub),
    fetchEquippedItems(admin, targetUserId),
  ])
  const meGear = resolveEquippedGear(meEquipped)
  const oppGear = resolveEquippedGear(oppEquipped)

  const meRace = raceById(me.race_id)
  const meStats = applyItemBonuses(finalStats(meRace, me.allocated), meEquipped)
  const meMaxHp = maxHealth(meStats)
  const meRegen = applyPassiveRegen(me.current_hp, meMaxHp, me.last_regen_at)

  const oppRace = raceById(opponent.race_id)
  const oppStats = applyItemBonuses(finalStats(oppRace, opponent.allocated), oppEquipped)
  const oppMaxHp = maxHealth(oppStats)
  const oppRegen = applyPassiveRegen(opponent.current_hp, oppMaxHp, opponent.last_regen_at)

  const result = simulateBattle(
    {
      name: me.name,
      stats: meStats,
      tactic,
      giveUpPercent,
      startingHp: meRegen.hp,
      skills: resolveSkills(me.skill_ids),
      weaponType: meGear.weaponType,
      weaponExtraAttackChance: meGear.weaponExtraAttackChance,
      weaponMinDamage: meGear.weaponMinDamage,
      weaponMaxDamage: meGear.weaponMaxDamage,
      weaponRecommendedSkill: meGear.weaponRecommendedSkill,
      hasShield: meGear.hasShield,
      shieldMaxBlocksPerRound: meGear.shieldMaxBlocksPerRound,
      shieldAbsorption: meGear.shieldAbsorption,
      shieldMinAbsorption: meGear.shieldMinAbsorption,
      shieldRecommendedSkill: meGear.shieldRecommendedSkill,
      weaponBreakThreshold: meGear.weaponBreakThreshold,
      shieldBreakThreshold: meGear.shieldBreakThreshold,
      offWeaponBreakThreshold: meGear.offWeaponBreakThreshold,
      offWeaponType: meGear.offWeaponType,
      offWeaponExtraAttackChance: meGear.offWeaponExtraAttackChance,
      offWeaponMinDamage: meGear.offWeaponMinDamage,
      offWeaponMaxDamage: meGear.offWeaponMaxDamage,
      offWeaponRecommendedSkill: meGear.offWeaponRecommendedSkill,
    },
    {
      name: opponent.name,
      stats: oppStats,
      tactic: tacticById(opponent.default_tactic_id),
      giveUpPercent: opponent.default_give_up_percent,
      startingHp: oppRegen.hp,
      skills: resolveSkills(opponent.skill_ids),
      weaponType: oppGear.weaponType,
      weaponExtraAttackChance: oppGear.weaponExtraAttackChance,
      weaponMinDamage: oppGear.weaponMinDamage,
      weaponMaxDamage: oppGear.weaponMaxDamage,
      weaponRecommendedSkill: oppGear.weaponRecommendedSkill,
      hasShield: oppGear.hasShield,
      shieldMaxBlocksPerRound: oppGear.shieldMaxBlocksPerRound,
      shieldAbsorption: oppGear.shieldAbsorption,
      shieldMinAbsorption: oppGear.shieldMinAbsorption,
      shieldRecommendedSkill: oppGear.shieldRecommendedSkill,
      weaponBreakThreshold: oppGear.weaponBreakThreshold,
      shieldBreakThreshold: oppGear.shieldBreakThreshold,
      offWeaponBreakThreshold: oppGear.offWeaponBreakThreshold,
      offWeaponType: oppGear.offWeaponType,
      offWeaponExtraAttackChance: oppGear.offWeaponExtraAttackChance,
      offWeaponMinDamage: oppGear.offWeaponMinDamage,
      offWeaponMaxDamage: oppGear.offWeaponMaxDamage,
      offWeaponRecommendedSkill: oppGear.offWeaponRecommendedSkill,
    },
  )

  const iWon = result.winnerName === me.name
  const meGoldGained = iWon ? WIN_GOLD : 0
  const oppGoldGained = iWon ? 0 : WIN_GOLD
  const timeCost = timeCostForBattle(result.rounds)

  const [{ data: updatedMe }] = await Promise.all([
    admin.from('characters').update({
      current_hp: result.aFinalHp,
      last_regen_at: meRegen.lastRegenAt,
      time_remaining: Math.max(0, meTimeRegen.hp - timeCost),
      last_time_regen_at: meTimeRegen.lastRegenAt,
      default_tactic_id: tacticId,
      default_give_up_percent: giveUpPercent,
      gold: me.gold + meGoldGained,
    }).eq('user_id', user.sub).select().single(),
    admin.from('characters').update({
      current_hp: result.bFinalHp,
      last_regen_at: oppRegen.lastRegenAt,
      time_remaining: Math.max(0, oppTimeRegen.hp - timeCost),
      last_time_regen_at: oppTimeRegen.lastRegenAt,
      gold: opponent.gold + oppGoldGained,
    }).eq('user_id', targetUserId),
  ])

  await admin.from('matches').insert({
    kind: 'challenge',
    player_a_user_id: user.sub,
    player_a_name: me.name,
    player_b_user_id: targetUserId,
    player_b_name: opponent.name,
    winner_name: result.winnerName,
    loser_name: result.loserName,
    reason: result.reason,
    rounds: result.rounds,
    log: result.log,
    acknowledged_a: true,
    acknowledged_b: true,
  })

  const winnerUserId = iWon ? user.sub : targetUserId
  const winnerLevel = iWon ? me.level : opponent.level
  const droppedItem = await maybeGrantLoot(admin, winnerUserId, winnerLevel)

  return {
    result,
    character: withStats(updatedMe, meEquipped),
    droppedItem: iWon ? droppedItem : null,
    goldGained: meGoldGained,
  }
})
