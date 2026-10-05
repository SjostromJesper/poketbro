// Nudge Edge Function: send-challenge (PLAN-4 2.4-2.6). Deploy: supabase functions deploy send-challenge
import { sendChallenge } from '../_shared/nudge/server/handlers.ts'
import { serve } from '../_shared/edge.ts'

Deno.serve(req => serve(req, (ctx, db, body) => sendChallenge(db, ctx, body)))
