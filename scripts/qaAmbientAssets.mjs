import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const PUBLIC_DIR = path.join(ROOT, 'public')
const MANIFEST_PATH = path.join(PUBLIC_DIR, 'audio', 'ambient', 'manifest.json')

const strict = process.argv.includes('--strict')

function publicRel(file) {
  return String(file ?? '').replace(/\\/g, '/').replace(/^\/+/, '')
}

function rawTrackLocation(track) {
  const pathValue = typeof track?.path === 'string' ? track.path.trim() : ''
  const urlValue = typeof track?.url === 'string' ? track.url.trim() : ''
  if (pathValue) return pathValue
  if (urlValue) return urlValue
  return ''
}

function resolvePublicFile(raw) {
  const original = String(raw ?? '').trim()
  if (!original) return { ok: false, file: '' }

  const slashed = original.replace(/\\/g, '/')
  // Catalog paths are site URLs (/audio/...). A drive letter or UNC path is absolute.
  if (/^[a-zA-Z]:/.test(slashed) || slashed.startsWith('//')) {
    return { ok: false, file: publicRel(slashed) || original }
  }

  const rel = publicRel(slashed)
  if (!rel || /^[a-zA-Z]:/.test(rel) || rel.startsWith('//')) {
    return { ok: false, file: rel || original }
  }

  const abs = path.resolve(PUBLIC_DIR, rel)
  const fromPublic = path.relative(PUBLIC_DIR, abs)
  const portable = fromPublic.split(path.sep).join('/')
  if (!portable || portable === '.' || portable.startsWith('..') || path.isAbsolute(fromPublic)) {
    return { ok: false, file: portable || rel }
  }

  let stat
  try {
    stat = fs.statSync(abs)
  } catch {
    return { ok: false, file: portable }
  }
  if (!stat.isFile()) return { ok: false, file: portable }
  return { ok: true, file: portable }
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
  ? manifest.tracks.map((s) => {
      const raw = rawTrackLocation(s)
      const resolved = raw ? resolvePublicFile(raw) : { ok: false, file: '' }
      return {
        profile: String(s.category ?? s.id ?? 'track'),
        file: resolved.file,
        ok: resolved.ok,
      }
    })
  : []

const expectedAll = expectedFromManifest

const missing = []
const presentByProfile = new Map()

for (const { profile, file, ok } of expectedAll) {
  if (!presentByProfile.has(profile)) presentByProfile.set(profile, { present: 0, total: 0 })
  const agg = presentByProfile.get(profile)
  agg.total += 1
  if (ok) agg.present += 1
  else missing.push({ profile, file: file || '(no path or url)' })
}

for (const [profile, agg] of presentByProfile.entries()) {
  console.log(`${profile}: ${agg.present}/${agg.total} expected WAV(s) present`)
}

if (missing.length) {
  console.log('\nMissing expected files (engine will fall back safely):')
  for (const m of missing) console.log(`- [${m.profile}] ${m.file}`)
} else if (!hasManifestError) {
  console.log('\nOK: All expected ambient files are present.')
}

// Flag unexpected WAVs under public/audio/ambient (helps catch naming drift)
const ambientDir = path.join(PUBLIC_DIR, 'audio', 'ambient')
const found = walk(ambientDir)
  .filter((p) => p.toLowerCase().endsWith('.wav'))
  .map(relFromPublic)
  .sort()

const expectedSet = new Set(
  expectedAll
    .map((e) => e.file)
    .filter((file) => file && !file.startsWith('..') && !path.isAbsolute(file)),
)
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
