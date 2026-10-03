import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Mode } from '@content'
import {
  loadRuns,
  loadSkillModel,
  modeLabel,
  modeToPath,
  preferredQuickstartMode,
  saveLastMode,
} from '@lib'
import { Icon, type IconName } from '@app/components/Icon'

const MODES: Mode[] = ['focus', 'real_life', 'competitive']

const STAT_ICONS: IconName[] = ['stat-speed', 'stat-accuracy', 'stat-sessions', 'stat-days']

function computeDaysPracticed(runs: ReturnType<typeof loadRuns>) {
  const days = new Set<string>()
  for (const r of runs) {
    const d = new Date(r.timestamp * 1000).toISOString().slice(0, 10)
    days.add(d)
  }
  return days.size
}

function StatCard({ value, label, icon }: { value: string; label: string; icon: IconName }) {
  return (
    <div className="rounded-2xl bg-zinc-900/40 px-5 py-4 text-center transition-transform duration-200 ease-out hover:-translate-y-0.5">
      <Icon name={icon} size={18} className="mx-auto text-zinc-500" />
      <div className="mt-1.5 text-lg font-semibold leading-tight tabular-nums text-zinc-50">{value}</div>
      <div className="mt-0.5 text-xs font-medium text-zinc-500">{label}</div>
    </div>
  )
}

export function HomePage() {
  const navigate = useNavigate()
  const [selectedMode, setSelectedMode] = useState<Mode>(preferredQuickstartMode)

  const skill = useMemo(() => loadSkillModel(), [])
  const daysPracticed = useMemo(() => computeDaysPracticed(loadRuns()), [])
  const hasHistory = skill.total_runs > 0

  function handleStart() {
    saveLastMode(selectedMode)
    // Include a unique timestamp so ModePage detects re-navigation to the same mode
    navigate(`/${modeToPath(selectedMode)}?autostart=${Date.now()}`)
  }

  function cycleMode() {
    setSelectedMode((prev) => {
      const idx = MODES.indexOf(prev)
      return MODES[(idx + 1) % MODES.length]
    })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-14">
      <h1 className="sr-only">LoKey Typer — Home</h1>
      {/* CTA — same position as every other tab */}
      <div className="text-center">
        <button
          type="button"
          onClick={handleStart}
          className="group inline-flex items-center gap-2.5 rounded-2xl border border-zinc-700/50 bg-zinc-800/80 px-12 py-4 text-base font-semibold text-zinc-300 transition-all duration-150 hover:bg-zinc-700 hover:border-zinc-600 hover:scale-[1.01] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
        >
          <Icon name="play" size={20} className="text-slate-400 transition-transform duration-150 group-hover:translate-x-0.5" />
          Start typing
        </button>
        <div className="mt-3 text-xs text-zinc-500/80">
          Starting in{' '}
          <span className="font-medium text-zinc-300">{modeLabel(selectedMode)}</span>
          {' · '}
          <button
            type="button"
            onClick={cycleMode}
            className="rounded text-zinc-400 underline underline-offset-2 outline-none transition duration-150 hover:text-zinc-200 focus-visible:ring-2 focus-visible:ring-slate-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          >
            change
          </button>
        </div>
      </div>

      {/* Stats Row */}
      {hasHistory ? (
        <section aria-label="Your typing stats" className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard value={`${Math.round(skill.ema.wpm)}`} label="Avg WPM" icon={STAT_ICONS[0]} />
          <StatCard value={`${Math.round(skill.ema.accuracy * 100)}%`} label="Accuracy" icon={STAT_ICONS[1]} />
          <StatCard value={`${skill.total_runs}`} label="Sessions" icon={STAT_ICONS[2]} />
          <StatCard value={`${daysPracticed}`} label="Days practiced" icon={STAT_ICONS[3]} />
        </section>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-3xl bg-zinc-900/40 px-6 py-8 text-center sm:px-8 sm:py-12">
          <Icon name="keyboard" size={28} className="text-zinc-500" />
          <p className="text-sm text-zinc-400">
            Your stats will appear here after your first session.
          </p>
          <p className="text-xs text-zinc-500">
            Press <span className="font-medium text-zinc-300">Start typing</span> above to begin.
          </p>
        </div>
      )}
    </div>
  )
}
