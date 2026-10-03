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
      name: 'Ambient master is capped at 0.7',
      re: /const MAX_VOLUME = 0\.7\b/,
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
    // Acceptance: –30 to –34 LUFS with ±1 LUFS tolerance => [-35, -29]
    const min = -35
    const max = -29

    let missing = 0
    let outOfRange = 0

    for (const s of tracks) {
      const id = String(s?.id ?? '')
      const lufs = Number(s?.lufs_i)
      if (!Number.isFinite(lufs)) {
        missing += 1
        console.log(`FAIL: track missing lufs_i: ${id || '(unknown id)'}`)
        continue
      }
      if (lufs < min || lufs > max) {
        outOfRange += 1
        console.log(`FAIL: track lufs_i out of range [-35, -29]: ${id || '(unknown id)'} => ${lufs}`)
      }
    }

    if (missing === 0) ok('All tracks provide lufs_i metadata')
    else fail(`${missing} track(s) missing lufs_i metadata`)

    if (outOfRange === 0) ok('All tracks lufs_i within acceptance range [-35, -29]')
    else fail(`${outOfRange} track(s) out of LUFS range [-35, -29]`)
  }
}

if (process.exitCode === 1) {
  console.log('\nOne or more manifesto gates failed.')
} else {
  console.log('\nAll manifesto gates passed.')
}
