import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()

const MANIFEST_PATH = path.join(ROOT, 'public', 'audio', 'ambient', 'manifest.json')
const ENGINE_PATH = path.join(ROOT, 'src', 'lib', 'ambient', 'ambientPlayerV3.ts')

function readText(p) {
  try {
    return fs.readFileSync(p, 'utf8')
  } catch {
    return null
  }
}

function parseJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch {
    return null
  }
}

function fail(msg) {
  console.log(`FAIL: ${msg}`)
  process.exitCode = 1
}

function ok(msg) {
  console.log(`OK: ${msg}`)
}

function loadKeptBeds() {
  const keptPath = path.join(ROOT, 'scripts', 'audio', 'kept-beds.json')
  if (!fs.existsSync(keptPath)) return { ok: true, byId: new Map() }
  let data
  try {
    data = JSON.parse(fs.readFileSync(keptPath, 'utf8'))
  } catch (err) {
    return { ok: false, error: `kept beds file could not be read: ${err instanceof Error ? err.message : String(err)}` }
  }
  if (!data || typeof data !== 'object' || !Array.isArray(data.beds)) {
    return { ok: false, error: 'kept beds file needs an object with a beds array' }
  }
  const byId = new Map()
  const seenPath = new Set()
  for (const item of data.beds) {
    if (!item || typeof item !== 'object') {
      return { ok: false, error: 'each kept bed must be an object' }
    }
    const id = item.id
    const rel = item.path
    const reason = item.reason
    if (typeof id !== 'string' || !id || id.includes('/') || id.includes('\\')) {
      return { ok: false, error: `kept bed id is not a plain track id: ${String(id)}` }
    }
    if (
      typeof rel !== 'string' ||
      !rel ||
      rel.startsWith('/') ||
      rel.includes('\\') ||
      rel.split('/').includes('..')
    ) {
      return { ok: false, error: `kept bed path is not a relative catalog path: ${String(rel)}` }
    }
    const stem = rel.split('/').pop().replace(/\.wav$/i, '')
    if (stem !== id) {
      return { ok: false, error: `kept bed path does not match its id: ${id}` }
    }
    if (typeof reason !== 'string' || !reason.trim()) {
      return { ok: false, error: `kept bed ${id} needs a reason` }
    }
    if (typeof item.loudness !== 'boolean' || typeof item.spectrum !== 'boolean') {
      return { ok: false, error: `kept bed ${id} needs loudness and spectrum as true or false` }
    }
    if (!item.loudness && !item.spectrum) {
      return { ok: false, error: `kept bed ${id} names neither gate` }
    }
    if (byId.has(id)) return { ok: false, error: `duplicate kept bed id: ${id}` }
    if (seenPath.has(rel)) return { ok: false, error: `duplicate kept bed path: ${rel}` }
    seenPath.add(rel)
    byId.set(id, {
      id,
      path: rel,
      reason: reason.trim(),
      loudness: item.loudness,
      spectrum: item.spectrum,
    })
  }
  return { ok: true, byId }
}

console.log('--- QA: Sound Design Manifesto Gates ---')

// Gate 1: the constants AmbientPlayerV3 actually ships.
const engine = readText(ENGINE_PATH)
if (!engine) {
  fail(`Cannot read ${ENGINE_PATH}`)
} else {
  const checks = [
    {
      name: 'Rotation interval is 5–10 minutes',
      re: /const ROTATION_MIN_MS = 5 \* 60_000\b[\s\S]*const ROTATION_MAX_MS = 10 \* 60_000\b/,
    },
    {
      name: 'Track crossfade is 6–8 seconds',
      re: /const CROSSFADE_SEC_MIN = 6\b[\s\S]*const CROSSFADE_SEC_MAX = 8\b/,
    },
    {
      name: 'Ambient playback gain lifts a -32 LUFS bed',
      re: /const MAX_VOLUME = 4\b/,
    },
    {
      name: 'Reduced motion skips rotation',
      re: /if \(this\.reducedMotion\) return/,
    },
    {
      name: 'Screen reader mode keeps ambient off',
      re: /return this\.enabled && !this\.screenReaderMode && !this\.pausedByVisibility/,
    },
  ]

  for (const c of checks) {
    if (c.re.test(engine)) ok(c.name)
    else fail(`${c.name} (pattern not found)`)
  }
}

// Gate 2: version 3 tracks carry lufs_i. A stems array is the old generator shape.
if (!fs.existsSync(MANIFEST_PATH)) {
  fail(`Manifest missing: ${MANIFEST_PATH}`)
} else {
  const manifest = parseJson(MANIFEST_PATH)
  const tracks = Array.isArray(manifest?.tracks) ? manifest.tracks : null

  if (!tracks) {
    fail('Manifest has no tracks array (version 3). A stems array is not the live catalog.')
  } else if (tracks.length === 0) {
    fail('Manifest has zero tracks')
  } else {
    // Acceptance: –30 to –34 LUFS with ±1 LUFS tolerance => [-35, -29].
    // A named bed may stay outside that window. The stamp is not rewritten.
    const min = -35
    const max = -29
    const kept = loadKeptBeds()

    if (!kept.ok) {
      fail(kept.error)
    } else {
      let missing = 0
      let outOfRange = 0
      let namedOutside = 0
      let staleNamed = 0
      const seenIds = new Set()

      for (const s of tracks) {
        const id = String(s?.id ?? '')
        seenIds.add(id)
        const lufs = Number(s?.lufs_i)
        const entry = kept.byId.get(id)
        const named = entry?.loudness === true
        if (!Number.isFinite(lufs)) {
          missing += 1
          console.log(`FAIL: track missing lufs_i: ${id || '(unknown id)'}`)
          continue
        }
        if (lufs < min || lufs > max) {
          if (named) {
            namedOutside += 1
            console.log(`KEPT: ${id} lufs_i ${lufs} stays outside [-35, -29]. ${entry.reason}`)
          } else {
            outOfRange += 1
            console.log(`FAIL: track lufs_i out of range [-35, -29]: ${id || '(unknown id)'} => ${lufs}`)
          }
        } else if (named) {
          staleNamed += 1
          console.log(
            `FAIL: ${id} lufs_i ${lufs} is inside [-35, -29]. This named bed no longer needs a loudness exception.`,
          )
        }
      }

      let missingNamed = 0
      for (const [id, entry] of kept.byId) {
        if (entry.loudness && !seenIds.has(id)) {
          missingNamed += 1
          console.log(`FAIL: named loudness bed is not in the manifest: ${id}`)
        }
      }

      if (missing === 0) ok('All tracks provide lufs_i metadata')
      else fail(`${missing} track(s) missing lufs_i metadata`)

      if (outOfRange === 0 && staleNamed === 0 && missingNamed === 0) {
        if (namedOutside === 0) ok('All tracks lufs_i within acceptance range [-35, -29]')
        else ok(`All other tracks lufs_i within [-35, -29]. ${namedOutside} named bed(s) stay outside that window.`)
      } else {
        if (outOfRange > 0) fail(`${outOfRange} track(s) out of LUFS range [-35, -29]`)
        if (staleNamed > 0) fail(`${staleNamed} named bed(s) are inside [-35, -29] and no longer need a loudness exception`)
        if (missingNamed > 0) fail(`${missingNamed} named loudness bed(s) are not in the manifest`)
      }
    }
  }
}

if (process.exitCode === 1) {
  console.log('\nOne or more manifesto gates failed.')
} else {
  console.log('\nAll manifesto gates passed.')
}
