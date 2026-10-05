import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { withStats } from '#shared/game/character'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Not authenticated' })
  }

  const body = await readBody<{ offerId?: string }>(event)
  if (!body.offerId) {
    throw createError({ statusCode: 400, statusMessage: 'Inget erbjudande angivet' })
  }

  const admin = serverSupabaseServiceRole(event)

  const [{ data: offer, error: offerError }, { data: character, error: characterError }] = await Promise.all([
    admin.from('shop_offers').select('*').eq('id', body.offerId).eq('user_id', user.sub).maybeSingle(),
    admin.from('characters').select('*').eq('user_id', user.sub).single(),
  ])

  if (offerError || !offer) {
    throw createError({ statusCode: 404, statusMessage: 'Erbjudandet finns inte längre' })
  }
  if (characterError || !character) {
    throw createError({ statusCode: 404, statusMessage: 'Ingen gladiator hittades' })
  }
  if (character.gold < offer.price) {
    throw createError({ statusCode: 400, statusMessage: 'Du har inte råd med det här' })
  }

  const { data: updatedCharacter, error: updateError } = await admin
    .from('characters')
    .update({ gold: character.gold - offer.price })
    .eq('user_id', user.sub)
    .select()
    .single()

  if (updateError || !updatedCharacter) {
    throw createError({ statusCode: 500, statusMessage: 'Kunde inte genomföra köpet' })
  }

  const { data: newItem, error: itemError } = await admin
    .from('items')
    .insert({
      user_id: user.sub,
      slot: offer.slot,
      name: offer.name,
      quality: offer.quality,
      enchant_level: offer.enchant_level,
      stat_bonuses: offer.stat_bonuses,
      weapon_type: offer.weapon_type,
      extra_attack_chance: offer.extra_attack_chance,
      max_blocks_per_round: offer.max_blocks_per_round,
      min_damage: offer.min_damage,
      max_damage: offer.max_damage,
      recommended_skill: offer.recommended_skill,
      equipped: false,
    })
    .select()
    .single()

  if (itemError) {
    throw createError({ statusCode: 500, statusMessage: itemError.message })
  }

  await admin.from('shop_offers').delete().eq('id', offer.id)

  const equippedItems = await fetchEquippedItems(admin, user.sub)

  return { character: withStats(updatedCharacter, equippedItems), item: newItem }
})
