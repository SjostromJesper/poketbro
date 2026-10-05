import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Not authenticated' })
  }

  const admin = serverSupabaseServiceRole(event)

  const { data, error } = await admin
    .from('matches')
    .select('*')
    .or(`player_a_user_id.eq.${user.sub},player_b_user_id.eq.${user.sub}`)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return data.map(m => ({
    id: m.id,
    kind: m.kind,
    playedAt: m.created_at,
    opponentName: m.player_a_user_id === user.sub ? m.player_b_name : m.player_a_name,
    won: m.winner_name === (m.player_a_user_id === user.sub ? m.player_a_name : m.player_b_name),
    winnerName: m.winner_name,
    loserName: m.loser_name,
    reason: m.reason,
    rounds: m.rounds,
    log: m.log,
  }))
})
