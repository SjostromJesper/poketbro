import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import {
  type Direction,
  TERRAIN_MOVE_COST,
  rollTileEvent,
  stepDirection,
  terrainAt,
} from '#shared/game/worldmap'
import { MAX_ADVENTURE_TIME } from '#shared/game/stamina'
import { applyPassiveRegen } from '#shared/game/regen'
import { simulateGroupBattle } from '#shared/game/groupBattle'
import { generateMonsterEncounter } from '#shared/game/monsters'

const HAZARD_DAMAGE: Record<string, number> = { plains: 2, forest: 4, hills: 5, swamp: 7, mountain: 9, water: 0 }

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Not authenticated' })
  }

  const body = await readBody<{ direction?: Direction }>(event)
  const direction = body.direction
  if (!direction || !['n', 's', 'e', 'w'].includes(direction)) {
    throw createError({ statusCode: 400, statusMessage: 'Ogiltig riktning' })
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
  if (party.status === 'in_event') {
    throw createError({ statusCode: 400, statusMessage: 'Lös det pågående eventet först' })
  }

  const dest = stepDirection(party.x, party.y, direction)
  const terrain = terrainAt(dest.x, dest.y)
  if (terrain === 'water') {
    throw createError({ statusCode: 400, statusMessage: 'Vatten går inte att korsa' })
  }
  const cost = TERRAIN_MOVE_COST[terrain]

  const { data: memberRows } = await admin
    .from('party_members')
    .select('user_id, character_id, characters(*)')
    .eq('party_id', party.id)

  if (!memberRows || memberRows.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Gruppen är tom' })
  }

  const regenByCharacterId = new Map<string, { hp: number, lastRegenAt: number }>()
  const insufficient: string[] = []
  for (const m of memberRows as any[]) {
    const regen = applyPassiveRegen(m.characters.time_remaining, MAX_ADVENTURE_TIME, m.characters.last_time_regen_at)
    regenByCharacterId.set(m.characters.id, regen)
    if (regen.hp < cost) insufficient.push(m.characters.name)
  }
  if (insufficient.length > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: `${insufficient.join(', ')} har inte tillräckligt med tid kvar (kräver ${cost}).`,
    })
  }

  const { data: poi } = await admin.from('world_pois').select('*').eq('x', dest.x).eq('y', dest.y).maybeSingle()

  await Promise.all((memberRows as any[]).map(async (m) => {
    const regen = regenByCharacterId.get(m.characters.id)!
    await admin
      .from('characters')
      .update({ time_remaining: regen.hp - cost, last_time_regen_at: regen.lastRegenAt })
      .eq('id', m.characters.id)
    await admin
      .from('character_discovered_tiles')
      .upsert(
        { character_id: m.characters.id, x: dest.x, y: dest.y, terrain, poi_type: poi?.poi_type ?? null },
        { onConflict: 'character_id,x,y', ignoreDuplicates: true },
      )
  }))

  const wasForming = party.status === 'forming'

  if (poi) {
    await admin
      .from('parties')
      .update({ x: dest.x, y: dest.y, status: 'in_event', pending_event: { type: 'poi', poiId: poi.id, poiType: poi.poi_type, name: poi.name } })
      .eq('id', party.id)
    return { event: { type: 'poi' as const, poiType: poi.poi_type, name: poi.name }, x: dest.x, y: dest.y, terrain }
  }

  const eventType = rollTileEvent(terrain)

  if (eventType === 'nothing') {
    await admin.from('parties').update({ x: dest.x, y: dest.y, status: 'traveling' }).eq('id', party.id)
    return { event: { type: 'nothing' as const }, x: dest.x, y: dest.y, terrain }
  }

  if (eventType === 'minor_find') {
    const goldEach = 5 + Math.floor(Math.random() * 10)
    await Promise.all((memberRows as any[]).map(m =>
      admin.from('characters').update({ gold: m.characters.gold + goldEach }).eq('id', m.characters.id)))
    await admin.from('parties').update({ x: dest.x, y: dest.y, status: 'traveling' }).eq('id', party.id)
    return { event: { type: 'minor_find' as const, goldEach }, x: dest.x, y: dest.y, terrain }
  }

  if (eventType === 'hazard') {
    const dmg = HAZARD_DAMAGE[terrain] ?? 3
    await Promise.all((memberRows as any[]).map(m =>
      admin.from('characters').update({ current_hp: Math.max(1, m.characters.current_hp - dmg) }).eq('id', m.characters.id)))
    await admin.from('parties').update({ x: dest.x, y: dest.y, status: 'traveling' }).eq('id', party.id)
    return { event: { type: 'hazard' as const, damage: dmg }, x: dest.x, y: dest.y, terrain }
  }

  // combat - resolved synchronously, same as challenge.post.ts does for 1v1 duels.
  const avgLevel = Math.round((memberRows as any[]).reduce((sum, m) => sum + m.characters.level, 0) / memberRows.length)
  const monsterCount = 1 + Math.floor(Math.random() * 3)
  const monsters = generateMonsterEncounter(avgLevel, monsterCount)

  const partyResults = await Promise.all((memberRows as any[]).map(m => buildPartyCombatant(admin, m.characters)))
  const battle = simulateGroupBattle(partyResults.map(r => r.combatant), monsters)

  const partyWon = battle.winningSide === 'a'
  const goldPerMember = partyWon ? 10 + avgLevel * 3 : 0

  await Promise.all(partyResults.map((r, i) => {
    const outcome = battle.aOutcomes[i]
    const currentGold = (memberRows as any[])[i].characters.gold
    return admin.from('characters').update({
      current_hp: outcome.finalHp,
      last_regen_at: r.regenLastRegenAt,
      gold: currentGold + goldPerMember,
    }).eq('id', r.characterId)
  }))

  await admin.from('parties').update({ x: dest.x, y: dest.y, status: 'traveling' }).eq('id', party.id)

  return {
    event: { type: 'combat' as const, battle, partyWon, goldPerMember },
    x: dest.x,
    y: dest.y,
    terrain,
    wasForming,
  }
})
