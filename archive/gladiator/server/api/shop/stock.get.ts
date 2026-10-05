import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { generateShopStock } from '#shared/game/shop'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Not authenticated' })
  }

  const admin = serverSupabaseServiceRole(event)

  const { data: character, error } = await admin
    .from('characters')
    .select('level')
    .eq('user_id', user.sub)
    .single()

  if (error || !character) {
    throw createError({ statusCode: 404, statusMessage: 'Ingen gladiator hittades' })
  }

  await admin.from('shop_offers').delete().eq('user_id', user.sub)

  const offers = generateShopStock(character.level)
  const rows = offers.map(({ item, price }) => ({
    user_id: user.sub,
    slot: item.slot,
    name: item.name,
    quality: item.quality,
    enchant_level: item.enchantLevel,
    stat_bonuses: item.statBonuses,
    weapon_type: item.weaponType,
    extra_attack_chance: item.extraAttackChance,
    max_blocks_per_round: item.maxBlocksPerRound ?? 1,
    min_damage: item.minDamage,
    max_damage: item.maxDamage,
    recommended_skill: item.recommendedSkill,
    price,
  }))

  const { data: inserted, error: insertError } = await admin
    .from('shop_offers')
    .insert(rows)
    .select()

  if (insertError) {
    throw createError({ statusCode: 500, statusMessage: insertError.message })
  }

  return inserted
})
