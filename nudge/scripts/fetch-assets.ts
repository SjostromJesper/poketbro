// Downloads the third-party art and audio packs into assets-raw/ (gitignored). Run with `npm run fetch-assets`.
// Packs that already exist are skipped. Licences: Ninja Adventure, Kenney and Junkala are CC0; Tuxemon is mostly CC-BY-SA / CC-BY
// (attribution needed, see assets-raw/tuxemon/ATTRIBUTIONS.md); Pipoya may not be redistributed. See the credits screen and DECISIONS.md.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const RAW = join(ROOT, 'assets-raw')
const DOWNLOADS = join(RAW, '_downloads')
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'

interface Pack {
  id: string
  /** Target folder below assets-raw/. */
  dir: string
  /** Direct zip URL, or a function that resolves it (itch.io / Kenney need a page visit). */
  url?: string | (() => Promise<string>)
  /** Alternative to `url`: a custom fetcher that fills the target folder itself (git sparse checkout). */
  fetch?: (target: string) => Promise<void>
  optional?: boolean
}

const OGA = 'https://opengameart.org/sites/default/files'

const PACKS: Pack[] = [
  { id: 'ninja-adventure', dir: 'ninja-adventure', url: () => resolveItch('https://pixel-boy.itch.io/ninja-adventure-asset-pack', 'Ninja Adventure - Asset Pack.zip') },
  { id: 'jrpg1', dir: 'music/jrpg1', url: `${OGA}/JRPG%20Music%20Pack%20%231%20%5BExploration%5D%20by%20Juhani%20Junkala.zip` },
  { id: 'jrpg2', dir: 'music/jrpg2', url: `${OGA}/JRPG%20Music%20Pack%20%232%20%5BTowns%5D%20by%20Juhani%20Junkala.zip` },
  { id: 'jrpg4', dir: 'music/jrpg4', url: `${OGA}/JRPG%20Music%20Pack%20%234%20%5BCalm%5D%20by%20Juhani%20Junkala_0.zip` },
  { id: 'jrpg5', dir: 'music/jrpg5', url: `${OGA}/JRPG%20Music%20Pack%20%235%20%5BAction%5D%20by%20Juhani%20Junkala.zip` },
  { id: 'chiptunes', dir: 'music/chiptunes', url: `${OGA}/5%20Action%20Chiptunes%20By%20Juhani%20Junkala.zip` },
  { id: 'sfx512', dir: 'sfx', url: `${OGA}/The%20Essential%20Retro%20Video%20Game%20Sound%20Effects%20Collection%20%5B512%20sounds%5D.zip` },
  { id: 'kenney-tiny-town', dir: 'kenney-tiny-town', url: () => resolveKenney('tiny-town'), optional: true },
  { id: 'kenney-tiny-dungeon', dir: 'kenney-tiny-dungeon', url: () => resolveKenney('tiny-dungeon'), optional: true },
  // Theme A (default): Tuxemon, sparse checkout of the graphics folders only.
  { id: 'tuxemon', dir: 'tuxemon', fetch: fetchTuxemon },
  // Theme B: Pipoya (32x32). Not redistributable: assets-raw/ and public/assets/themes/pipoya/ are gitignored.
  { id: 'pipoya-tileset', dir: 'pipoya/tileset', url: () => resolveItch('https://pipoya.itch.io/pipoya-rpg-tileset-32x32', 'Pipoya RPG Tileset 32x32.zip'), optional: true },
  { id: 'pipoya-characters', dir: 'pipoya/characters', url: () => resolveItch('https://pipoya.itch.io/pipoya-free-rpg-character-sprites-32x32', 'PIPOYA FREE RPG Character Sprites 32x32.zip'), optional: true },
]

// ---------------------------------------------------------------------------
// itch.io (Ninja Adventure): the "Download Now" click flow done by hand
// ---------------------------------------------------------------------------

function cookieHeader(jar: Map<string, string>): string {
  return [...jar].map(([k, v]) => `${k}=${v}`).join('; ')
}

function storeCookies(res: Response, jar: Map<string, string>) {
  for (const line of res.headers.getSetCookie?.() ?? []) {
    const [pair] = line.split(';')
    const eq = pair.indexOf('=')
    if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim())
  }
}

