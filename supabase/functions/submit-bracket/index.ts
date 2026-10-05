// Nudge Edge Function: submit-bracket (PLAN-4 2.4-2.6). Deploy: supabase functions deploy submit-bracket
import { submitBracket } from '../_shared/nudge/server/handlers.ts'
import { serve } from '../_shared/edge.ts'

Deno.serve(req => serve(req, (ctx, db, body) => submitBracket(db, ctx, body)))
