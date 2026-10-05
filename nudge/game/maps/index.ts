import type { MapDef } from '../types'
import { grussMaps } from './gruss'
import { hamnMaps } from './hamn'
import { hemstadMaps } from './hemstad'
import { manbergetMaps } from './manberget'
import { route2 } from './route2'
import { route3 } from './route3'
import { route1 } from './route1'
import { skogen } from './skogen'

export const MAPS: Record<string, MapDef> = Object.fromEntries(
  [...hemstadMaps, route1, skogen, ...grussMaps, route2, ...manbergetMaps, route3, ...hamnMaps].map(map => [map.id, map]),
)

export function getMap(id: string): MapDef {
  const map = MAPS[id]
  if (!map) throw new Error(`Unknown map "${id}"`)
  return map
}

export const START_MAP = { mapId: 'hemstad', x: 14, y: 12 }
