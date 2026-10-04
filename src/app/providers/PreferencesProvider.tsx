import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { loadPreferences, sanitizePreferences, savePreferences, type Preferences } from '@lib-internal/storage'

const PREFS_NOT_KEPT = 'That change was not kept. The previous settings are still in effect.'

type PreferencesContextValue = {
  prefs: Preferences
  preferenceStatus: string | null
  setPrefs: (next: Preferences) => void
  patchPrefs: (patch: Partial<Preferences>) => void
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null)

function mergePreferences(prev: Preferences, patch: Partial<Preferences>): Preferences {
  return sanitizePreferences({
    ...prev,
    ...patch,
    showLiveWpm: {
      ...prev.showLiveWpm,
      ...(patch.showLiveWpm ?? {}),
    },
  })
}

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefsState] = useState<Preferences>(() => loadPreferences())
  const [preferenceStatus, setPreferenceStatus] = useState<string | null>(null)
  const prefsRef = useRef(prefs)
  prefsRef.current = prefs

  useEffect(() => {
    const root = document.documentElement
    if (prefs.reducedMotion) root.classList.add('reduce-motion')
    else root.classList.remove('reduce-motion')
    return () => {
      root.classList.remove('reduce-motion')
    }
  }, [prefs.reducedMotion])

  const commit = useCallback((next: Preferences) => {
    if (!savePreferences(next)) {
      setPreferenceStatus(PREFS_NOT_KEPT)
      return
    }
    setPreferenceStatus(null)
    prefsRef.current = next
    setPrefsState(next)
  }, [])

  const setPrefs = useCallback((next: Preferences) => {
    commit(sanitizePreferences(next))
  }, [commit])

  const patchPrefs = useCallback((patch: Partial<Preferences>) => {
    commit(mergePreferences(prefsRef.current, patch))
  }, [commit])

  const value = { prefs, preferenceStatus, setPrefs, patchPrefs }
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePreferences() {
  const ctx = useContext(PreferencesContext)
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider')
  return ctx
}
