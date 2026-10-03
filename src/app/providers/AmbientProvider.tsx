import { createContext, useCallback, useContext, useEffect, useRef } from 'react'
import { ambientPlayer } from '@lib-internal/ambient'
import { resumeAudioContext } from '@lib-internal/audioContext'
import { getEffectiveAmbientEnabled } from '@lib-internal/effectivePrefs'
import { usePreferences } from './PreferencesProvider'

type AmbientContextValue = {
  noteTypingActivity: () => void
  skipTrack: () => void
}

const AmbientContext = createContext<AmbientContextValue>({
  noteTypingActivity: () => {},
  skipTrack: () => {},
})

export function AmbientProvider({ children }: { children: React.ReactNode }) {
  const { prefs } = usePreferences()
  const startedRef = useRef(false)

  // Sync preferences to engine on every change.
  useEffect(() => {
    ambientPlayer.setPreferences({
      enabled: getEffectiveAmbientEnabled(prefs),
      volume: prefs.ambientVolume,
      category: prefs.ambientCategory,
      pauseOnTyping: prefs.ambientPauseOnTyping,
      reducedMotion: Boolean(prefs.reducedMotion),
      screenReaderMode: Boolean(prefs.screenReaderMode),
    })
  }, [prefs])

  // One-time user gesture unlock: first click, tap, or keypress starts ambient.
  useEffect(() => {
    if (startedRef.current) return

    const unlock = async () => {
      if (startedRef.current) return
      startedRef.current = true
      console.log('[ambient] unlock triggered — user gesture received')
      // Resume audio context inside the user gesture, then start ambient.
      await resumeAudioContext()
      await ambientPlayer.start()
      cleanup()
    }

    const cleanup = () => {
      window.removeEventListener('click', unlock)
      window.removeEventListener('keydown', unlock)
      window.removeEventListener('touchstart', unlock)
    }

    window.addEventListener('click', unlock)
    window.addEventListener('keydown', unlock)
    window.addEventListener('touchstart', unlock)

    return cleanup
  }, [])

  const noteTypingActivity = useCallback(() => {
    ambientPlayer.noteTypingActivity()
  }, [])

  const skipTrack = useCallback(() => {
    void ambientPlayer.skipTrack()
  }, [])

  return (
    <AmbientContext.Provider value={{ noteTypingActivity, skipTrack }}>
      {children}
    </AmbientContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAmbient() {
  return useContext(AmbientContext)
}
