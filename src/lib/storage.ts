import type { Mode } from '@content'
import { enforceAccessibilityLocks } from './effectivePrefs'
import { AMBIENT_CATEGORIES, type AmbientCategory } from './ambientManifest'
import { isKeyboardVoice, type KeyboardVoice } from './keyboardVoice'

export type SprintDurationMs = 30_000 | 60_000 | 120_000

export type Preferences = {
  soundEnabled: boolean
  volume: number // 0..1
  keyboardVoice: KeyboardVoice
  bellOnCompletion: boolean
  ambientEnabled: boolean
  ambientCategory: AmbientCategory | 'all'
  ambientVolume: number // 0..1
  ambientPauseOnTyping: boolean
  fontScale: 0.9 | 1 | 1.1
  // Accessibility locks (Phase 3): used to enforce safety constraints.
  screenReaderMode: boolean
  reducedMotion: boolean
  showLiveWpm: {
    focus: boolean
    real_life: boolean
    competitive: boolean
  }
  focusMinimalHud: boolean
  competitiveSprintDurationMs: SprintDurationMs
  competitiveGhostEnabled: boolean
}

export type RunResult = {
  v?: 2
  exercise_id: string
  timestamp: number
  mode: Mode
  rendered_text_hash?: string
  wpm: number
  accuracy: number
  errors: number
  backspaces: number
  duration_ms: number
  tags_hit?: string[]
  sprint_duration_ms?: SprintDurationMs
}

export type PersonalBest = {
  exercise_id: string
  sprint_duration_ms?: SprintDurationMs
  wpm: number
  accuracy: number
  timestamp: number
}

export type PersonalBestsStore = {
  // key: `${exerciseId}|${durationMs ?? 0}`
  byKey: Record<string, PersonalBest>
}

export type RecentHistory = {
  byMode: Record<Mode, string[]>
}

const KEY_PREFS = 'lkt_prefs_v1'
const KEY_PREFS_LKG = 'lkt_prefs_v1_lkg'
const KEY_RUNS = 'lkt_runs_v1'
const KEY_PBS = 'lkt_pbs_v1'
const KEY_RECENTS = 'lkt_recents_v1'
const KEY_LAST_MODE = 'lkt_last_mode_v1'
const KEY_USER_ID = 'lkt_user_id_v1'
const KEY_SKILL = 'lkt_skill_v1'

const LEGACY_KEYS: Record<string, string> = {
  [KEY_PREFS]: 'tt_prefs_v1',
  [KEY_PREFS_LKG]: 'tt_prefs_v1_lkg',
  [KEY_RUNS]: 'tt_runs_v1',
  [KEY_PBS]: 'tt_pbs_v1',
  [KEY_RECENTS]: 'tt_recents_v1',
  [KEY_LAST_MODE]: 'tt_last_mode_v1',
  [KEY_USER_ID]: 'tt_user_id_v1',
  [KEY_SKILL]: 'tt_skill_v1',
}

let didMigrateStorageKeys = false

function ensureStorageKeysMigrated() {
  if (didMigrateStorageKeys) return
  didMigrateStorageKeys = true

  // Guard for non-browser environments.
  try {
    if (typeof localStorage === 'undefined') return
  } catch {
    return
  }

  for (const [newKey, legacyKey] of Object.entries(LEGACY_KEYS)) {
    try {
      const hasNew = localStorage.getItem(newKey) != null
      if (hasNew) continue

      const legacy = localStorage.getItem(legacyKey)
      if (legacy == null) continue

      localStorage.setItem(newKey, legacy)
    } catch {
      // ignore
    }
  }
}

