import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { terrainAt } from '#shared/game/worldmap'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Not authenticated' })
  }

  const admin = serverSupabaseServiceRole(event)

  const { data: character, error: characterError } = await admin
    .from('characters')
    .select('id')
    .eq('user_id', user.sub)
    .single()

  if (characterError || !character) {
    throw createError({ statusCode: 404, statusMessage: 'Ingen gladiator hittades' })
  }

  const { data, error } = await admin.rpc('join_or_create_party', {
    p_user_id: user.sub,
    p_character_id: character.id,
  })

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const row = data?.[0]
  if (!row) {
    throw createError({ statusCode: 500, statusMessage: 'Kunde inte gå med i en grupp' })
  }

  // Mark wherever the party currently stands as discovered for the new member,
  // so they're not looking at a "?" on the one tile they're actually standing on.
  const { data: party } = await admin.from('parties').select('x, y').eq('id', row.out_party_id).single()
  if (party) {
    const { data: poi } = await admin.from('world_pois').select('poi_type').eq('x', party.x).eq('y', party.y).maybeSingle()
    await admin
      .from('character_discovered_tiles')
      .upsert(
        { character_id: character.id, x: party.x, y: party.y, terrain: terrainAt(party.x, party.y), poi_type: poi?.poi_type ?? null },
        { onConflict: 'character_id,x,y', ignoreDuplicates: true },
      )
  }

  return { partyId: row.out_party_id, isNew: row.out_is_new }
})
