// Nudge Edge Function: respond-challenge (PLAN-4 2.4-2.6). Deploy: supabase functions deploy respond-challenge
import { respondChallenge } from '../_shared/nudge/server/handlers.ts'
import { serve } from '../_shared/edge.ts'

Deno.serve(req => serve(req, (ctx, db, body) => respondChallenge(db, ctx, body)))