async function resolveItch(base: string, uploadTitle: string): Promise<string> {
  const jar = new Map<string, string>()
  const headers = () => ({ 'User-Agent': UA, 'Cookie': cookieHeader(jar) })
  const csrf = (html: string) => html.match(/name="csrf_token" value="([^"]+)"/)?.[1] ?? html.match(/csrf_token" value="([^"]+)"/)?.[1]

  const page = await fetch(base, { headers: headers() })
  storeCookies(page, jar)
  const token = csrf(await page.text())
  if (!token) throw new Error('itch.io: no csrf token on the game page')

  const post = (url: string, t: string) => fetch(url, {
    method: 'POST',
    headers: { ...headers(), 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' },
    body: new URLSearchParams({ csrf_token: t }),
  })

  const step1 = await post(`${base}/download_url`, token)
  storeCookies(step1, jar)
  const downloadPage = ((await step1.json()) as { url: string }).url

  const listing = await fetch(downloadPage, { headers: headers() })
  storeCookies(listing, jar)
  const html = await listing.text()
  const token2 = csrf(html)
  // The upload with the wanted file name (the pages also list extras like generators and project files).
  const escaped = uploadTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = html.match(new RegExp(`data-upload_id="(\\d+)"[\\s\\S]*?title="${escaped}"`))
  if (!token2 || !match) throw new Error(`itch.io: could not find the upload "${uploadTitle}"`)

  const step2 = await post(`${base}/file/${match[1]}?source=game_download&as_props=1&after_download_lightbox=true`, token2)
  return ((await step2.json()) as { url: string }).url
}

async function resolveKenney(slug: string): Promise<string> {
  const res = await fetch(`https://kenney.nl/assets/${slug}`, { headers: { 'User-Agent': UA } })
  const html = await res.text()
  const link = html.match(new RegExp(`https://kenney\\.nl/media/pages/assets/${slug}/[^"']+\\.zip`))?.[0]
  if (!link) throw new Error('Kenney: no zip link found on the page')
  return link
}

// ---------------------------------------------------------------------------

function isEmpty(dir: string): boolean {
  return !existsSync(dir) || readdirSync(dir).length === 0
}

/** Shallow, sparse clone of the Tuxemon repository: only tilesets, sprites and the attribution file. */
async function fetchTuxemon(target: string): Promise<void> {
  const repo = join(target, 'repo')
  mkdirSync(target, { recursive: true })
  execFileSync('git', ['clone', '--depth', '1', '--filter=blob:none', '--sparse', '--branch', 'development', 'https://github.com/Tuxemon/Tuxemon.git', repo], { stdio: 'ignore' })
  execFileSync('git', ['-C', repo, 'sparse-checkout', 'set', '--no-cone', '/ATTRIBUTIONS.md', '/LICENSE', '/mods/tuxemon/gfx/tilesets', '/mods/tuxemon/sprites', '/mods/tuxemon/gfx/sprites/player', '/mods/tuxemon/sprites_obj'], { stdio: 'ignore' })
  execFileSync('git', ['-C', repo, 'checkout'], { stdio: 'ignore' })
  execFileSync('cp', [join(repo, 'ATTRIBUTIONS.md'), join(target, 'ATTRIBUTIONS.md')])
  console.log('  checked out Tuxemon graphics into assets-raw/tuxemon')
}

async function download(pack: Pack): Promise<void> {
  const target = join(RAW, pack.dir)
  if (!isEmpty(target)) {
    console.log(`- ${pack.id}: already there, skipping`)
    return
  }
  if (pack.fetch) {
    console.log(`- ${pack.id}: fetching`)
    await pack.fetch(target)
    return
  }
  if (!pack.url) throw new Error('pack has neither url nor fetch')
  const url = typeof pack.url === 'string' ? pack.url : await pack.url()
  mkdirSync(DOWNLOADS, { recursive: true })
  const zipPath = join(DOWNLOADS, `${pack.id}.zip`)
  console.log(`- ${pack.id}: downloading ${url.slice(0, 100)}${url.length > 100 ? '...' : ''}`)
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const bytes = Buffer.from(await res.arrayBuffer())
  if (bytes.subarray(0, 2).toString() !== 'PK') throw new Error('the download is not a zip file (got HTML?)')
  await writeFile(zipPath, bytes)
  mkdirSync(target, { recursive: true })
  execFileSync('unzip', ['-q', '-o', zipPath, '-d', target])
  console.log(`  unpacked ${statSync(zipPath).size} bytes into assets-raw/${pack.dir}`)
}

async function main() {
  mkdirSync(RAW, { recursive: true })
  const failed: string[] = []
  for (const pack of PACKS) {
    try {
      await download(pack)
    } catch (error) {
      console.warn(`  ! ${pack.id} failed: ${(error as Error).message}${pack.optional ? ' (optional)' : ''}`)
      if (!pack.optional) failed.push(pack.id)
    }
  }
  if (failed.length) {
    console.warn(`\nMissing packs: ${failed.join(', ')}. Download them manually into assets-raw/ (see nudge/PROGRESS.md).`)
    process.exitCode = 1
  }
}

main()
