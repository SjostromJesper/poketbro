import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Not authenticated' })
  }

  const admin = serverSupabaseServiceRole(event)

  const { data: membership } = await admin
    .from('party_members')
    .select('party_id')
    .eq('user_id', user.sub)
    .maybeSingle()

  if (!membership) {
    return { left: false }
  }

  const { data: party } = await admin
    .from('parties')
    .select('leader_user_id')
    .eq('id', membership.party_id)
    .single()

  await admin
    .from('party_members')
    .delete()
    .eq('party_id', membership.party_id)
    .eq('user_id', user.sub)

  if (party?.leader_user_id === user.sub) {
    const { data: remaining } = await admin
      .from('party_members')
      .select('user_id')
      .eq('party_id', membership.party_id)
      .order('joined_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (remaining) {
      await admin.from('parties').update({ leader_user_id: remaining.user_id }).eq('id', membership.party_id)
    } else {
      await admin.from('parties').update({ status: 'disbanded' }).eq('id', membership.party_id)
    }
  }

  return { left: true }
})
