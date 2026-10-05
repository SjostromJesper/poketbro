import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Not authenticated' })
  }

  const admin = serverSupabaseServiceRole(event)

  const { data, error } = await admin
    .from('characters')
    .select('user_id, name, race_id, level')
    .neq('user_id', user.sub)
    .order('name')

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return data
})
