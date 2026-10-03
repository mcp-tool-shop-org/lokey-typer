import fs from 'node:fs'
import path from 'node:path'

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'))
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

function pickWeighted(items, weight, rand) {
  let total = 0
  const w = items.map((i) => {
    const v = Math.max(0, weight(i))
    total += v
    return v
  })
  if (total <= 0) return null
  let r = rand() * total
  for (let i = 0; i < items.length; i++) {
    r -= w[i]
    if (r <= 0) return items[i]
  }
  return items[items.length - 1] ?? null
}

function renderTemplateExercise(ex, { dateKey, seed }) {
  const seedStr = seed ?? `${ex.id}|${dateKey}`
  const rand = mulberry32(xmur3(seedStr)())

  const chosen = new Map()
  return ex.template.replace(/\{([a-zA-Z0-9_]+)\}/g, (full, slotName) => {
    if (chosen.has(slotName)) return chosen.get(slotName)
    const values = ex.slots?.[slotName]
    if (!Array.isArray(values) || values.length === 0) return full
    const idx = Math.floor(rand() * values.length)
    const val = values[Math.min(values.length - 1, Math.max(0, idx))]
    chosen.set(slotName, val)
    return val
  })
}

function normalizeText(s) {
  return String(s).replace(/\s+/g, ' ').trim().toLowerCase()
}

function loadAllExercisesByMode(packsDir) {
  const files = fs.readdirSync(packsDir).filter((f) => f.endsWith('.json'))
  const byMode = { focus: [], real_life: [], competitive: [] }
  for (const f of files) {
    const p = readJson(path.join(packsDir, f))
    for (const ex of p.exercises ?? []) {
      if (ex?.mode && byMode[ex.mode]) byMode[ex.mode].push(ex)
    }
  }
  return byMode
}

function weightForKind(ex, kind) {
  let w = 1
  if (kind === 'confidence') w *= 6 - (ex.difficulty ?? 3)
  if (kind === 'challenge') w *= ex.difficulty ?? 3
  if (ex.type === 'template') w *= 1.15
  return w
}

function generateDailySet({ byMode, userId, dateKey, sessionType }) {
  const seedStr = `${userId}|${dateKey}|${sessionType}`
  const rand = mulberry32(xmur3(seedStr)())
  const count = sessionType === 'reset' ? 5 : sessionType === 'mix' ? 8 : 10
  const used = new Set()
  const items = []

  function pick(mode, kind) {
    const pool = (byMode[mode] ?? []).filter((e) => !used.has(e.id))
    const ex = pickWeighted(pool, (e) => weightForKind(e, kind), rand)
    if (!ex) return null
    used.add(ex.id)
    items.push({ kind, mode, ex })
    return ex
  }

  pick('focus', 'confidence')
  pick('real_life', 'real_life')
  pick('competitive', 'challenge')

  while (items.length < count) {
    const mode = rand() < 0.55 ? 'focus' : 'real_life'
    const ex = pick(mode, 'mix')
    if (!ex) break
  }

  return items
}

const root = process.cwd()
const packsDir = path.join(root, 'src', 'content', 'packs')
const byMode = loadAllExercisesByMode(packsDir)

const userId = 'u_test_local_001'
const baseDate = new Date().toISOString().slice(0, 10)
const startMs = new Date(baseDate).getTime()

let totalItems = 0
let duplicateSigs = 0
const seen = new Map()

for (let day = 0; day < 14; day++) {
  const dateKey = new Date(startMs + day * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const items = generateDailySet({ byMode, userId, dateKey, sessionType: 'mix' })
  for (const it of items) {
    totalItems++
    const sig =
      it.ex.type === 'template'
        ? normalizeText(renderTemplateExercise(it.ex, { dateKey, seed: `${userId}|${it.ex.id}|${dateKey}` }))
        : normalizeText(it.ex.text_short ?? it.ex.text ?? it.ex.text_long ?? '')
    const prev = seen.get(sig) ?? 0
    seen.set(sig, prev + 1)
    if (prev >= 1) duplicateSigs++
  }
}

const dupRate = totalItems === 0 ? 0 : duplicateSigs / totalItems

console.log('--- Phase 3 QA: Daily Set Novelty ---')
console.log(`Days: 14`)
console.log(`Total items: ${totalItems}`)
console.log(`Duplicate (normalized text) count: ${duplicateSigs}`)
console.log(`Duplicate rate: ${(dupRate * 100).toFixed(1)}%`)

// Not a hard fail: content pools can be small, but keep an eye on this number.
if (dupRate > 0.35) {
  console.warn('WARN: Duplicate rate is high; consider increasing novelty constraints or pool diversity.')
}
