import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { RACES, finalStats, randomAllocation, raceById } from '#shared/game/races'
import { simulateBattle } from '#shared/game/battle'
import { tacticById } from '#shared/game/tactics'
import { applyItemBonuses } from '#shared/game/items'
import { resolveSkills } from '#shared/game/skills'

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

  const { data: character, error } = await admin
    .from('characters')
    .select('*')
    .eq('user_id', user.sub)
    .single()

  if (error || !character) {
    throw createError({ statusCode: 404, statusMessage: 'Ingen gladiator hittades' })
  }

  const race = raceById(character.race_id)
  const equippedItems = await fetchEquippedItems(admin, user.sub)
  const gear = resolveEquippedGear(equippedItems)
  const stats = applyItemBonuses(finalStats(race, character.allocated), equippedItems)
  const skills = resolveSkills(character.skill_ids)

  const botRace = RACES[Math.floor(Math.random() * RACES.length)]
  const botPool = 80 + character.level * 25
  const botAllocation = randomAllocation(botPool)
  const botStats = finalStats(botRace, botAllocation)
  const botName = `Testbot (nivå ${character.level})`

  // Sandbox fight: always at full HP, never touches the real character, no XP/loot/history.
  const result = simulateBattle(
    {
      name: character.name,
      stats,
      tactic,
      giveUpPercent,
      skills,
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
    { name: botName, stats: botStats, tactic: tacticById('normal'), giveUpPercent: 0 },
  )

  return { result }
})
