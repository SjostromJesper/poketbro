import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { applyPassiveRegen } from '#shared/game/regen'
import { MAX_ADVENTURE_TIME } from '#shared/game/stamina'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Not authenticated' })
  }

  const admin = serverSupabaseServiceRole(event)

  const { data: character, error: characterError } = await admin
    .from('characters')
    .select('id, time_remaining, last_time_regen_at')
    .eq('user_id', user.sub)
    .single()

  if (characterError || !character) {
    throw createError({ statusCode: 404, statusMessage: 'Ingen gladiator hittades' })
  }

  const regen = applyPassiveRegen(character.time_remaining, MAX_ADVENTURE_TIME, character.last_time_regen_at)
  if (regen.hp !== character.time_remaining) {
    await admin
      .from('characters')
      .update({ time_remaining: regen.hp, last_time_regen_at: regen.lastRegenAt })
      .eq('user_id', user.sub)
  }

  const { data: membership } = await admin
    .from('party_members')
    .select('party_id')
    .eq('user_id', user.sub)
    .maybeSingle()

  if (!membership) {
    return { inParty: false as const, timeRemaining: regen.hp, maxTime: MAX_ADVENTURE_TIME }
  }

  const [{ data: party }, { data: memberRows }, { data: discovered }] = await Promise.all([
    admin.from('parties').select('*').eq('id', membership.party_id).single(),
    admin
      .from('party_members')
      .select('user_id, character_id, characters(name, level)')
      .eq('party_id', membership.party_id),
    admin
      .from('character_discovered_tiles')
      .select('x, y, terrain, poi_type')
      .eq('character_id', character.id),
  ])

  if (!party || party.status === 'disbanded') {
    return { inParty: false as const, timeRemaining: regen.hp, maxTime: MAX_ADVENTURE_TIME }
  }

  const members = (memberRows ?? []).map((m: any) => ({
    userId: m.user_id,
    characterId: m.character_id,
    name: m.characters?.name ?? '???',
    level: m.characters?.level ?? 1,
    isLeader: m.user_id === party.leader_user_id,
  }))

  return {
    inParty: true as const,
    party: { id: party.id, status: party.status, x: party.x, y: party.y, pendingEvent: party.pending_event },
    members,
    isLeader: party.leader_user_id === user.sub,
    timeRemaining: regen.hp,
    maxTime: MAX_ADVENTURE_TIME,
    discoveredTiles: discovered ?? [],
  }
})
