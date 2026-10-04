import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

type Track = {
  id: string
  category: string
  path: string
  duration_sec: number
}

const manifest = JSON.parse(
  readFileSync(new URL('../public/audio/ambient/manifest.json', import.meta.url), 'utf8'),
) as { version: number; tracks: Track[] }

const longBedIds = [
  'ocean_night_stones',
  'rain_wet_leaves',
  'rain_wooden_roof',
  'zen_bronze_sustain',
  'binaural_alpha_ten',
]

describe('shipped ambient catalog', () => {
  it('keeps version 3, unique beds, and at least one bed long enough to hold', () => {
    expect(manifest.version).toBe(3)
    const ids = manifest.tracks.map((track) => track.id)
    const paths = manifest.tracks.map((track) => track.path)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(paths).size).toBe(paths.length)

    for (const track of manifest.tracks) {
      expect(track.duration_sec).toBeGreaterThan(0)
      expect(track.path.startsWith('/audio/ambient/')).toBe(true)
    }

    const longBeds = manifest.tracks.filter((track) => track.duration_sec >= 180)
    expect(longBeds.length).toBeGreaterThanOrEqual(longBedIds.length)
    for (const id of longBedIds) {
      expect(manifest.tracks.find((track) => track.id === id)?.duration_sec).toBe(180)
    }

    const categories = new Set(manifest.tracks.map((track) => track.category))
    for (const name of ['rain', 'forest', 'ocean', 'binaural', 'singing_bowls', 'wind', 'white_noise', 'other']) {
      expect(categories.has(name)).toBe(true)
    }
    for (const name of ['campfire', 'cafe', 'night']) {
      expect(categories.has(name)).toBe(false)
    }
  })
})
