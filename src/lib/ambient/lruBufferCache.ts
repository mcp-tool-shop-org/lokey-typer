/**
 * LRU (Least Recently Used) cache for decoded AudioBuffers.
 *
 * Keeps at most `maxSize` entries. On insert at capacity, the
 * least-recently-accessed entry is evicted. This bounds memory
 * when the ambient library has 100-200 tracks.
 */
export class LRUBufferCache {
  private cache = new Map<string, AudioBuffer>()
  private maxSize: number

  constructor(maxSize = 5) {
    this.maxSize = Math.max(1, maxSize)
  }

  get(key: string): AudioBuffer | undefined {
    const buf = this.cache.get(key)
    if (!buf) return undefined

    // Move to end (most recently used).
    this.cache.delete(key)
    this.cache.set(key, buf)
    return buf
  }

  set(key: string, buffer: AudioBuffer): void {
    // If already present, delete first so re-insert moves to end.
    if (this.cache.has(key)) this.cache.delete(key)

    // Evict oldest if at capacity.
    while (this.cache.size >= this.maxSize) {
      const oldest = this.cache.keys().next().value
      if (oldest != null) this.cache.delete(oldest)
      else break
    }

    this.cache.set(key, buffer)
  }

  has(key: string): boolean {
    return this.cache.has(key)
  }

  clear(): void {
    this.cache.clear()
  }

  get size(): number {
    return this.cache.size
  }
}
