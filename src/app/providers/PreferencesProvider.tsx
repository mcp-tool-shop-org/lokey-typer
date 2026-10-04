import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { loadPreferences, sanitizePreferences, savePreferences, type Preferences } from '@lib-internal/storage'

type PreferencesContextValue = {
  prefs: Preferences
  setPrefs: (next: Preferences) => void
  patchPrefs: (patch: Partial<Preferences>) => void
  prefsSaveNote: string | null
}

const PREFS_NOT_KEPT = 'That change was not kept.'

const PreferencesContext = createContext<PreferencesContextValue | null>(null)

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefsState] = useState<Preferences>(() => loadPreferences())
  const [prefsSaveNote, setPrefsSaveNote] = useState<string | null>(null)
  const prefsRef = useRef(prefs)

  useEffect(() => {
    const root = document.documentElement
    if (prefs.reducedMotion) root.classList.add('reduce-motion')
    else root.classList.remove('reduce-motion')
    return () => {
      root.classList.remove('reduce-motion')
    }
  }, [prefs.reducedMotion])

  const commit = useCallback((next: Preferences) => {
    const sanitized = sanitizePreferences(next)
    if (!savePreferences(sanitized)) {
      setPrefsSaveNote(PREFS_NOT_KEPT)
      return
    }
    setPrefsSaveNote(null)
    prefsRef.current = sanitized
    setPrefsState(sanitized)
  }, [])

  const setPrefs = useCallback((next: Preferences) => {
    commit(next)
  }, [commit])

  const patchPrefs = useCallback((patch: Partial<Preferences>) => {
    const prev = prefsRef.current
    const next: Preferences = {
      ...prev,
      ...patch,
      showLiveWpm: {
        ...prev.showLiveWpm,
        ...(patch.showLiveWpm ?? {}),
      },
    }
    commit(next)
  }, [commit])

  const value = { prefs, setPrefs, patchPrefs, prefsSaveNote }
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePreferences() {
  const ctx = useContext(PreferencesContext)
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider')
  return ctx
}
