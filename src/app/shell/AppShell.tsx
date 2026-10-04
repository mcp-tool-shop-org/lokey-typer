import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { Icon } from '@app/components/Icon'
import { AudioSettingsPanel } from '@app/components/AudioSettingsPanel'
import { useAmbient } from '@app/providers/AmbientProvider'
import { usePreferences } from '@app/providers/PreferencesProvider'

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        [
          'whitespace-nowrap shrink-0 rounded-lg px-2 py-1.5 text-xs font-medium transition duration-150 outline-none sm:px-3 sm:py-2 sm:text-sm focus-visible:ring-2 focus-visible:ring-slate-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950',
          isActive ? 'bg-slate-800/40 text-zinc-200' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50',
        ].join(' ')
      }
    >
      {label}
    </NavLink>
  )
}

const ICON_BTN =
  'rounded-lg p-2 transition duration-150 outline-none active:scale-95 focus-visible:ring-2 focus-visible:ring-slate-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950'

const SOUNDSCAPE_LOCK = 'Screen reader mode keeps the soundscape off.'
const SHUFFLE_MUTED = 'The soundscape is muted. Unmute to change tracks.'

export function AppShell() {
  const { prefs, patchPrefs, preferenceStatus } = usePreferences()
  const { skipTrack, unlockFailed } = useAmbient()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const soundscapeLocked = Boolean(prefs.screenReaderMode)
  const shuffleHeld = soundscapeLocked || !prefs.ambientEnabled
  const soundFailed = unlockFailed && !soundscapeLocked
  const settingsOpenerRef = useRef<HTMLElement | null>(null)
  const settingsWasOpenRef = useRef(false)

  // Focus the opener only after a real close, once inert is off the shell.
  useEffect(() => {
    if (settingsOpen) {
      settingsWasOpenRef.current = true
      return
    }
    if (!settingsWasOpenRef.current) return
    settingsWasOpenRef.current = false
    const opener = settingsOpenerRef.current
    settingsOpenerRef.current = null
    if (opener?.isConnected) opener.focus()
  }, [settingsOpen])

  function handleMuteToggle() {
    if (soundscapeLocked) return
    patchPrefs({ ambientEnabled: !prefs.ambientEnabled })
  }

  function handleShuffle() {
    if (soundscapeLocked || !prefs.ambientEnabled) return
    skipTrack()
  }

  function handleSettingsClick() {
    const active = document.activeElement
    settingsOpenerRef.current = active instanceof HTMLElement ? active : null
    setSettingsOpen(true)
  }

  return (
    <div className="min-h-full">
      <a
        href="#main-content"
        inert={settingsOpen ? true : undefined}
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-zinc-800 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-slate-400/50"
      >
        Skip to content
      </a>
      <header inert={settingsOpen ? true : undefined} className="border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4 sm:gap-4 sm:px-6 sm:py-5">
          <Link to="/" aria-label="LoKey Typer" className="flex shrink-0 items-center gap-2.5 transition duration-200 hover:opacity-80">
            <Icon name="logo-mark" size={22} className="text-zinc-400" />
            <div className="hidden text-base font-medium tracking-tight text-zinc-200 sm:block">LoKey Typer</div>
            <div className="hidden text-xs text-zinc-400 md:block">·</div>
            <div className="hidden text-xs text-zinc-400 md:block">Speed • Accuracy • Consistency</div>
          </Link>
          <nav aria-label="Main navigation" className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto sm:gap-2.5">
            <NavItem to="/" label="Home" />
            <NavItem to="/daily" label="Daily" />
            <NavItem to="/focus" label="Focus" />
            <NavItem to="/real-life" label="Real-Life" />
            <NavItem to="/competitive" label="Competitive" />
            <span aria-hidden="true" data-nav-more="" className="pointer-events-none sticky right-0 h-8 w-6 shrink-0 bg-gradient-to-l from-zinc-950 to-transparent" />
          </nav>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2.5">
            <div className="mx-0.5 h-5 w-px bg-zinc-800/50" />

            {/* Skip to random ambient track */}
            <button
              type="button"
              onClick={handleShuffle}
              disabled={shuffleHeld}
              aria-disabled={shuffleHeld || undefined}
              className={`${ICON_BTN} text-zinc-500 hover:bg-zinc-900/50 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40`}
              aria-label={
                soundscapeLocked
                  ? `Random ambient track. ${SOUNDSCAPE_LOCK}`
                  : shuffleHeld
                    ? `Random ambient track. ${SHUFFLE_MUTED}`
                    : 'Random ambient track'
              }
              title={
                soundscapeLocked
                  ? SOUNDSCAPE_LOCK
                  : shuffleHeld
                    ? SHUFFLE_MUTED
                    : unlockFailed
                      ? "Sound couldn't start. Click to try again."
                      : 'Random ambient track'
              }
            >
              <Icon name="shuffle" size={18} />
            </button>

            {/* Mute / unmute ambient */}
            <button
              type="button"
              onClick={handleMuteToggle}
              disabled={soundscapeLocked}
              aria-disabled={soundscapeLocked || undefined}
              className={`${ICON_BTN} ${prefs.ambientEnabled ? 'text-zinc-500 hover:bg-zinc-900/50 hover:text-zinc-200' : 'text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200'} disabled:cursor-not-allowed disabled:opacity-40`}
              aria-label={
                soundscapeLocked
                  ? `Ambient sound. ${SOUNDSCAPE_LOCK}`
                  : soundFailed
                    ? "Sound couldn't start. Click to try again."
                    : prefs.ambientEnabled
                      ? 'Mute ambient'
                      : 'Unmute ambient'
              }
              title={
                soundscapeLocked
                  ? SOUNDSCAPE_LOCK
                  : unlockFailed
                    ? "Sound couldn't start. Click to try again."
                    : prefs.ambientEnabled
                      ? 'Mute ambient'
                      : 'Unmute ambient'
              }
            >
              <Icon name={prefs.ambientEnabled && !soundFailed ? 'sound-on' : 'sound-off'} size={18} />
            </button>
            {unlockFailed && !soundscapeLocked ? (
              <span role="status" className="max-w-[9rem] text-xs leading-snug text-zinc-400">
                Sound didn't start. Try again.
              </span>
            ) : null}

            {/* Audio settings */}
            <button
              type="button"
              onClick={handleSettingsClick}
              className={`${ICON_BTN} text-zinc-500 hover:bg-zinc-900/50 hover:text-zinc-200`}
              aria-label="Settings"
              title="Settings"
            >
              <Icon name="settings" size={18} />
              <span className="sr-only">Settings</span>
            </button>
          </div>
        </div>
      </header>

      <AudioSettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {unlockFailed ? (
        <p role="status" className="sr-only">
          Sound couldn't start. Click or press a key to try again.
        </p>
      ) : null}

      <main id="main-content" inert={settingsOpen ? true : undefined} className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-16">
        {preferenceStatus && !settingsOpen ? (
          <p role="status" className="mb-6 text-center text-sm text-zinc-300">
            {preferenceStatus}
          </p>
        ) : null}
        <Outlet />
      </main>

    </div>
  )
}
