import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()

const MANIFEST_PATH = path.join(ROOT, 'public', 'audio', 'ambient', 'manifest.json')
const ENGINE_PATH = path.join(ROOT, 'src', 'lib', 'ambient', 'ambientEngine.ts')

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

const strict = process.argv.includes('--strict')

console.log('--- QA: Sound Design Manifesto Gates ---')

// Gate 1: Engine numeric constraints (macro interval, safe window, crossfade).
const engine = readText(ENGINE_PATH)
if (!engine) {
  if (strict) fail(`Cannot read ${ENGINE_PATH}`)
  else console.log(`WARN: Cannot read ${ENGINE_PATH}; skipping engine checks`)
} else {
  const checks = [
    {
      name: 'Macro evolution interval randomized 3–6 minutes',
      re: /\bminutes\s*=\s*3\s*\+\s*this\.rand\(\)\s*\*\s*3\b/,
    },
    {
      name: 'No evolution within 20 seconds of exercise end',
      re: /\bremainingMs\s*>\s*20_000\b/,
    },
    {
      name: 'Layer swap crossfade 12–25 seconds',
      re: /fadeSeconds:\s*12\s*\+\s*this\.rand\(\)\s*\*\s*13\s*,/,
    },
    {
      name: 'Ambient capped at 70% of typing volume when typing SFX enabled',
      re: /typingCap\s*=\s*prefs\.soundEnabled\s*\?\s*clamp\(prefs\.volume,\s*0,\s*1\)\s*\*\s*0\.7\s*:/,
    },
  ]

  for (const c of checks) {
    if (c.re.test(engine)) ok(c.name)
    else fail(`${c.name} (pattern not found)`)
  }
}

// Gate 2: Manifest metadata constraints (LUFS).
if (!fs.existsSync(MANIFEST_PATH)) {
  if (strict) fail(`Manifest missing: ${MANIFEST_PATH}`)
  else console.log('WARN: manifest not found; skipping stem LUFS checks')
} else {
  const manifest = parseJson(MANIFEST_PATH)
  const stems = Array.isArray(manifest?.stems) ? manifest.stems : []

  if (stems.length === 0) {
    if (strict) fail('Manifest has zero stems')
    else console.log('WARN: manifest has zero stems; LUFS checks not applicable')
  } else {
    // Acceptance: –30 to –34 LUFS with ±1 LUFS tolerance => [-35, -29]
    const min = -35
    const max = -29

    let missing = 0
    let outOfRange = 0

    for (const s of stems) {
      const id = String(s?.id ?? '')
      const lufs = Number(s?.lufs_i)
      if (!Number.isFinite(lufs)) {
        missing += 1
        console.log(`FAIL: stem missing lufs_i: ${id || '(unknown id)'}`)
        continue
      }
      if (lufs < min || lufs > max) {
        outOfRange += 1
        console.log(`FAIL: stem lufs_i out of range [-35, -29]: ${id || '(unknown id)'} => ${lufs}`)
      }
    }

    if (missing === 0) ok('All stems provide lufs_i metadata')
    else fail(`${missing} stem(s) missing lufs_i metadata`)

    if (outOfRange === 0) ok('All stems lufs_i within acceptance range [-35, -29]')
    else fail(`${outOfRange} stem(s) out of LUFS range [-35, -29]`)
  }
}

if (process.exitCode === 1) {
  console.log('\nOne or more manifesto gates failed.')
} else {
  console.log('\nAll manifesto gates passed.')
}
