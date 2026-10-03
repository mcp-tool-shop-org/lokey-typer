import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const PUBLIC_DIR = path.join(ROOT, 'public')
const MANIFEST_PATH = path.join(PUBLIC_DIR, 'audio', 'ambient', 'manifest.json')

const EXPECTED = {
  focus_soft: [
    'audio/ambient/focus/soft/focus_soft_low_bed_v1.wav',
    'audio/ambient/focus/soft/focus_soft_mid_texture_v1.wav',
    'audio/ambient/focus/soft/focus_soft_air_v1.wav',
  ],
  focus_warm: [
    'audio/ambient/focus/warm/focus_warm_low_bed_v1.wav',
    'audio/ambient/focus/warm/focus_warm_mid_texture_v1.wav',
  ],
  competitive_clean: [
    'audio/ambient/competitive/clean/comp_clean_low_bed_v1.wav',
    'audio/ambient/competitive/clean/comp_clean_mid_presence_v1.wav',
    'audio/ambient/competitive/clean/comp_clean_air_v1.wav',
  ],
  nature_air: ['audio/ambient/nature/air/nature_air_broadband_v1.wav'],
}

function loadManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) return null
  try {
    const raw = fs.readFileSync(MANIFEST_PATH, 'utf8')
    const json = JSON.parse(raw)
    const stems = Array.isArray(json?.stems) ? json.stems : []
    return { json, stems }
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

function parseArgs() {
  const strict = process.argv.includes('--strict')
  return { strict }
}

const { strict } = parseArgs()

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
} else if (hasManifest) {
  console.log(`Manifest: ${relFromPublic(MANIFEST_PATH)}`)
  console.log(`Manifest stems: ${manifest.stems.length}`)
} else {
  console.log('Manifest: not found; using legacy EXPECTED list')
}

const expectedFromManifest = hasManifest
  ? manifest.stems
      .map((s) => ({
        profile: `${s.mode}_${s.profile}_${s.layer}`,
        file: String(s.path ?? s.url ?? ''),
      }))
      .filter((e) => e.file.length > 0)
  : []

const expectedAll = hasManifest
  ? expectedFromManifest
  : Object.entries(EXPECTED).flatMap(([profile, files]) => files.map((f) => ({ profile, file: f })))

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

// Exit behavior:
// - Default: always success (so CI/build isn’t blocked while assets are optional)
// - Strict: fail if any expected files are missing
if (strict) {
  if (hasManifest && expectedFromManifest.length === 0) {
    console.log('\nSTRICT: failing because manifest has zero stems.')
    process.exitCode = 1
  } else if (missing.length) {
    console.log(`\nSTRICT: failing due to ${missing.length} missing file(s).`)
    process.exitCode = 1
  } else {
    process.exitCode = 0
  }
} else {
  process.exitCode = 0
}
