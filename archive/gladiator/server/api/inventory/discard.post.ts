import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'

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

  await admin
    .from('items')
    .delete()
    .eq('id', body.itemId)
    .eq('user_id', user.sub)

  const { data: items } = await admin
    .from('items')
    .select('*')
    .eq('user_id', user.sub)
    .order('created_at', { ascending: false })

  return items
})