const DEFAULT_PREFS: Preferences = {
  soundEnabled: true,
  volume: 0.5,
  keyboardVoice: 'mechanical',
  bellOnCompletion: true,
  ambientEnabled: true,
  ambientCategory: 'all',
  ambientVolume: 0.5,
  ambientPauseOnTyping: false,
  fontScale: 1,
  screenReaderMode: false,
  reducedMotion: false,
  showLiveWpm: {
    focus: false,
    real_life: false,
    competitive: true,
  },
  focusMinimalHud: true,
  competitiveSprintDurationMs: 60_000,
  competitiveGhostEnabled: true,
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

export function sanitizePreferences(input: Partial<Preferences> | null | undefined): Preferences {
  let merged: Preferences = {
    ...DEFAULT_PREFS,
    ...(input ?? {}),
    showLiveWpm: {
      ...DEFAULT_PREFS.showLiveWpm,
      ...((input as Partial<Preferences> | undefined)?.showLiveWpm ?? {}),
    },
  }

  const fontScale = merged.fontScale
  if (fontScale !== 0.9 && fontScale !== 1 && fontScale !== 1.1) merged.fontScale = DEFAULT_PREFS.fontScale

  merged.volume = clamp(Number(merged.volume), 0, 1)
  if (!Number.isFinite(merged.volume)) merged.volume = DEFAULT_PREFS.volume

  if (!isKeyboardVoice(merged.keyboardVoice)) merged.keyboardVoice = DEFAULT_PREFS.keyboardVoice

  merged.ambientVolume = clamp(Number(merged.ambientVolume), 0, 1)
  if (!Number.isFinite(merged.ambientVolume)) merged.ambientVolume = DEFAULT_PREFS.ambientVolume

  const ac = merged.ambientCategory
  if (ac !== 'all' && !(AMBIENT_CATEGORIES as string[]).includes(ac)) {
    merged.ambientCategory = DEFAULT_PREFS.ambientCategory
  }

  if (merged.competitiveSprintDurationMs !== 30_000 && merged.competitiveSprintDurationMs !== 60_000 && merged.competitiveSprintDurationMs !== 120_000) {
    merged.competitiveSprintDurationMs = DEFAULT_PREFS.competitiveSprintDurationMs
  }

  merged.soundEnabled = Boolean(merged.soundEnabled)
  merged.bellOnCompletion = Boolean(merged.bellOnCompletion)
  merged.ambientEnabled = Boolean(merged.ambientEnabled)
  merged.ambientPauseOnTyping = Boolean(merged.ambientPauseOnTyping)
  merged.focusMinimalHud = Boolean(merged.focusMinimalHud)
  merged.competitiveGhostEnabled = Boolean(merged.competitiveGhostEnabled)

  merged.screenReaderMode = Boolean(merged.screenReaderMode)
  merged.reducedMotion = Boolean(merged.reducedMotion)

  // Accessibility hard constraints.
  merged = enforceAccessibilityLocks(merged)

  merged.showLiveWpm = {
    focus: Boolean(merged.showLiveWpm.focus),
    real_life: Boolean(merged.showLiveWpm.real_life),
    competitive: Boolean(merged.showLiveWpm.competitive),
  }

  return merged
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function randomId(len = 16) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let out = ''
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}

export function getOrCreateUserId(): string {
  ensureStorageKeysMigrated()
  const existing = readStorage(KEY_USER_ID)
  if (existing && existing.length >= 8) return existing
  const next = `u_${randomId(20)}`
  try {
    localStorage.setItem(KEY_USER_ID, next)
  } catch {
    // ignore
  }
  return next
}

export type UserSkillModel = {
  version: 2
  updated_at: string
  total_runs: number
  ema: {
    wpm: number
    accuracy: number
    backspace_rate: number
  }
  by_mode: Record<Mode, { ema_wpm: number; ema_accuracy: number; ema_backspace_rate: number; runs: number }>
  errors_by_class: Record<string, number>
  weakness_by_tag: Record<string, number>
  performance_by_length: {
    short: { ema_wpm: number; ema_accuracy: number; ema_backspace_rate: number; runs: number }
    medium: { ema_wpm: number; ema_accuracy: number; ema_backspace_rate: number; runs: number }
    long: { ema_wpm: number; ema_accuracy: number; ema_backspace_rate: number; runs: number }
    multiline: { ema_wpm: number; ema_accuracy: number; ema_backspace_rate: number; runs: number }
  }
  weak_tags: string[]
  recent_exercise_ids_by_mode: Record<Mode, string[]>
}

function defaultSkillModel(): UserSkillModel {
  return {
    version: 2,
    updated_at: new Date().toISOString(),
    total_runs: 0,
    ema: { wpm: 0, accuracy: 1, backspace_rate: 0 },
    by_mode: {
      focus: { ema_wpm: 0, ema_accuracy: 1, ema_backspace_rate: 0, runs: 0 },
      real_life: { ema_wpm: 0, ema_accuracy: 1, ema_backspace_rate: 0, runs: 0 },
      competitive: { ema_wpm: 0, ema_accuracy: 1, ema_backspace_rate: 0, runs: 0 },
    },
    errors_by_class: {},
    weakness_by_tag: {},
    performance_by_length: {
      short: { ema_wpm: 0, ema_accuracy: 1, ema_backspace_rate: 0, runs: 0 },
      medium: { ema_wpm: 0, ema_accuracy: 1, ema_backspace_rate: 0, runs: 0 },
      long: { ema_wpm: 0, ema_accuracy: 1, ema_backspace_rate: 0, runs: 0 },
      multiline: { ema_wpm: 0, ema_accuracy: 1, ema_backspace_rate: 0, runs: 0 },
    },
    weak_tags: [],
    recent_exercise_ids_by_mode: {
      focus: [],
      real_life: [],
      competitive: [],
    },
  }
}

type UserSkillModelV1 = {
  version: 1
  updated_at: string
  total_runs: number
  ema: { wpm: number; accuracy: number; backspace_rate: number }
  errors_by_class: Record<string, number>
  performance_by_length: UserSkillModel['performance_by_length']
  weak_tags: string[]
}

function migrateSkillModelV1ToV2(input: UserSkillModelV1): UserSkillModel {
  const base = defaultSkillModel()
  const seededWeakness: Record<string, number> = {}
  for (const t of input.weak_tags ?? []) seededWeakness[t] = 0.25

  return {
    ...base,
    version: 2,
    updated_at: input.updated_at ?? base.updated_at,
    total_runs: Number.isFinite(input.total_runs) ? input.total_runs : base.total_runs,
    ema: input.ema ?? base.ema,
    errors_by_class: input.errors_by_class ?? base.errors_by_class,
    performance_by_length: input.performance_by_length ?? base.performance_by_length,
    weak_tags: Array.isArray(input.weak_tags) ? input.weak_tags.slice(0, 12) : base.weak_tags,
    weakness_by_tag: seededWeakness,
  }
}

type LengthBucket = UserSkillModel['performance_by_length']['short']

const LENGTH_BUCKETS = ['short', 'medium', 'long', 'multiline'] as const

function isLengthBucket(value: unknown): value is LengthBucket {
  if (value == null || typeof value !== 'object') return false
  const bucket = value as Partial<LengthBucket>
  return (
    typeof bucket.ema_wpm === 'number' &&
    typeof bucket.ema_accuracy === 'number' &&
    typeof bucket.ema_backspace_rate === 'number' &&
    typeof bucket.runs === 'number'
  )
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isEmaShape(value: unknown): value is UserSkillModel['ema'] {
  if (value == null || typeof value !== 'object') return false
  const ema = value as Partial<UserSkillModel['ema']>
  return isFiniteNumber(ema.wpm) && isFiniteNumber(ema.accuracy) && isFiniteNumber(ema.backspace_rate)
}

function isModeRow(value: unknown): value is UserSkillModel['by_mode']['focus'] {
  if (value == null || typeof value !== 'object') return false
  const row = value as Partial<UserSkillModel['by_mode']['focus']>
  return (
    isFiniteNumber(row.ema_wpm) &&
    isFiniteNumber(row.ema_accuracy) &&
    isFiniteNumber(row.ema_backspace_rate) &&
    isFiniteNumber(row.runs)
  )
}

const SKILL_MODES = ['focus', 'real_life', 'competitive'] as const

function healByMode(
  value: unknown,
  base: UserSkillModel['by_mode'],
): { byMode: UserSkillModel['by_mode']; healed: boolean } {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return { byMode: base, healed: true }
  }
  const raw = value as Record<string, unknown>
  let healed = false
  const byMode = { ...base }
  for (const mode of SKILL_MODES) {
    if (isModeRow(raw[mode])) byMode[mode] = raw[mode]
    else healed = true
  }
  return { byMode, healed }
}

function healWeakTags(value: unknown): { tags: string[]; healed: boolean } {
  if (!Array.isArray(value)) return { tags: [], healed: true }
  if (value.every((tag) => typeof tag === 'string')) return { tags: value, healed: false }
  return { tags: value.filter((tag): tag is string => typeof tag === 'string'), healed: true }
}

function isIdList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function healRecents(
  value: unknown,
  base: UserSkillModel['recent_exercise_ids_by_mode'],
): { recent: UserSkillModel['recent_exercise_ids_by_mode']; healed: boolean } {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return { recent: base, healed: true }
  }
  const raw = value as Record<string, unknown>
  let healed = false
  const recent = { ...base }
  for (const mode of SKILL_MODES) {
    const list = raw[mode]
    if (isIdList(list)) recent[mode] = list
    else healed = true
  }
  return { recent, healed }
}

