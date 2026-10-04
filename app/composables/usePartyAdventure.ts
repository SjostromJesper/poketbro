export interface PartyMember {
  userId: string
  characterId: string
  name: string
  level: number
  isLeader: boolean
}

export interface DiscoveredTile {
  x: number
  y: number
  terrain: string
  poi_type: string | null
}

export interface AdventureParty {
  id: string
  status: 'forming' | 'traveling' | 'in_event' | 'disbanded'
  x: number
  y: number
  pendingEvent: { type: 'poi', poiId: string, poiType: string, name: string } | null
}

export function usePartyAdventure() {
  const inParty = useState('adventureInParty', () => false)
  const party = useState<AdventureParty | null>('adventureParty', () => null)
  const members = useState<PartyMember[]>('adventureMembers', () => [])
  const isLeader = useState('adventureIsLeader', () => false)
  const timeRemaining = useState('adventureTime', () => 0)
  const maxTime = useState('adventureMaxTime', () => 125)
  const discoveredTiles = useState<DiscoveredTile[]>('adventureDiscovered', () => [])
  const loaded = useState('adventureLoaded', () => false)

  async function load() {
    const data: any = await $fetch('/api/parties/status')
    inParty.value = data.inParty
    timeRemaining.value = data.timeRemaining
    maxTime.value = data.maxTime
    if (data.inParty) {
      party.value = data.party
      members.value = data.members
      isLeader.value = data.isLeader
      discoveredTiles.value = data.discoveredTiles
    } else {
      party.value = null
      members.value = []
      isLeader.value = false
      discoveredTiles.value = []
    }
    loaded.value = true
  }

  async function joinOrCreate() {
    await $fetch('/api/parties/create-or-join', { method: 'POST' })
    await load()
  }

  async function move(direction: 'n' | 's' | 'e' | 'w') {
    const result = await $fetch('/api/parties/move', { method: 'POST', body: { direction } })
    await load()
    return result
  }

  async function resolveEvent() {
    await $fetch('/api/parties/resolve-event', { method: 'POST' })
    await load()
  }

  async function leave() {
    await $fetch('/api/parties/leave', { method: 'POST' })
    await load()
  }

  return { inParty, party, members, isLeader, timeRemaining, maxTime, discoveredTiles, loaded, load, joinOrCreate, move, resolveEvent, leave }
}
