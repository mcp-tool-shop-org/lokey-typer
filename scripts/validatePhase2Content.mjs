import fs from 'node:fs'
import path from 'node:path'
import Ajv from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8')
  return JSON.parse(raw)
}

function listJsonFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return []
  return fs
    .readdirSync(dirPath)
    .filter((f) => f.toLowerCase().endsWith('.json'))
    .map((f) => path.join(dirPath, f))
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0
}

function collectTemplateSlots(template) {
  const re = /\{([a-zA-Z0-9_]+)\}/g
  const slots = new Set()
  let m
  while ((m = re.exec(template)) != null) {
    slots.add(m[1])
  }
  return [...slots]
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

function normalizeNewlines(s) {
  return s.replace(/\r\n/g, '\n')
}

const root = process.cwd()
const packsDir = path.join(root, 'src', 'content', 'packs')
const phase2Dir = path.join(root, 'src', 'content', 'phase2')
const schemasDir = path.join(root, 'src', 'content', 'phase2', 'schemas')

const schemaPaths = {
  presets: path.join(schemasDir, 'accessibility_presets.schema.json'),
  feedback: path.join(schemasDir, 'micro_feedback_rules_v2.schema.json'),
  template: path.join(schemasDir, 'exercise_template.schema.json'),
}

const ajv = new Ajv({ allErrors: true, allowUnionTypes: true })
addFormats(ajv)

const templateSchema = readJson(schemaPaths.template)
const presetsSchema = readJson(schemaPaths.presets)
const feedbackSchema = readJson(schemaPaths.feedback)

const validateTemplate = ajv.compile(templateSchema)
const validatePresets = ajv.compile(presetsSchema)
const validateFeedback = ajv.compile(feedbackSchema)

const errors = []
const warnings = []

function pushErr(where, msg, details) {
  errors.push({ where, msg, details })
}

function pushWarn(where, msg, details) {
  warnings.push({ where, msg, details })
}

function checkExerciseCommon(file, ex, pack) {
  const required = ['id', 'mode', 'pack', 'difficulty', 'estimated_seconds', 'tags']
  for (const k of required) {
    if (ex?.[k] == null) pushErr(`${file}:${ex?.id ?? '(no id)'}`, `missing required field '${k}'`)
  }

  if (!isNonEmptyString(ex.id)) pushErr(`${file}`, 'exercise.id must be a non-empty string', { ex })

  if (!['focus', 'real_life', 'competitive'].includes(ex.mode)) {
    pushErr(`${file}:${ex.id}`, `exercise.mode invalid: '${ex.mode}'`)
  }

  if (!isNonEmptyString(ex.pack)) pushErr(`${file}:${ex.id}`, 'exercise.pack must be a non-empty string')
  if (isNonEmptyString(pack?.pack_id) && ex.pack !== pack.pack_id) {
    pushWarn(`${file}:${ex.id}`, `exercise.pack ('${ex.pack}') != pack.pack_id ('${pack.pack_id}')`)
  }

  if (!Number.isInteger(ex.difficulty) || ex.difficulty < 1 || ex.difficulty > 5) {
    pushErr(`${file}:${ex.id}`, `exercise.difficulty out of range 1..5: ${ex.difficulty}`)
  }

  if (!Number.isFinite(ex.estimated_seconds) || ex.estimated_seconds < 10 || ex.estimated_seconds > 600) {
    pushWarn(`${file}:${ex.id}`, `exercise.estimated_seconds unusual: ${ex.estimated_seconds}`)
  }

  if (!Array.isArray(ex.tags) || ex.tags.length === 0) pushErr(`${file}:${ex.id}`, 'exercise.tags must be a non-empty array')
  if (Array.isArray(ex.tags)) {
    ex.tags.forEach((t, i) => {
      if (!isNonEmptyString(t)) pushErr(`${file}:${ex.id}`, `tag[${i}] must be non-empty string`, { tag: t })
    })
  }
}

function validatePackFile(filePath, allIds) {
  const rel = path.relative(root, filePath)
  let pack
  try {
    pack = readJson(filePath)
  } catch (e) {
    pushErr(rel, 'failed to parse JSON', { error: String(e) })
    return
  }

  if (!isNonEmptyString(pack.pack_id)) pushErr(rel, 'pack.pack_id must be a non-empty string')
  if (!isNonEmptyString(pack.mode) || !['focus', 'real_life', 'competitive', 'mixed'].includes(pack.mode)) {
    pushErr(rel, `pack.mode invalid: '${pack.mode}'`)
  }
  if (!Array.isArray(pack.exercises)) pushErr(rel, 'pack.exercises must be an array')

  const seenInPack = new Set()
  for (const ex of pack.exercises ?? []) {
    checkExerciseCommon(rel, ex, pack)

    if (seenInPack.has(ex.id)) pushErr(`${rel}:${ex.id}`, 'duplicate exercise id within pack')
    seenInPack.add(ex.id)

    if (allIds.has(ex.id)) pushErr(`${rel}:${ex.id}`, 'duplicate exercise id across packs')
    allIds.add(ex.id)

    if (ex.type === 'template') {
      const ok = validateTemplate(ex)
      if (!ok) {
        pushErr(`${rel}:${ex.id}`, 'template exercise failed schema validation', validateTemplate.errors)
      }

      if (!isNonEmptyString(ex.template)) {
        pushErr(`${rel}:${ex.id}`, 'template must be non-empty string')
        continue
      }

      const placeholders = collectTemplateSlots(ex.template)
      for (const slot of placeholders) {
        if (!ex.slots || !Object.prototype.hasOwnProperty.call(ex.slots, slot)) {
          pushErr(`${rel}:${ex.id}`, `template placeholder '{${slot}}' missing in slots`) 
        }
      }

      if (ex.slots && typeof ex.slots === 'object') {
        for (const [slotName, values] of Object.entries(ex.slots)) {
          if (!Array.isArray(values) || values.length === 0) {
            pushErr(`${rel}:${ex.id}`, `slots['${slotName}'] must be a non-empty array`)
            continue
          }
          for (let i = 0; i < values.length; i++) {
            if (!isNonEmptyString(values[i])) pushErr(`${rel}:${ex.id}`, `slots['${slotName}'][${i}] must be non-empty string`)
          }
        }
      }

      const today = new Date().toISOString().slice(0, 10)
      const rendered = renderTemplate(ex.template, ex.slots, `${ex.id}|${today}`)
      const normalized = normalizeNewlines(rendered)

      if (/\{[a-zA-Z0-9_]+\}/.test(normalized)) {
        pushErr(`${rel}:${ex.id}`, 'rendered template contains unresolved {slot} token(s)', { rendered: normalized })
      }

      if (!isNonEmptyString(normalized)) pushErr(`${rel}:${ex.id}`, 'rendered template is empty')
    } else {
      const t = ex.text ?? ex.text_short ?? ex.text_long
      if (!isNonEmptyString(t)) {
        pushErr(`${rel}:${ex.id}`, 'text exercise must provide non-empty text (text or text_short/text_long)')
      } else {
        const normalized = normalizeNewlines(String(t))
        if (normalized.trim().length === 0) pushErr(`${rel}:${ex.id}`, 'text is empty/whitespace')
        if (/\u0000/.test(normalized)) pushErr(`${rel}:${ex.id}`, 'text contains NUL character')
      }
    }
  }

  return pack
}

// Validate packs
const packFiles = listJsonFiles(packsDir)
const allIds = new Set()
const packs = []
for (const filePath of packFiles) {
  const pack = validatePackFile(filePath, allIds)
  if (pack) packs.push(pack)
}

// Validate phase2 extras if present
const extras = {
  presets: path.join(phase2Dir, 'accessibility_presets.json'),
  feedback: path.join(phase2Dir, 'micro_feedback_rules_v2.json'),
  index: path.join(phase2Dir, 'content_index.json'),
  ui: path.join(phase2Dir, 'ui_strings_accessible.json'),
}

for (const [key, p] of Object.entries(extras)) {
  if (!fs.existsSync(p)) {
    pushWarn(path.relative(root, p), 'file missing (optional for app runtime, recommended for Phase 2 deliverables)', { key })
    continue
  }

  let data
  try {
    data = readJson(p)
  } catch (e) {
    pushErr(path.relative(root, p), 'failed to parse JSON', { error: String(e) })
    continue
  }

  if (key === 'presets') {
    if (!validatePresets(data)) pushErr(path.relative(root, p), 'accessibility_presets failed schema validation', validatePresets.errors)
  }

  if (key === 'feedback') {
    if (!validateFeedback(data)) pushErr(path.relative(root, p), 'micro_feedback_rules_v2 failed schema validation', validateFeedback.errors)
  }

  if (key === 'index') {
    if (!Array.isArray(data?.packs)) pushErr(path.relative(root, p), 'content_index.packs must be an array of pack ids')
  }
}

// Print report (detailed)
const totalExercises = packs.reduce((sum, p) => sum + (p.exercises?.length ?? 0), 0)
console.log('--- Phase 2 Content Validation Report ---')
console.log(`Packs: ${packs.length} (${packFiles.length} files)`)
console.log(`Exercises: ${totalExercises}`)
console.log(`Unique IDs: ${allIds.size}`)
console.log('')

if (warnings.length) {
  console.log(`WARNINGS (${warnings.length})`)
  for (const w of warnings) {
    console.log(`- ${w.where}: ${w.msg}`)
    if (w.details) console.log(`  details: ${JSON.stringify(w.details).slice(0, 800)}`)
  }
  console.log('')
}

if (errors.length) {
  console.log(`ERRORS (${errors.length})`)
  for (const e of errors) {
    console.log(`- ${e.where}: ${e.msg}`)
    if (e.details) console.log(`  details: ${JSON.stringify(e.details).slice(0, 1200)}`)
  }
  console.log('')
  process.exitCode = 1
} else {
  console.log('OK: No blocking errors found.')
}
