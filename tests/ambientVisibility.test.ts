// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

describe('ambient visibility', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('pauses the room when the tab is hidden and lets it return when the tab is visible', async () => {
    const { ambientPlayer } = await import('../src/lib/ambient')
    const paused = vi.spyOn(ambientPlayer, 'setVisibilityPaused')

    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(paused).toHaveBeenLastCalledWith(true)

    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(paused).toHaveBeenLastCalledWith(false)
  })
})
