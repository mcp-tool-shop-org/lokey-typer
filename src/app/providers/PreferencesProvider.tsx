import { createContext, useContext, useState } from 'react'
import { loadPreferences, sanitizePreferences, savePreferences, type Preferences } from '@lib-internal/storage'

type PreferencesContextValue = {
  prefs: Preferences
  setPrefs: (next: Preferences) => void
  patchPrefs: (patch: Partial<Preferences>) => void
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null)

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefsState] = useState<Preferences>(() => loadPreferences())

  const setPrefs = (next: Preferences) => {
    const sanitized = sanitizePreferences(next)
    setPrefsState(sanitized)
    savePreferences(sanitized)
  }

  const patchPrefs = (patch: Partial<Preferences>) => {
    setPrefsState((prev) => {
      const next: Preferences = {
        ...prev,
        ...patch,
        showLiveWpm: {
          ...prev.showLiveWpm,
          ...(((patch as Partial<Preferences>).showLiveWpm as Partial<Preferences['showLiveWpm']> | undefined) ?? {}),
        },
      }

      const sanitized = sanitizePreferences(next)
      savePreferences(sanitized)
      return sanitized
    })
  }

  const value = { prefs, setPrefs, patchPrefs }
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePreferences() {
  const ctx = useContext(PreferencesContext)
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider')
  return ctx
}
