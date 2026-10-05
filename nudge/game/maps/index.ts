import type { MapDef } from '../types'
import { grussMaps } from './gruss'
import { hamnMaps } from './hamn'
import { gnistbyMaps } from './gnistby'
import { hemstadMaps } from './hemstad'
import { kraftverketMaps } from './kraftverket'
import { manbergetMaps } from './manberget'
import { blomstadMaps } from './blomstad'
import { route2 } from './route2'
import { route3 } from './route3'
import { route4 } from './route4'
import { route5 } from './route5'
import { route6 } from './route6'
import { spoktornetMaps } from './spoktornet'
import { vildmarken } from './vildmarken'
import { route1 } from './route1'
import { skogen } from './skogen'

export const MAPS: Record<string, MapDef> = Object.fromEntries(
  [...hemstadMaps, route1, skogen, ...grussMaps, route2, ...manbergetMaps, route3, ...hamnMaps,
    route4, ...kraftverketMaps, ...gnistbyMaps, route5, ...spoktornetMaps, route6, ...blomstadMaps, vildmarken].map(map => [map.id, map]),
)

export function getMap(id: string): MapDef {
  const map = MAPS[id]
  if (!map) throw new Error(`Unknown map "${id}"`)
  return map
}

export const START_MAP = { mapId: 'hemstad', x: 14, y: 12 }
