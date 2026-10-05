import { serverSupabaseServiceRole } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: string, password?: string }>(event)
  const email = body.email?.trim()
  const password = body.password

  if (!email || !password || password.length < 6) {
    throw createError({ statusCode: 400, statusMessage: 'Ogiltig e-post eller lösenord (minst 6 tecken)' })
  }

  const admin = serverSupabaseServiceRole(event)

  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (error) {
    throw createError({ statusCode: 400, statusMessage: error.message })
  }

  return { ok: true }
})
