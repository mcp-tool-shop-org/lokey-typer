import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { ambientPlayer } from '@lib-internal/ambient'
import { ambientCategoriesInTracks, fetchAmbientManifest } from '@lib-internal/ambientManifest'
import { resumeAudioContext } from '@lib-internal/audioContext'
import { getEffectiveAmbientEnabled } from '@lib-internal/effectivePrefs'
import { usePreferences } from './PreferencesProvider'

type AmbientContextValue = {
  noteTypingActivity: () => void
  skipTrack: () => void
  unlockFailed: boolean
}

const AmbientContext = createContext<AmbientContextValue>({
  noteTypingActivity: () => {},
  skipTrack: () => {},
  unlockFailed: false,
})

function playbackMarkedStarted(): boolean {
  const player = ambientPlayer as { isStarted?: () => boolean }
  if (typeof player.isStarted !== 'function') return true
  return player.isStarted()
}

export function AmbientProvider({ children }: { children: React.ReactNode }) {
  const { prefs, patchPrefs } = usePreferences()
  const startedRef = useRef(false)
  const unlockingRef = useRef(false)
  const [unlockFailed, setUnlockFailed] = useState(false)

  // A saved category that the library does not ship (campfire, café, night) falls back to the whole library.
  useEffect(() => {
    if (prefs.ambientCategory === 'all') return
    const category = prefs.ambientCategory
    let cancelled = false
    void fetchAmbientManifest().then((manifest) => {
      if (cancelled || !manifest) return
      const offered = ambientCategoriesInTracks(manifest.tracks)
      if (!offered.includes(category)) patchPrefs({ ambientCategory: 'all' })
    })
    return () => {
      cancelled = true
    }
  }, [patchPrefs, prefs.ambientCategory])

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

  // Gesture unlock stays armed until start() has marked the player started.
  // A rejected resume, or a start() that returns before that, can be retried.
  useEffect(() => {
    if (startedRef.current) return
    let cancelled = false

    const cleanup = () => {
      window.removeEventListener('click', unlock)
      window.removeEventListener('keydown', unlock)
      window.removeEventListener('touchstart', unlock)
    }

    const unlock = async () => {
      if (startedRef.current || unlockingRef.current) return
      unlockingRef.current = true
      console.log('[ambient] unlock triggered — user gesture received')
      try {
        await resumeAudioContext()
        await ambientPlayer.start()
        if (!playbackMarkedStarted()) {
          if (!cancelled) setUnlockFailed(true)
          return
        }
        if (cancelled) return
        startedRef.current = true
        setUnlockFailed(false)
        cleanup()
      } catch (err) {
        console.warn('[ambient] unlock failed', err)
        if (!cancelled) setUnlockFailed(true)
      } finally {
        unlockingRef.current = false
      }
    }

    window.addEventListener('click', unlock)
    window.addEventListener('keydown', unlock)
    window.addEventListener('touchstart', unlock)

    return () => {
      cancelled = true
      cleanup()
    }
  }, [])

  const noteTypingActivity = useCallback(() => {
    ambientPlayer.noteTypingActivity()
  }, [])

  const skipTrack = useCallback(() => {
    void ambientPlayer.skipTrack()
  }, [])

  return (
    <AmbientContext.Provider value={{ noteTypingActivity, skipTrack, unlockFailed }}>
      {children}
    </AmbientContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAmbient() {
  return useContext(AmbientContext)
}
