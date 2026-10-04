import type { MapDef } from '../types'
import { gruss } from './gruss'
import { grussCenter } from './grussCenter'
import { grussGym } from './grussGym'
import { grussMart } from './grussMart'
import { hemhus } from './hemhus'
import { hemstad } from './hemstad'
import { proflab } from './proflab'
import { route1 } from './route1'
import { skogen } from './skogen'

export const MAPS: Record<string, MapDef> = Object.fromEntries(
  [hemstad, hemhus, proflab, route1, skogen, gruss, grussCenter, grussMart, grussGym].map(map => [map.id, map]),
)

export function getMap(id: string): MapDef {
  const map = MAPS[id]
  if (!map) throw new Error(`Unknown map "${id}"`)
  return map
}

export const START_MAP = { mapId: 'hemstad', x: 3, y: 5 }
