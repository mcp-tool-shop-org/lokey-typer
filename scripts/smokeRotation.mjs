import fs from 'node:fs'
import path from 'node:path'

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function normalizeText(s) {
  return String(s)
    .replace(/\r\n/g, '\n')
    .toLowerCase()
    .replace(/[^a-z0-9\n ]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function xmur3(str) {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return h >>> 0
  }
}

function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function renderTemplate(template, slots, seedStr) {
  const seed = xmur3(seedStr)()
  const rand = mulberry32(seed)
  const chosen = new Map()
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (full, name) => {
    if (chosen.has(name)) return chosen.get(name)
    const values = slots?.[name]
    if (!Array.isArray(values) || values.length === 0) return full
    const idx = Math.floor(rand() * values.length)
    const val = values[Math.min(values.length - 1, Math.max(0, idx))]
    chosen.set(name, val)
    return val
  })
}

function pick(arr, rand) {
  return arr[Math.floor(rand() * arr.length)]
}

const root = process.cwd()
const packsDir = path.join(root, 'src', 'content', 'packs')
const indexPath = path.join(root, 'src', 'content', 'phase2', 'content_index.json')

if (!fs.existsSync(indexPath)) {
  console.error('Missing src/content/phase2/content_index.json; run gen:phase2-content first.')
  process.exit(1)
}

const index = readJson(indexPath)
const packIds = index?.recommended_quickstart

const allPacks = new Map()
for (const f of fs.readdirSync(packsDir)) {
  if (!f.toLowerCase().endsWith('.json')) continue
  const p = readJson(path.join(packsDir, f))
  allPacks.set(p.pack_id, p)
}

function exercisesForPackId(packId) {
  const pack = allPacks.get(packId)
  if (!pack) return []
  return Array.isArray(pack.exercises) ? pack.exercises : []
}

const today = new Date().toISOString().slice(0, 10)
const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

const seed = 424242
const rand = mulberry32(seed)

function exerciseToText(ex, dateKey) {
  if (ex.type === 'template') {
    return renderTemplate(ex.template, ex.slots, `${ex.id}|${dateKey}`)
  }
  return ex.text ?? ex.text_short ?? ex.text_long ?? ''
}

function runQuickstart(mode, runs) {
  const packList = packIds?.[mode] ?? []
  const pool = packList
    .flatMap((pid) => exercisesForPackId(pid))
    .filter((ex) => ex?.mode === mode)
  if (pool.length === 0) {
    console.log(`No pool for mode '${mode}'`) 
    return
  }

  const seenSig = new Map()
  const byPack = new Map()
  let templateCount = 0
  let templateChanged = 0

  for (let i = 0; i < runs; i++) {
    const ex = pick(pool, rand)
    const textToday = exerciseToText(ex, today)
    const sig = normalizeText(textToday)

    const prev = seenSig.get(sig) ?? 0
    seenSig.set(sig, prev + 1)

    byPack.set(ex.pack, (byPack.get(ex.pack) ?? 0) + 1)

    // Daily-set predictability test for templates
    if (ex.type === 'template') {
      templateCount += 1
      const textTomorrow = exerciseToText(ex, tomorrow)
      if (normalizeText(textTomorrow) !== normalizeText(textToday)) templateChanged += 1
    }
  }

  const duplicates = [...seenSig.values()].filter((n) => n > 1).reduce((a, b) => a + (b - 1), 0)
  const unique = seenSig.size

  console.log(`Mode: ${mode}`)
  console.log(`  pool: ${pool.length} exercises across ${packList.length} packs`)
  console.log(`  runs: ${runs}`)
  console.log(`  unique texts: ${unique}`)
  console.log(`  duplicate hits: ${duplicates}`)
  if (templateCount > 0) {
    console.log(
      `  templates: ${templateCount} picked; ${templateChanged} changed across dates (${Math.round(
        (templateChanged / templateCount) * 100,
      )}%)`,
    )
  }

  const topRepeats = [...seenSig.entries()]
    .filter(([, n]) => n > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  if (topRepeats.length) {
    console.log('  top repeats:')
    for (const [sig, n] of topRepeats) {
      console.log(`    x${n}: ${sig.slice(0, 90)}${sig.length > 90 ? '…' : ''}`)
    }
  }

  const packStats = [...byPack.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
  console.log('  pack distribution (top):')
  for (const [p, n] of packStats) console.log(`    ${p}: ${n}`)
  console.log('')
}

console.log('--- Rotation + Novelty Smoke Test ---')
console.log(`Seed: ${seed}`)
console.log(`Today: ${today}`)
console.log(`Tomorrow: ${tomorrow}`)
console.log('')

runQuickstart('focus', 30)
runQuickstart('real_life', 30)
runQuickstart('competitive', 30)
