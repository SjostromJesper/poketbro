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

  const { data: me, error: meError } = await admin
    .from('characters')
    .select('*')
    .eq('user_id', user.sub)
    .single()

  if (meError || !me) {
    throw createError({ statusCode: 404, statusMessage: 'Ingen gladiator hittades' })
  }
  if (me.level < MAX_LEVEL) {
    throw createError({ statusCode: 400, statusMessage: 'Du måste vara examinerad (nivå 4) för att köa' })
  }

  const meTimeRegen = applyPassiveRegen(me.time_remaining, MAX_ADVENTURE_TIME, me.last_time_regen_at)
  if (meTimeRegen.hp < 5) {
    throw createError({ statusCode: 400, statusMessage: 'Du är för trött för att slåss (kräver minst 5 tid, fylls på över tid).' })
  }

  // 1. Was I just matched by someone else's poll while I was queued?
  const { data: pendingMatch } = await admin
    .from('matches')
    .select('*')
    .eq('player_b_user_id', user.sub)
    .eq('acknowledged_b', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (pendingMatch) {
    await admin.from('matches').update({ acknowledged_b: true }).eq('id', pendingMatch.id)
    const { data: freshMe } = await admin.from('characters').select('*').eq('user_id', user.sub).single()
    const myEquipped = await fetchEquippedItems(admin, user.sub)
    return {
      status: 'matched' as const,
      character: withStats(freshMe, myEquipped),
      result: {
        winnerName: pendingMatch.winner_name,
        loserName: pendingMatch.loser_name,
        reason: pendingMatch.reason,
        rounds: pendingMatch.rounds,
        log: pendingMatch.log,
      },
    }
  }

  // 2. Try to find (or join) an opponent in the queue.
  const { data: matchRows, error: matchError } = await admin.rpc('match_queue', {
    p_user_id: user.sub,
    p_character_id: me.id,
    p_level: me.level,
    p_tactic_id: tacticId,
    p_give_up: giveUpPercent,
  })

  if (matchError) {
    throw createError({ statusCode: 500, statusMessage: matchError.message })
  }

  const opponentRow = matchRows?.[0]
  if (!opponentRow) {
    return { status: 'waiting' as const }
  }

  const { data: opponent, error: opponentError } = await admin
    .from('characters')
    .select('*')
    .eq('user_id', opponentRow.opponent_user_id)
    .single()

  if (opponentError || !opponent) {
    throw createError({ statusCode: 500, statusMessage: 'Kunde inte hämta motståndaren' })
  }

  const [meEquipped, oppEquipped] = await Promise.all([
    fetchEquippedItems(admin, user.sub),
    fetchEquippedItems(admin, opponent.user_id),
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
  const oppTimeRegen = applyPassiveRegen(opponent.time_remaining, MAX_ADVENTURE_TIME, opponent.last_time_regen_at)

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
      tactic: tacticById(opponentRow.opponent_tactic_id),
      giveUpPercent: opponentRow.opponent_give_up,
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
    }).eq('user_id', opponent.user_id),
  ])

  await admin.from('matches').insert({
    kind: 'queue',
    player_a_user_id: user.sub,
    player_a_name: me.name,
    player_b_user_id: opponent.user_id,
    player_b_name: opponent.name,
    winner_name: result.winnerName,
    loser_name: result.loserName,
    reason: result.reason,
    rounds: result.rounds,
    log: result.log,
    acknowledged_a: true,
    acknowledged_b: false,
  })

  const winnerUserId = iWon ? user.sub : opponent.user_id
  const winnerLevel = iWon ? me.level : opponent.level
  const droppedItem = await maybeGrantLoot(admin, winnerUserId, winnerLevel)

  return {
    status: 'matched' as const,
    character: withStats(updatedMe, meEquipped),
    result,
    droppedItem: iWon ? droppedItem : null,
    goldGained: meGoldGained,
  }
})
