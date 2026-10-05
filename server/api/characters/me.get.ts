import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { withStats } from '#shared/game/character'
import { applyPassiveRegen } from '#shared/game/regen'
import { MAX_ADVENTURE_TIME } from '#shared/game/stamina'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Not authenticated' })
  }

  const admin = serverSupabaseServiceRole(event)

  const { data: character, error } = await admin
    .from('characters')
    .select('*')
    .eq('user_id', user.sub)
    .maybeSingle()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }
  if (!character) {
    return null
  }

  const equippedItems = await fetchEquippedItems(admin, user.sub)
  const withComputed = withStats(character, equippedItems)

  const cappedHp = Math.min(character.current_hp, withComputed.maxHp)
  const regen = applyPassiveRegen(cappedHp, withComputed.maxHp, character.last_regen_at)
  const timeRegen = applyPassiveRegen(character.time_remaining, MAX_ADVENTURE_TIME, character.last_time_regen_at)

  if (regen.hp !== character.current_hp || regen.lastRegenAt !== character.last_regen_at
    || timeRegen.hp !== character.time_remaining || timeRegen.lastRegenAt !== character.last_time_regen_at) {
    await admin
      .from('characters')
      .update({
        current_hp: regen.hp,
        last_regen_at: regen.lastRegenAt,
        time_remaining: timeRegen.hp,
        last_time_regen_at: timeRegen.lastRegenAt,
      })
      .eq('user_id', user.sub)
    character.current_hp = regen.hp
    character.last_regen_at = regen.lastRegenAt
    character.time_remaining = timeRegen.hp
    character.last_time_regen_at = timeRegen.lastRegenAt
  }

  return withStats(character, equippedItems)
})
