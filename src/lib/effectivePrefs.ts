export type AccessibilityLockPrefs = {
  ambientEnabled: boolean
  screenReaderMode: boolean
  reducedMotion: boolean
}

export function isAmbientLockedOff(prefs: Pick<AccessibilityLockPrefs, 'screenReaderMode' | 'reducedMotion'>) {
  // Screen reader mode forces ambient off.
  // Reduced motion keeps ambient allowed, but should disable macro evolutions.
  return Boolean(prefs.screenReaderMode)
}

export function enforceAccessibilityLocks<T extends AccessibilityLockPrefs>(prefs: T): T {
  if (isAmbientLockedOff(prefs) && prefs.ambientEnabled) return { ...prefs, ambientEnabled: false }
  return prefs
}

export function getEffectiveAmbientEnabled(prefs: AccessibilityLockPrefs) {
  return enforceAccessibilityLocks(prefs).ambientEnabled
}
