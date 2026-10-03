import { AmbientPlayerV3 } from './ambient/ambientPlayerV3'

export const ambientPlayer = new AmbientPlayerV3()

// Global visibility hook (fail-safe; silence when tab is not active).
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    ambientPlayer.setVisibilityPaused(document.hidden)
  })
}
