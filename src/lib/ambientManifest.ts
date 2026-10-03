export type AmbientCategory =
  | 'rain'
  | 'campfire'
  | 'forest'
  | 'ocean'
  | 'binaural'
  | 'singing_bowls'
  | 'wind'
  | 'cafe'
  | 'night'
  | 'white_noise'
  | 'other'

export const AMBIENT_CATEGORIES: AmbientCategory[] = [
  'rain',
  'campfire',
  'forest',
  'ocean',
  'binaural',
  'singing_bowls',
  'wind',
  'cafe',
  'night',
  'white_noise',
  'other',
]

export const AMBIENT_CATEGORY_LABELS: Record<AmbientCategory, string> = {
  rain: 'Rain',
  campfire: 'Campfire',
  forest: 'Forest',
  ocean: 'Ocean',
  binaural: 'Binaural Beats',
  singing_bowls: 'Singing Bowls',
  wind: 'Wind',
  cafe: 'Café',
  night: 'Night',
  white_noise: 'White Noise',
  other: 'Other',
}

export type AmbientTrack = {
  id: string
  title: string
  category: AmbientCategory
  tags: string[]
  path: string
  duration_sec: number
  lufs_i?: number
}

export type AmbientManifestV3 = {
  version: number
  tracks: AmbientTrack[]
}

function isCategory(x: unknown): x is AmbientCategory {
  return typeof x === 'string' && (AMBIENT_CATEGORIES as string[]).includes(x)
}

export async function fetchAmbientManifest(
  url = `${import.meta.env.BASE_URL}audio/ambient/manifest.json`,
): Promise<AmbientManifestV3 | null> {
  try {
    const res = await fetch(url, { cache: 'no-cache' })
    if (!res.ok) return null
    const raw = (await res.json()) as unknown

    const m = raw as Partial<AmbientManifestV3> | null
    if (!m || typeof m.version !== 'number' || !Number.isFinite(m.version)) return null
    if (!Array.isArray(m.tracks)) return null

    const tracks: AmbientTrack[] = []
    for (const t0 of m.tracks) {
      const t = t0 as Partial<AmbientTrack> | null
      if (!t) continue
      if (typeof t.id !== 'string' || t.id.length === 0) continue
      if (typeof t.title !== 'string') continue
      if (!isCategory(t.category)) continue
      if (typeof t.path !== 'string' || t.path.length === 0) continue
      if (typeof t.duration_sec !== 'number' || !Number.isFinite(t.duration_sec)) continue

      tracks.push({
        id: t.id,
        title: t.title,
        category: t.category,
        tags: Array.isArray(t.tags) ? t.tags.filter((s): s is string => typeof s === 'string') : [],
        path: t.path,
        duration_sec: t.duration_sec,
        lufs_i: Number.isFinite(t.lufs_i) ? t.lufs_i : undefined,
      })
    }

    return { version: m.version, tracks }
  } catch {
    return null
  }
}