function skillModelFromV2(parsed: Partial<UserSkillModel>): UserSkillModel {
  const base = defaultSkillModel()
  const stored = parsed.performance_by_length
  const performance_by_length: UserSkillModel['performance_by_length'] = {
    short: base.performance_by_length.short,
    medium: base.performance_by_length.medium,
    long: base.performance_by_length.long,
    multiline: base.performance_by_length.multiline,
  }
  let repaired = stored == null || typeof stored !== 'object'
  if (stored && typeof stored === 'object') {
    for (const name of LENGTH_BUCKETS) {
      const candidate = stored[name]
      if (isLengthBucket(candidate)) performance_by_length[name] = candidate
      else repaired = true
    }
  }

  const totalRuns = parsed.total_runs
  const model = {
    ...base,
    ...parsed,
    version: 2 as const,
    total_runs: typeof totalRuns === 'number' ? totalRuns : base.total_runs,
    performance_by_length,
  } as UserSkillModel

  let healed = repaired
  if (!isEmaShape(model.ema)) {
    model.ema = base.ema
    healed = true
  }
  const byMode = healByMode(model.by_mode, base.by_mode)
  if (byMode.healed) {
    model.by_mode = byMode.byMode
    healed = true
  }
  const weak = healWeakTags(model.weak_tags)
  if (weak.healed) {
    model.weak_tags = weak.tags
    healed = true
  }
  const recent = healRecents(model.recent_exercise_ids_by_mode, base.recent_exercise_ids_by_mode)
  if (recent.healed) {
    model.recent_exercise_ids_by_mode = recent.recent
    healed = true
  }

  if (healed) {
    try {
      writeStorage(KEY_SKILL, JSON.stringify(model))
    } catch {
      // Return the filled model even when the write-back throws.
    }
  }
  return model
}

