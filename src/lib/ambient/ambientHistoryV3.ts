/**
 * Cross-session history for the V3 ambient player.
 *
 * Tracks recently-played track IDs in localStorage so the player
 * avoids repeating the same soundscape across app reloads.
 * Mode-independent (ambient is app-wide now).
 */

const STORAGE_KEY = 'lkt_ambient_history_v3'
const MAX_ENTRIES = 200

type HistoryEntry = { id: string; atMs: number }

type PersistedHistory = {
  recentTracks: HistoryEntry[]
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function loadPersisted(): PersistedHistory {
  try {
    if (typeof localStorage === 'undefined') return { recentTracks: [] }
    const parsed = safeParse<PersistedHistory>(localStorage.getItem(STORAGE_KEY))
    if (!parsed || !Array.isArray(parsed.recentTracks)) return { recentTracks: [] }

    return {
      recentTracks: parsed.recentTracks
        .filter(
          (e): e is HistoryEntry =>
            typeof e?.id === 'string' &&
            e.id.length > 0 &&
            typeof e?.atMs === 'number' &&
            Number.isFinite(e.atMs) &&
            e.atMs > 0,
        )
        .slice(0, MAX_ENTRIES),
    }
  } catch {
    return { recentTracks: [] }
  }
}

function savePersisted(data: PersistedHistory) {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // ignore
  }
}

export class AmbientHistoryV3 {
  /** Was this track played within the last `withinN` entries? */
  wasPlayedRecently(trackId: string, withinN = 50): boolean {
    const { recentTracks } = loadPersisted()
    return recentTracks.slice(0, withinN).some((e) => e.id === trackId)
  }

  /** Was this track played within the last `windowMs` milliseconds? */
  wasPlayedWithinMs(trackId: string, windowMs: number): boolean {
    const { recentTracks } = loadPersisted()
    const cutoff = Date.now() - Math.max(0, windowMs)
    return recentTracks.some((e) => e.id === trackId && e.atMs >= cutoff)
  }

  /** Record that this track was just played. */
  noteTrackPlayed(trackId: string): void {
    const persisted = loadPersisted()
    const nowMs = Date.now()
    const next = [
      { id: trackId, atMs: nowMs },
      ...persisted.recentTracks.filter((e) => e.id !== trackId),
    ].slice(0, MAX_ENTRIES)

    savePersisted({ recentTracks: next })
  }
}
