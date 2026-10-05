import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { BASE_POINT_POOL, STAT_KEYS, WEAPON_SKILL_KEYS, emptyStats, finalStats, raceById, type StatBlock } from '#shared/game/races'
import { maxHealth } from '#shared/game/battle'
import { mostRecentTickBoundary } from '#shared/game/regen'
import { COMMON_SKILLS, emptySkillSlots } from '#shared/game/skills'
import { generateStarterShield, generateStarterWeapon, WEAPON_TYPE_SKILL_KEY, WEAPON_TYPES } from '#shared/game/items'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Not authenticated' })
  }

  const body = await readBody<{ name?: string, raceId?: string, allocated?: Partial<StatBlock>, skillId?: string }>(event)
  const name = body.name?.trim()
  const raceId = body.raceId

  if (!name || name.length < 2 || name.length > 24) {
    throw createError({ statusCode: 400, statusMessage: 'Namnet måste vara 2-24 tecken' })
  }
  if (!raceId) {
    throw createError({ statusCode: 400, statusMessage: 'Ingen ras vald' })
  }
  if (!body.skillId || !COMMON_SKILLS.some(s => s.id === body.skillId)) {
    throw createError({ statusCode: 400, statusMessage: 'Ingen giltig startfärdighet vald' })
  }

  let race
  try {
    race = raceById(raceId)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Okänd ras' })
  }

  const allocated: StatBlock = emptyStats()
  for (const key of STAT_KEYS) {
    const value = Number(body.allocated?.[key])
    if (!Number.isInteger(value) || value < 0) {
      throw createError({ statusCode: 400, statusMessage: 'Ogiltig stat-fördelning' })
    }
    allocated[key] = value
  }

  const spent = STAT_KEYS.reduce((sum, key) => sum + allocated[key], 0)
  if (spent !== BASE_POINT_POOL) {
    throw createError({ statusCode: 400, statusMessage: `Du måste fördela exakt ${BASE_POINT_POOL} poäng` })
  }

  const admin = serverSupabaseServiceRole(event)

  const { data: existing } = await admin
    .from('characters')
    .select('id')
    .eq('user_id', user.sub)
    .maybeSingle()

  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'Du har redan en gladiator' })
  }

  const maxHp = maxHealth(finalStats(race, allocated))

  const skillIds = emptySkillSlots()
  skillIds[0] = body.skillId

  const { data, error } = await admin
    .from('characters')
    .insert({
      user_id: user.sub,
      name,
      race_id: raceId,
      allocated,
      level: 1,
      xp: 0,
      current_hp: maxHp,
      last_regen_at: mostRecentTickBoundary(Date.now()),
      default_tactic_id: 'normal',
      default_give_up_percent: 20,
      skill_ids: skillIds,
    })
    .select()
    .single()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  let bestWeaponKey = WEAPON_SKILL_KEYS[0]
  for (const key of WEAPON_SKILL_KEYS) {
    if (allocated[key] > allocated[bestWeaponKey]) bestWeaponKey = key
  }
  const weaponType = WEAPON_TYPES.find(t => WEAPON_TYPE_SKILL_KEY[t] === bestWeaponKey)!
  const starterWeapon = generateStarterWeapon(weaponType)

  const starterItems = [{
    user_id: user.sub,
    slot: starterWeapon.slot,
    name: starterWeapon.name,
    quality: starterWeapon.quality,
    enchant_level: starterWeapon.enchantLevel,
    stat_bonuses: starterWeapon.statBonuses,
    weapon_type: starterWeapon.weaponType,
    extra_attack_chance: starterWeapon.extraAttackChance,
    max_blocks_per_round: starterWeapon.maxBlocksPerRound ?? 1,
    min_damage: starterWeapon.minDamage,
    max_damage: starterWeapon.maxDamage,
    recommended_skill: starterWeapon.recommendedSkill,
    absorption: starterWeapon.absorption,
    min_absorption: starterWeapon.minAbsorption,
    break_threshold: starterWeapon.breakThreshold,
    equipped: true,
  }]

  if (allocated.shieldSkill > 0) {
    const starterShield = generateStarterShield()
    starterItems.push({
      user_id: user.sub,
      slot: starterShield.slot,
      name: starterShield.name,
      quality: starterShield.quality,
      enchant_level: starterShield.enchantLevel,
      stat_bonuses: starterShield.statBonuses,
      weapon_type: starterShield.weaponType,
      extra_attack_chance: starterShield.extraAttackChance,
      max_blocks_per_round: starterShield.maxBlocksPerRound ?? 1,
      min_damage: starterShield.minDamage,
      max_damage: starterShield.maxDamage,
      recommended_skill: starterShield.recommendedSkill,
      absorption: starterShield.absorption,
      min_absorption: starterShield.minAbsorption,
      break_threshold: starterShield.breakThreshold,
      equipped: true,
    })
  }

  await admin.from('items').insert(starterItems)

  return data
})