export function loadSkillModel(): UserSkillModel {
  ensureStorageKeysMigrated()
  const raw = safeParse<unknown>(readStorage(KEY_SKILL))

  const parsed = raw as Partial<UserSkillModel> | null
  if (parsed && parsed.version === 2) return skillModelFromV2(parsed)

  // Lightweight migration from v1 -> v2.
  const v1 = raw as { version?: number } | null
  if (v1 && v1.version === 1) {
    const migrated = migrateSkillModelV1ToV2(v1 as unknown as UserSkillModelV1)
    try {
      localStorage.setItem(KEY_SKILL, JSON.stringify(migrated))
    } catch {
      // ignore
    }
    return migrated
  }

  const fresh = defaultSkillModel()
  try {
    localStorage.setItem(KEY_SKILL, JSON.stringify(fresh))
  } catch {
    // ignore
  }
  return fresh
}

export function saveSkillModel(model: UserSkillModel): boolean {
  return writeStorage(KEY_SKILL, JSON.stringify(model))
}

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

function isWellFormedPreferences(input: Partial<Preferences>): boolean {
  const sanitized = sanitizePreferences(input)
  const live = input.showLiveWpm
  if (!live || typeof live !== 'object') return false
  if (typeof live.focus !== 'boolean' || live.focus !== sanitized.showLiveWpm.focus) return false
  if (typeof live.real_life !== 'boolean' || live.real_life !== sanitized.showLiveWpm.real_life) return false
  if (typeof live.competitive !== 'boolean' || live.competitive !== sanitized.showLiveWpm.competitive) return false

  const keys: (keyof Preferences)[] = [
    'soundEnabled',
    'volume',
    'keyboardVoice',
    'bellOnCompletion',
    'ambientEnabled',
    'ambientCategory',
    'ambientVolume',
    'ambientPauseOnTyping',
    'fontScale',
    'screenReaderMode',
    'reducedMotion',
    'focusMinimalHud',
    'competitiveSprintDurationMs',
    'competitiveGhostEnabled',
  ]
  for (const key of keys) {
    if (input[key] !== sanitized[key]) return false
  }
  return true
}

