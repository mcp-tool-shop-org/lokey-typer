import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const PUBLIC_DIR = path.join(ROOT, 'public')
const MANIFEST_PATH = path.join(PUBLIC_DIR, 'audio', 'ambient', 'manifest.json')

function publicRel(file) {
  return String(file ?? '').replace(/\\/g, '/').replace(/^\/+/, '')
}

function loadManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) return null
  try {
    const raw = fs.readFileSync(MANIFEST_PATH, 'utf8')
    const json = JSON.parse(raw)
    const tracks = Array.isArray(json?.tracks) ? json.tracks : null
    return { json, tracks }
  } catch (e) {
    return { error: e }
  }
}

function walk(dir, out = []) {
  let entries = []
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }

  for (const e of entries) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

function relFromPublic(absPath) {
  const rel = path.relative(PUBLIC_DIR, absPath)
  return rel.split(path.sep).join('/')
}

function existsPublic(relPath) {
  return fs.existsSync(path.join(PUBLIC_DIR, relPath))
}

console.log('--- QA: Ambient Asset Inventory ---')
console.log(`Public dir: ${PUBLIC_DIR}`)

const manifest = loadManifest()
const hasManifest = manifest != null && !('error' in manifest)
const hasManifestError = manifest != null && 'error' in manifest

if (hasManifestError) {
  console.log(`Manifest: ERROR reading/parsing ${relFromPublic(MANIFEST_PATH)}`)
  if (strict) {
    console.log('\nSTRICT: failing due to manifest parse error.')
    process.exitCode = 1
    process.exit()
  }
} else if (hasManifest && manifest.tracks) {
  console.log(`Manifest: ${relFromPublic(MANIFEST_PATH)}`)
  console.log(`Manifest tracks: ${manifest.tracks.length}`)
} else if (hasManifest) {
  console.log(`Manifest: ${relFromPublic(MANIFEST_PATH)} has no tracks array`)
} else {
  console.log('Manifest: not found')
}

const expectedFromManifest = hasManifest && manifest.tracks
  ? manifest.tracks
      .map((s) => ({
        profile: String(s.category ?? s.id ?? 'track'),
        file: publicRel(s.path ?? s.url ?? ''),
      }))
      .filter((e) => e.file.length > 0)
  : []

const expectedAll = expectedFromManifest

const missing = []
const presentByProfile = new Map()

for (const { profile, file } of expectedAll) {
  const ok = existsPublic(file)
  if (!presentByProfile.has(profile)) presentByProfile.set(profile, { present: 0, total: 0 })
  const agg = presentByProfile.get(profile)
  agg.total += 1
  if (ok) agg.present += 1
  else missing.push({ profile, file })
}

for (const [profile, agg] of presentByProfile.entries()) {
  console.log(`${profile}: ${agg.present}/${agg.total} expected WAV(s) present`)
}

if (missing.length) {
  console.log('\nMissing expected files (engine will fall back safely):')
  for (const m of missing) console.log(`- [${m.profile}] ${m.file}`)
} else {
  console.log('\nOK: All expected ambient files are present.')
}

// Flag unexpected WAVs under public/audio/ambient (helps catch naming drift)
const ambientDir = path.join(PUBLIC_DIR, 'audio', 'ambient')
const found = walk(ambientDir)
  .filter((p) => p.toLowerCase().endsWith('.wav'))
  .map(relFromPublic)
  .sort()

const expectedSet = new Set(expectedAll.map((e) => e.file))
const unexpected = expectedSet.size === 0 ? [] : found.filter((f) => !expectedSet.has(f))

if (unexpected.length) {
  console.log('\nUnexpected WAV files under audio/ambient (check naming/versioning):')
  for (const f of unexpected) console.log(`- ${f}`)
}

// The catalog is the product. A green run requires the version 3 tracks and their files.
if (!hasManifest || !manifest.tracks) {
  console.log('\nFAIL: ambient manifest must be version 3 with a tracks array.')
  process.exitCode = 1
} else if (expectedFromManifest.length === 0) {
  console.log('\nFAIL: manifest has zero tracks.')
  process.exitCode = 1
} else if (missing.length) {
  console.log(`\nFAIL: ${missing.length} manifest path(s) are missing from public/.`)
  process.exitCode = 1
} else {
  process.exitCode = 0
}
