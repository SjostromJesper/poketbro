// The Supabase side of the cloud saves: `save_slots` rows, read and written through the signed-in user's session and the RLS policies.
// Only the anon key is ever in the browser (the module reads it from the environment).
import type { CloudSaves, CloudSlot, Slot } from '~~/nudge/game/saveSlots'
import type { SaveSummary } from '~~/nudge/game/save'

/** The part of the Supabase client we use (loosely typed: the generated database types do not know this table). */
interface Client {
  from: (table: string) => any
  auth: any
}

interface Row {
  slot: Slot
  save_version: number
  summary: SaveSummary
  updated_at: string
  data?: unknown
}

const toCloud = (row: Row): CloudSlot => ({ slot: row.slot, saveVersion: row.save_version, summary: row.summary, updatedAt: row.updated_at, data: row.data })

export function createSupabaseCloud(client: Client): CloudSaves {
  const table = () => client.from('save_slots')
  const userId = async (): Promise<string | null> => {
    const { data } = await client.auth.getSession()
    return data?.session?.user?.id ?? null
  }

  return {
    async available() {
      if (!(await userId())) return false
      const { error } = await table().select('slot').limit(1)
      return !error
    },
    async list() {
      const { data, error } = await table().select('slot, save_version, summary, updated_at')
      if (error) throw new Error(error.message)
      return ((data ?? []) as Row[]).map(toCloud)
    },
    async fetch(slot) {
      const { data, error } = await table().select('slot, save_version, summary, updated_at, data').eq('slot', slot).maybeSingle()
      if (error) throw new Error(error.message)
      return data ? toCloud(data as Row) : null
    },
    async upsert(slot, saveVersion, data, summary) {
      const id = await userId()
      if (!id) throw new Error('Inte inloggad')
      const { data: row, error } = await table()
        .upsert({ user_id: id, slot, save_version: saveVersion, data, summary }, { onConflict: 'user_id,slot' })
        .select('updated_at')
        .single()
      if (error) throw new Error(error.message)
      return (row as { updated_at: string }).updated_at
    },
    async remove(slot) {
      const { error } = await table().delete().eq('slot', slot)
      if (error) throw new Error(error.message)
    },
  }
}
