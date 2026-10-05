import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'

/**
 * Closes out a pending POI event and returns the party to traveling. Real
 * per-POI content (cave loot, ruin puzzles, town/village events) is milestone C -
 * for now this just acknowledges "you looked at it" so the movement loop works
 * end to end without a POI trip permanently stalling the party.
 */
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
    throw createError({ statusCode: 404, statusMessage: 'Du är inte med i någon grupp' })
  }

  const { data: party } = await admin.from('parties').select('*').eq('id', membership.party_id).single()

  if (!party || party.status === 'disbanded') {
    throw createError({ statusCode: 400, statusMessage: 'Gruppen finns inte längre' })
  }
  if (party.leader_user_id !== user.sub) {
    throw createError({ statusCode: 403, statusMessage: 'Bara ledaren kan styra gruppen' })
  }
  if (party.status !== 'in_event') {
    return { resolved: false }
  }

  await admin.from('parties').update({ status: 'traveling', pending_event: null }).eq('id', party.id)
  return { resolved: true }
})