export function loadPreferences(): Preferences {
  ensureStorageKeysMigrated()
  const parsed = safeParse<Partial<Preferences>>(readStorage(KEY_PREFS))

  if (parsed && isWellFormedPreferences(parsed)) {
    const sanitized = sanitizePreferences(parsed)
    const json = JSON.stringify(sanitized)
    writeStorage(KEY_PREFS, json)
    writeStorage(KEY_PREFS_LKG, json)
    return sanitized
  }

  // A readable but illegal value is corrected in place. The backup stays the last good save.
  if (parsed) {
    const sanitized = sanitizePreferences(parsed)
    writeStorage(KEY_PREFS, JSON.stringify(sanitized))
    return sanitized
  }

  const backup = safeParse<Partial<Preferences>>(readStorage(KEY_PREFS_LKG))
  if (backup) {
    const sanitized = sanitizePreferences(backup)
    writeStorage(KEY_PREFS, JSON.stringify(sanitized))
    return sanitized
  }

  const fresh = sanitizePreferences(null)
  const json = JSON.stringify(fresh)
  writeStorage(KEY_PREFS, json)
  writeStorage(KEY_PREFS_LKG, json)
  return fresh
}

export function savePreferences(prefs: Preferences): boolean {
  const sanitized = sanitizePreferences(prefs)
  const json = JSON.stringify(sanitized)
  const live = writeStorage(KEY_PREFS, json)
  // last known good snapshot
  const backup = writeStorage(KEY_PREFS_LKG, json)
  return live && backup
}

export function resetPreferencesToDefaults() {
  savePreferences(DEFAULT_PREFS)
  return DEFAULT_PREFS
}

