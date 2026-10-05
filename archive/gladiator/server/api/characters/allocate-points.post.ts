import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { STAT_KEYS, type StatBlock } from '#shared/game/races'
import { withStats } from '#shared/game/character'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Not authenticated' })
  }

  const body = await readBody<{ allocated?: Partial<Record<keyof StatBlock, number>> }>(event)

  const admin = serverSupabaseServiceRole(event)

  const { data: character, error } = await admin
    .from('characters')
    .select('*')
    .eq('user_id', user.sub)
    .single()

  if (error || !character) {
    throw createError({ statusCode: 404, statusMessage: 'Ingen gladiator hittades' })
  }

  const spend: Partial<StatBlock> = {}
  let total = 0
  for (const key of STAT_KEYS) {
    const value = Number(body.allocated?.[key] ?? 0)
    if (!Number.isInteger(value) || value < 0) {
      throw createError({ statusCode: 400, statusMessage: 'Ogiltig fördelning' })
    }
    spend[key] = value
    total += value
  }

  if (total === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Du måste fördela minst 1 poäng' })
  }
  if (total > character.unspent_points) {
    throw createError({ statusCode: 400, statusMessage: `Du har bara ${character.unspent_points} olevlade poäng` })
  }

  const newAllocated: StatBlock = { ...character.allocated }
  for (const key of STAT_KEYS) {
    newAllocated[key] = (newAllocated[key] ?? 0) + (spend[key] ?? 0)
  }

  const { data: updated, error: updateError } = await admin
    .from('characters')
    .update({
      allocated: newAllocated,
      unspent_points: character.unspent_points - total,
    })
    .eq('user_id', user.sub)
    .select()
    .single()

  if (updateError || !updated) {
    throw createError({ statusCode: 500, statusMessage: 'Kunde inte spara fördelningen' })
  }

  const equippedItems = await fetchEquippedItems(admin, user.sub)
  return withStats(updated, equippedItems)
})
