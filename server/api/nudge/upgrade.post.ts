import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'

// Upgrades the caller's anonymous Nudge account to an e-mail + password account (PLAN-4 2.1). The user id stays the same, so the cloud saves follow.
// Done on the server with the admin API so no confirmation mail is needed (the same way /api/auth/register creates accounts).
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Inte inloggad' })
  if (!user.is_anonymous) throw createError({ statusCode: 400, statusMessage: 'Kontot är redan ett riktigt konto' })

  const body = await readBody<{ email?: string, password?: string }>(event)
  const email = body.email?.trim()
  const password = body.password
  if (!email || !password || password.length < 6 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw createError({ statusCode: 400, statusMessage: 'Ogiltig e-post eller lösenord (minst 6 tecken)' })
  }

  const admin = serverSupabaseServiceRole(event)
  const { error } = await admin.auth.admin.updateUserById(user.sub, { email, password, email_confirm: true, user_metadata: { upgraded_from_anonymous: true } })
  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  return { ok: true }
})
