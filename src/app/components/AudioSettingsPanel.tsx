import { useEffect, useRef, useState } from 'react'
import { usePreferences } from '@app/providers/PreferencesProvider'
import { KEYBOARD_VOICE_CHOICES, typewriterAudio, type KeyboardVoice } from '@lib'
import {
  AMBIENT_CATEGORY_LABELS,
  ambientCategoriesInTracks,
  fetchAmbientManifest,
  type AmbientCategory,
} from '@lib-internal/ambientManifest'
import type { Preferences } from '@lib-internal/storage'

function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <label className={`flex items-center justify-between gap-3 py-1.5 ${disabled ? 'opacity-60' : ''}`}>
      <span className="text-sm text-zinc-400">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition ${checked ? 'bg-emerald-600' : 'bg-zinc-700'} ${disabled ? 'cursor-not-allowed' : ''}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition ${checked ? 'translate-x-4' : ''}`}
        />
      </button>
    </label>
  )
}

function Slider({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  const pct = Math.round(value * 100)
  return (
    <label className="flex flex-col gap-1.5 py-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-400">{label}</span>
        <span className="text-xs tabular-nums text-zinc-400">{pct}%</span>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        step="1"
        value={pct}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="w-full accent-zinc-400"
        aria-label={label}
        aria-valuetext={`${pct}%`}
      />
    </label>
  )
}

const FONT_SCALES: { value: Preferences['fontScale']; label: string }[] = [
  { value: 0.9, label: 'Smaller' },
  { value: 1, label: 'Default' },
  { value: 1.1, label: 'Larger' },
]

const FOCUSABLE_SELECTOR = 'button, input, select, textarea, a[href], [tabindex]'

function focusableControls(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((el) => {
    if (el.getAttribute('tabindex') === '-1') return false
    if ('disabled' in el && (el as { disabled?: boolean }).disabled) return false
    return true
  })
}

export function AudioSettingsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { prefs, patchPrefs, preferenceStatus } = usePreferences()
  const panelRef = useRef<HTMLDivElement>(null)
  const [offeredCategories, setOfferedCategories] = useState<AmbientCategory[] | null>(null)
  const [categoryLoad, setCategoryLoad] = useState<'loading' | 'ready' | 'failed'>('loading')
  const wasOpen = useRef(false)
  if (wasOpen.current !== open) {
    wasOpen.current = open
    if (open) setCategoryLoad('loading')
  }

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setCategoryLoad('loading')
    void fetchAmbientManifest()
      .then((manifest) => {
        if (cancelled) return
        if (!manifest) {
          setCategoryLoad('failed')
          return
        }
        setOfferedCategories(ambientCategoriesInTracks(manifest.tracks))
        setCategoryLoad('ready')
      })
      .catch(() => {
        if (!cancelled) setCategoryLoad('failed')
      })
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const root = panelRef.current
      if (!root) return
      const focusable = focusableControls(root)
      if (focusable.length === 0) {
        e.preventDefault()
        return
      }
      const active = document.activeElement
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey) {
        if (active === first || !root.contains(active)) {
          e.preventDefault()
          last.focus()
        }
        return
      }
      if (active === last || !root.contains(active)) {
        e.preventDefault()
        first.focus()
      }
    }
    // Capture so Escape never reaches the typing field, which treats it as exit.
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open, onClose])

  useEffect(() => {
    if (open) {
      // Focus the first interactive element on open
      const first = panelRef.current?.querySelector<HTMLElement>('button, input, select')
      first?.focus()
    }
  }, [open])

  if (!open) return null

  function chooseKeyboard(voice: KeyboardVoice) {
    patchPrefs({ keyboardVoice: voice })
    const preview = {
      enabled: true,
      volume: prefs.volume,
      modeGain: 1,
      keyboardVoice: voice,
    }
    void typewriterAudio.ensureReady().then(() => typewriterAudio.resume()).then(() => {
      typewriterAudio.play('key', preview)
    })
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} aria-hidden="true" />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        data-aiui-goal="audio_settings_open"
        className="fixed right-4 top-20 z-50 max-h-[calc(100vh-6rem)] w-80 overflow-y-auto rounded-2xl border border-zinc-800/50 bg-zinc-900 p-5 shadow-2xl"
      >
        {preferenceStatus ? (
          <p role="status" className="mb-3 text-sm text-zinc-300">
            {preferenceStatus}
          </p>
        ) : null}

        {/* Keystroke Sounds */}
        <h3 className="mb-3 text-sm font-semibold text-zinc-200">Keystroke Sounds</h3>
        <div className="space-y-0.5">
          <Toggle
            checked={prefs.soundEnabled}
            onChange={(v) => patchPrefs({ soundEnabled: v })}
            label="Keystroke sounds"
          />
          <Slider
            value={prefs.volume}
            onChange={(v) => patchPrefs({ volume: v })}
            label="Keystroke volume"
          />
          <div className="flex flex-col gap-1.5 py-1.5">
            <span className="text-sm text-zinc-400">Keyboard</span>
            <div className="grid grid-cols-2 gap-1" role="radiogroup" aria-label="Keyboard">
              {KEYBOARD_VOICE_CHOICES.map((choice) => {
                const selected = prefs.keyboardVoice === choice.id
                return (
                  <button
                    key={choice.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={`${choice.label}. ${choice.hint}`}
                    onClick={() => chooseKeyboard(choice.id)}
                    className={`rounded-lg px-2 py-1.5 text-left text-xs outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50 ${selected ? 'bg-zinc-700 text-zinc-100' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'}`}
                  >
                    <span className="block">{choice.label}</span>
                    <span className="block">{choice.hint}</span>
                  </button>
                )
              })}
            </div>
          </div>
          <Toggle
            checked={prefs.bellOnCompletion}
            onChange={(v) => patchPrefs({ bellOnCompletion: v })}
            label="Completion bell"
          />
        </div>

        {/* Divider */}
        <div className="my-4 h-px bg-zinc-800/50" />

        {/* Ambient Soundscapes */}
        <h3 className="mb-3 text-sm font-semibold text-zinc-200">Ambient Soundscapes</h3>
        <div className="space-y-0.5">
          <Toggle
            checked={prefs.ambientEnabled}
            disabled={prefs.screenReaderMode}
            onChange={(v) => patchPrefs({ ambientEnabled: v })}
            label="Ambient sounds"
          />
          {prefs.screenReaderMode ? (
            <p className="py-1 text-xs leading-relaxed text-zinc-400">Screen reader mode keeps the soundscape off.</p>
          ) : null}
          <Slider
            value={prefs.ambientVolume}
            onChange={(v) => patchPrefs({ ambientVolume: v })}
            label="Ambient volume"
          />
          <div className="flex flex-col gap-1.5 py-1.5">
            <span className="text-sm text-zinc-400">Category</span>
            {categoryLoad === 'loading' ? (
              <p className="text-sm text-zinc-300">Loading categories</p>
            ) : categoryLoad === 'failed' ? (
              <>
                <p className="text-sm text-zinc-200">
                  {prefs.ambientCategory === 'all' ? 'All categories' : AMBIENT_CATEGORY_LABELS[prefs.ambientCategory]}
                </p>
                <p className="text-xs leading-relaxed text-zinc-300">
                  The category list did not load. Close settings and open it again to try.
                </p>
              </>
            ) : (
              <select
                value={
                  prefs.ambientCategory === 'all' || (offeredCategories ?? []).includes(prefs.ambientCategory)
                    ? prefs.ambientCategory
                    : 'all'
                }
                onChange={(e) => patchPrefs({ ambientCategory: e.target.value as AmbientCategory | 'all' })}
                className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50"
                aria-label="Ambient category"
              >
                <option value="all">All categories</option>
                {(offeredCategories ?? []).map((cat) => (
                  <option key={cat} value={cat}>
                    {AMBIENT_CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>
            )}
          </div>
          <Toggle
            checked={prefs.ambientPauseOnTyping}
            onChange={(v) => patchPrefs({ ambientPauseOnTyping: v })}
            label="Pause while typing"
          />
        </div>

        <div className="my-4 h-px bg-zinc-800/50" />

        <h3 className="mb-3 text-sm font-semibold text-zinc-200">Reading</h3>
        <div className="space-y-0.5">
          <Toggle
            checked={prefs.screenReaderMode}
            onChange={(v) => patchPrefs({ screenReaderMode: v })}
            label="Screen reader mode"
          />
          <Toggle
            checked={prefs.reducedMotion}
            onChange={(v) => patchPrefs({ reducedMotion: v })}
            label="Reduced motion"
          />
          <div className="flex flex-col gap-1.5 py-1.5">
            <span className="text-sm text-zinc-400">Text size</span>
            <div className="grid grid-cols-3 gap-1" role="group" aria-label="Text size">
              {FONT_SCALES.map((scale) => {
                const selected = prefs.fontScale === scale.value
                return (
                  <button
                    key={scale.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => patchPrefs({ fontScale: scale.value })}
                    className={`rounded-lg px-2 py-1.5 text-xs ${selected ? 'bg-zinc-700 text-zinc-100' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'}`}
                  >
                    {scale.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Close */}
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
          >
            Close
          </button>
        </div>
      </div>
    </>
  )
}