export function loadRuns(): RunResult[] {
  ensureStorageKeysMigrated()
  const parsed = safeParse<unknown>(readStorage(KEY_RUNS))
  if (!Array.isArray(parsed)) return []

  const out: RunResult[] = []
  for (const item of parsed) {
    const r = item as Partial<RunResult> | null
    if (!r) continue
    if (typeof r.exercise_id !== 'string' || r.exercise_id.length === 0) continue
    if (r.mode !== 'focus' && r.mode !== 'real_life' && r.mode !== 'competitive') continue
    const timestamp = r.timestamp
    const wpm = r.wpm
    const accuracy = r.accuracy
    const errors = r.errors
    const backspaces = r.backspaces
    const durationMs = r.duration_ms
    if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) continue
    if (typeof wpm !== 'number' || !Number.isFinite(wpm)) continue
    if (typeof accuracy !== 'number' || !Number.isFinite(accuracy)) continue
    if (typeof errors !== 'number' || !Number.isFinite(errors)) continue
    if (typeof backspaces !== 'number' || !Number.isFinite(backspaces)) continue
    if (typeof durationMs !== 'number' || !Number.isFinite(durationMs)) continue

    out.push({
      v: r.v === 2 ? 2 : undefined,
      exercise_id: r.exercise_id,
      timestamp,
      mode: r.mode,
      rendered_text_hash: typeof r.rendered_text_hash === 'string' ? r.rendered_text_hash : undefined,
      wpm,
      accuracy: clamp(accuracy, 0, 1),
      errors: Math.max(0, Math.floor(errors)),
      backspaces: Math.max(0, Math.floor(backspaces)),
      duration_ms: Math.max(0, Math.floor(durationMs)),
      tags_hit: Array.isArray(r.tags_hit) ? r.tags_hit.filter((t): t is string => typeof t === 'string') : undefined,
      sprint_duration_ms:
        r.sprint_duration_ms === 30_000 || r.sprint_duration_ms === 60_000 || r.sprint_duration_ms === 120_000
          ? r.sprint_duration_ms
          : undefined,
    })
  }

  return out
}

export function appendRun(run: RunResult): boolean {
  const runs = loadRuns()
  runs.push({ ...run, v: 2 })
  // keep it bounded
  const trimmed = runs.slice(Math.max(0, runs.length - 5000))
  return writeStorage(KEY_RUNS, JSON.stringify(trimmed))
}

const RECENT_MODES = ['focus', 'real_life', 'competitive'] as const

function emptyRecents(): RecentHistory {
  return {
    byMode: {
      focus: [],
      real_life: [],
      competitive: [],
    },
  }
}

function recentIds(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  const ids: string[] = []
  for (const item of value) {
    if (typeof item === 'string') ids.push(item)
  }
  return ids
}

export function loadRecents(): RecentHistory {
  ensureStorageKeysMigrated()
  const parsed = safeParse<unknown>(readStorage(KEY_RECENTS))
  const recents = emptyRecents()
  if (parsed == null || typeof parsed !== 'object') return recents
  const byMode = (parsed as { byMode?: unknown }).byMode
  if (byMode == null || typeof byMode !== 'object') return recents
  const raw = byMode as Record<string, unknown>
  for (const mode of RECENT_MODES) {
    const ids = recentIds(raw[mode])
    if (ids) recents.byMode[mode] = ids
  }
  return recents
}

export function pushRecent(mode: Mode, exerciseId: string): boolean {
  const recents = loadRecents()
  const existing = recents.byMode[mode] ?? []
  const next = [exerciseId, ...existing.filter((id) => id !== exerciseId)].slice(0, 200)
  recents.byMode[mode] = next
  return writeStorage(KEY_RECENTS, JSON.stringify(recents))
}

export function loadLastMode(): Mode | null {
  ensureStorageKeysMigrated()
  const raw = readStorage(KEY_LAST_MODE)
  if (raw === 'focus' || raw === 'real_life' || raw === 'competitive') return raw
  return null
}

export function saveLastMode(mode: Mode): boolean {
  return writeStorage(KEY_LAST_MODE, mode)
}

function pbKey(exerciseId: string, sprintDurationMs?: SprintDurationMs) {
  return `${exerciseId}|${sprintDurationMs ?? 0}`
}

