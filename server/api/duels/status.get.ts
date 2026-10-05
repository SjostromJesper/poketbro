import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Not authenticated' })
  }

  const admin = serverSupabaseServiceRole(event)
  const { data } = await admin
    .from('duel_queue')
    .select('tactic_id, give_up_percent')
    .eq('user_id', user.sub)
    .maybeSingle()

  if (!data) {
    return { inQueue: false as const }
  }

  return { inQueue: true as const, tacticId: data.tactic_id, giveUpPercent: data.give_up_percent }
})
