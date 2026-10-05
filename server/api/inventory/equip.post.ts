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

  const { data: item, error: itemError } = await admin
    .from('items')
    .select('*')
    .eq('id', body.itemId)
    .eq('user_id', user.sub)
    .single()

  if (itemError || !item) {
    throw createError({ statusCode: 404, statusMessage: 'Föremålet hittades inte' })
  }

  await admin
    .from('items')
    .update({ equipped: false })
    .eq('user_id', user.sub)
    .eq('slot', item.slot)
    .eq('equipped', true)

  await admin
    .from('items')
    .update({ equipped: true })
    .eq('id', item.id)

  const { data: items } = await admin
    .from('items')
    .select('*')
    .eq('user_id', user.sub)
    .order('created_at', { ascending: false })

  return items
})