function isPersonalBest(value: unknown): value is PersonalBest {
  if (value == null || typeof value !== 'object') return false
  const row = value as Partial<PersonalBest>
  if (typeof row.exercise_id !== 'string' || row.exercise_id.length === 0) return false
  if (typeof row.wpm !== 'number' || !Number.isFinite(row.wpm)) return false
  if (typeof row.accuracy !== 'number' || !Number.isFinite(row.accuracy)) return false
  if (typeof row.timestamp !== 'number' || !Number.isFinite(row.timestamp)) return false
  if (
    row.sprint_duration_ms != null &&
    row.sprint_duration_ms !== 30_000 &&
    row.sprint_duration_ms !== 60_000 &&
    row.sprint_duration_ms !== 120_000
  ) {
    return false
  }
  return true
}

export function loadPersonalBests(): PersonalBestsStore {
  ensureStorageKeysMigrated()
  const parsed = safeParse<unknown>(readStorage(KEY_PBS))
  const byKey: Record<string, PersonalBest> = {}
  if (parsed == null || typeof parsed !== 'object') return { byKey }
  const raw = (parsed as { byKey?: unknown }).byKey
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return { byKey }
  for (const [key, value] of Object.entries(raw)) {
    if (!isPersonalBest(value)) continue
    const best: PersonalBest = {
      exercise_id: value.exercise_id,
      wpm: value.wpm,
      accuracy: value.accuracy,
      timestamp: value.timestamp,
    }
    if (
      value.sprint_duration_ms === 30_000 ||
      value.sprint_duration_ms === 60_000 ||
      value.sprint_duration_ms === 120_000
    ) {
      best.sprint_duration_ms = value.sprint_duration_ms
    }
    byKey[key] = best
  }
  return { byKey }
}

export function getPersonalBest(exerciseId: string, sprintDurationMs?: SprintDurationMs) {
  const store = loadPersonalBests()
  return store.byKey[pbKey(exerciseId, sprintDurationMs)] ?? null
}

export function maybeUpdatePersonalBest(params: {
  exerciseId: string
  sprintDurationMs?: SprintDurationMs
  wpm: number
  accuracy: number
  timestamp: number
}) {
  // PB guard: best WPM at accuracy >= 95%
  if (params.accuracy < 0.95) {
    return { updated: false as const, previous: getPersonalBest(params.exerciseId, params.sprintDurationMs) }
  }

  const store = loadPersonalBests()
  const key = pbKey(params.exerciseId, params.sprintDurationMs)
  const prev = store.byKey[key]

  if (!prev || params.wpm > prev.wpm) {
    store.byKey[key] = {
      exercise_id: params.exerciseId,
      sprint_duration_ms: params.sprintDurationMs,
      wpm: params.wpm,
      accuracy: params.accuracy,
      timestamp: params.timestamp,
    }
    const saved = writeStorage(KEY_PBS, JSON.stringify(store))
    return { updated: saved, saved, previous: prev ?? null }
  }

  return { updated: false as const, saved: true as const, previous: prev ?? null }
}

export function topCompetitiveRuns(params: { durationMs: SprintDurationMs; limit: number }) {
  const runs = loadRuns()
    .filter((r) => r.mode === 'competitive' && r.sprint_duration_ms === params.durationMs)
    .sort((a, b) => b.wpm - a.wpm)

  return runs.slice(0, params.limit)
}

export function bestAccuracyForExercise(exerciseId: string, sprintDurationMs?: SprintDurationMs) {
  const runs = loadRuns().filter(
    (r) => r.exercise_id === exerciseId && (r.sprint_duration_ms ?? undefined) === sprintDurationMs,
  )
  if (runs.length === 0) return null
  return runs.reduce((best, r) => Math.max(best, r.accuracy), 0)
}

export function bestWpmForExercise(exerciseId: string, sprintDurationMs?: SprintDurationMs) {
  const runs = loadRuns().filter(
    (r) => r.exercise_id === exerciseId && (r.sprint_duration_ms ?? undefined) === sprintDurationMs,
  )
  if (runs.length === 0) return null
  return runs.reduce((best, r) => Math.max(best, r.wpm), 0)
}
