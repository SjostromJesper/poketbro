import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BALANCE } from '../engine/balance'
import { simulatePvp } from '../server/autopilot'
import { snapshotOf } from '../server/snapshot'
import { buildSharedFiles, SHARED_DIR, toDeno } from '../scripts/sync-functions'
import { data, mon } from './helpers'

describe('the code shared with the Edge Functions', () => {
  it('is up to date: supabase/functions/_shared/nudge is what `npm run sync-functions` produces', () => {
    for (const [rel, content] of buildSharedFiles()) {
      const file = join(SHARED_DIR, rel)
      expect(existsSync(file), `${rel} is missing, run npm run sync-functions`).toBe(true)
      expect(readFileSync(file, 'utf8') === content, `${rel} is out of date, run npm run sync-functions`).toBe(true)
    }
  })

  it('rewrites imports the way Deno needs them', () => {
    expect(toDeno("import { a } from './x'\nimport type { B } from '../y/z'\nexport * from './types'\n")).toBe("import { a } from './x.ts'\nimport type { B } from '../y/z.ts'\nexport * from './types.ts'\n")
    expect(toDeno("import j from './pokemon.json'")).toBe("import j from './pokemon.json' with { type: 'json' }")
    expect(toDeno("import x from 'npm:pkg'")).toBe("import x from 'npm:pkg'")
  })

  it('has no Node or browser dependencies in the shared code', () => {
    for (const [rel, content] of buildSharedFiles()) {
      if (rel.endsWith('.json')) continue
      // Only code counts, not the words in comments.
      const code = content.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).map(l => l.replace(/\s\/\/.*$/, '')).join('\n')
      expect(code, rel).not.toMatch(/from 'node:|require\(|\bwindow\b|\bdocument\b|\blocalStorage\b|process\.env/)
      expect(code, rel).not.toMatch(/from '(vue|pinia|#|~|@)/)
    }
  })

  it('gives the same match result when run as plain modules outside the build tools (the way the Edge Functions run it)', () => {
    const team = (names: string[], lv: number) => names.map((n, i) => ({ ...snapshotOf(mon(n, lv)), uid: `${n}${i}` }))
    const input = { teamA: team(['charizard', 'blastoise', 'venusaur'], 33), teamB: team(['gengar', 'alakazam', 'machamp'], 33), seed: 424242 }
    const local = simulatePvp({ data, balance: BALANCE, ...input })
    const dir = mkdtempSync(join(tmpdir(), 'nudge-shared-'))
    const script = join(dir, 'run.mjs')
    writeFileSync(join(dir, 'input.json'), JSON.stringify(input))
    writeFileSync(script, `
      import { readFileSync } from 'node:fs'
      import { gameData } from ${JSON.stringify(join(SHARED_DIR, 'data/index.ts'))}
      import { BALANCE } from ${JSON.stringify(join(SHARED_DIR, 'engine/balance.ts'))}
      import { simulatePvp } from ${JSON.stringify(join(SHARED_DIR, 'server/autopilot.ts'))}
      const input = JSON.parse(readFileSync(${JSON.stringify(join(dir, 'input.json'))}, 'utf8'))
      process.stdout.write(JSON.stringify(simulatePvp({ data: gameData, balance: BALANCE, ...input })))
    `)
    const out = execFileSync(process.execPath, ['--no-warnings', script], { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 })
    const remote = JSON.parse(out)
    expect(remote.winner).toBe(local.winner)
    expect(remote.events).toEqual(JSON.parse(JSON.stringify(local.events)))
    expect(remote.hpShareA).toBe(local.hpShareA)
    expect(remote.engineVersion).toBe(local.engineVersion)
  }, 60000)
})
