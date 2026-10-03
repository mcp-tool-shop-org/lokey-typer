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

function loadAllExercises(packsDir) {
  const files = fs.readdirSync(packsDir).filter((f) => f.endsWith('.json'))
  const all = []
  for (const f of files) {
    const p = readJson(path.join(packsDir, f))
    for (const ex of p.exercises ?? []) all.push(ex)
  }
  return all
}

function recommend({ pool, weakTags, noveltyWindow, recentIds, rand }) {
  const filtered = pool.filter((ex) => !recentIds.has(ex.id))
  const usePool = filtered.length > 0 ? filtered : pool

  const ex = pickWeighted(
    usePool,
    (e) => {
      let w = 1
      const hits = weakTags.reduce((acc, t) => (e.tags?.includes(t) ? acc + 1 : acc), 0)
      if (hits > 0) w *= 1 + hits * 0.8
      if (e.type === 'template') w *= 1.1
      return w
    },
    rand,
  )

  if (!ex) return null
  return ex
}

const root = process.cwd()
const packsDir = path.join(root, 'src', 'content', 'packs')
const all = loadAllExercises(packsDir)

const mode = 'real_life'
const pool = all.filter((e) => e.mode === mode)

const seed = xmur3('phase3_reco_sanity')()
const rand = mulberry32(seed)

const noveltyWindow = 25
const recent = []
const recentSet = new Set()

const weakTags = ['apostrophe', 'punctuation', 'numbers']

let repeats = 0
let weakHits = 0
let picks = 0

for (let i = 0; i < 60; i++) {
  const ex = recommend({ pool, weakTags, noveltyWindow, recentIds: recentSet, rand })
  if (!ex) break

  picks++
  if (recentSet.has(ex.id)) repeats++
  if (weakTags.some((t) => ex.tags?.includes(t))) weakHits++

  recent.unshift(ex.id)
  while (recent.length > noveltyWindow) recent.pop()
  recentSet.clear()
  for (const id of recent) recentSet.add(id)
}

console.log('--- Phase 3 QA: Recommendation Sanity ---')
console.log(`Mode: ${mode}`)
console.log(`Pool: ${pool.length}`)
console.log(`Picks: ${picks}`)
console.log(`Novelty window: ${noveltyWindow}`)
console.log(`Repeats inside window: ${repeats}`)
console.log(`Weak-tag hits: ${weakHits} (${picks ? ((weakHits / picks) * 100).toFixed(1) : '0'}%)`)

if (picks > 0 && repeats > 0) {
  console.warn('WARN: Repeats occurred inside novelty window (pool may be small).')
}
