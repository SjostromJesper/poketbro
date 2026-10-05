import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { sellPriceFor } from '#shared/game/shop'
import { withStats } from '#shared/game/character'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Not authenticated' })
  }

  const body = await readBody<{ itemId?: string }>(event)
  if (!body.itemId) {
    throw createError({ statusCode: 400, statusMessage: 'Inget föremål angivet' })
  }

  const admin = serverSupabaseServiceRole(event)

  const [{ data: item, error: itemError }, { data: character, error: characterError }] = await Promise.all([
    admin.from('items').select('*').eq('id', body.itemId).eq('user_id', user.sub).maybeSingle(),
    admin.from('characters').select('*').eq('user_id', user.sub).single(),
  ])

  if (itemError || !item) {
    throw createError({ statusCode: 404, statusMessage: 'Föremålet hittades inte' })
  }
  if (characterError || !character) {
    throw createError({ statusCode: 404, statusMessage: 'Ingen gladiator hittades' })
  }

  const price = sellPriceFor({
    quality: item.quality,
    enchantLevel: item.enchant_level,
    statBonuses: item.stat_bonuses,
    extraAttackChance: item.extra_attack_chance,
    maxBlocksPerRound: item.max_blocks_per_round,
    minDamage: item.min_damage,
    maxDamage: item.max_damage,
  })

  await admin.from('items').delete().eq('id', item.id)

  const { data: updatedCharacter, error: updateError } = await admin
    .from('characters')
    .update({ gold: character.gold + price })
    .eq('user_id', user.sub)
    .select()
    .single()

  if (updateError || !updatedCharacter) {
    throw createError({ statusCode: 500, statusMessage: 'Kunde inte slutföra försäljningen' })
  }

  const equippedItems = await fetchEquippedItems(admin, user.sub)

  return { character: withStats(updatedCharacter, equippedItems), goldGained: price }
})
