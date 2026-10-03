import { useEffect, useRef } from 'react'
import { usePreferences } from '@app/providers/PreferencesProvider'
import { AMBIENT_CATEGORIES, AMBIENT_CATEGORY_LABELS, type AmbientCategory } from '@lib-internal/ambientManifest'

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm text-zinc-400">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition ${checked ? 'bg-emerald-600' : 'bg-zinc-700'}`}
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
        <span className="text-xs tabular-nums text-zinc-600">{pct}%</span>
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

export function AudioSettingsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { prefs, patchPrefs } = usePreferences()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (open) {
      // Focus the first interactive element on open
      const first = panelRef.current?.querySelector<HTMLElement>('button, input, select')
      first?.focus()
    }
  }, [open])

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} aria-hidden="true" />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Audio Settings"
        data-aiui-goal="audio_settings_open"
        className="fixed right-4 top-20 z-50 w-80 rounded-2xl border border-zinc-800/50 bg-zinc-900 p-5 shadow-2xl"
      >
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
            onChange={(v) => patchPrefs({ ambientEnabled: v })}
            label="Ambient sounds"
          />
          <Slider
            value={prefs.ambientVolume}
            onChange={(v) => patchPrefs({ ambientVolume: v })}
            label="Ambient volume"
          />
          <label className="flex flex-col gap-1.5 py-1.5">
            <span className="text-sm text-zinc-400">Category</span>
            <select
              value={prefs.ambientCategory}
              onChange={(e) => patchPrefs({ ambientCategory: e.target.value as AmbientCategory | 'all' })}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50"
              aria-label="Ambient category"
            >
              <option value="all">All categories</option>
              {AMBIENT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {AMBIENT_CATEGORY_LABELS[cat]}
                </option>
              ))}
            </select>
          </label>
          <Toggle
            checked={prefs.ambientPauseOnTyping}
            onChange={(v) => patchPrefs({ ambientPauseOnTyping: v })}
            label="Pause while typing"
          />
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
