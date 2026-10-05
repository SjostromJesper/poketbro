// Prints a map as text with its entities drawn on top: N = NPC, T = trainer, > = warp, i = item, ? = hidden item. `npm run dump-map -- route2`.
import { MAPS } from '../game/maps'

const id = process.argv[2]
const map = MAPS[id]
if (!map) {
  console.log(`Unknown map "${id}". Maps: ${Object.keys(MAPS).join(', ')}`)
  process.exit(1)
}
const rows = map.tiles.map(r => r.split(''))
const put = (x: number, y: number, c: string) => {
  if (rows[y]?.[x] !== undefined) rows[y][x] = c
}
for (const w of map.warps) put(w.x, w.y, '>')
for (const n of map.npcs) put(n.x, n.y, 'N')
for (const t of map.trainers) put(t.x, t.y, 'T')
for (const p of map.pickups ?? []) put(p.x, p.y, p.hidden ? '?' : 'i')
console.log(`${map.id} "${map.name}" ${map.tiles[0].length}x${map.tiles.length}`)
const header = '   ' + [...rows[0]].map((_, i) => (i % 10 === 0 ? String((i / 10) % 10) : ' ')).join('')
console.log(header)
rows.forEach((r, y) => console.log(`${String(y).padStart(2)} ${r.join('')}`))
console.log('\nWarps:', map.warps.map(w => `(${w.x},${w.y})->${w.to}@${w.toX},${w.toY}`).join('  '))
