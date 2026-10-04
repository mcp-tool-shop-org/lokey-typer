// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { findExercise, loadExercisesByMode } from '@content'
import { keyboardPassage } from '../src/lib/keyboardPassage'
import { competitiveMinLength, repeatPassage } from '../src/lib/repeatPassage'
import {
  appendRun,
  loadPreferences,
  loadSkillModel,
  pushRecent,
  saveLastMode,
  savePreferences,
  saveSkillModel,
  type Preferences,
} from '../src/lib/storage'

const RAIN_TRACK = {
  id: 'rain-1',
  title: 'Steady',
  category: 'rain',
  tags: ['soft'],
  path: 'audio/ambient/rain/steady.wav',
  duration_sec: 12,
}
const OCEAN_TRACK = {
  id: 'ocean-1',
  title: 'Waves',
  category: 'ocean',
  tags: [] as string[],
  path: 'audio/ambient/ocean/waves.wav',
  duration_sec: 20,
  lufs_i: -18,
}

const mocks = vi.hoisted(() => {
  const fetchMock = vi.fn()
  class FakeAudioParam {
    value = 0
    setValueAtTime() {}
    linearRampToValueAtTime() {}
    cancelScheduledValues() {}
  }
  class FakeAudioContext {
    state = 'suspended'
    currentTime = 0
    sampleRate = 44100
    destination = {}
    resume = vi.fn(async () => {
      this.state = 'running'
    })
    suspend = vi.fn(async () => {})
    close = vi.fn(async () => {})
    createGain() {
      return { gain: new FakeAudioParam(), connect() {}, disconnect() {} }
    }
    createBufferSource() {
      return {
        buffer: null,
        loop: false,
        playbackRate: { value: 1 },
        onended: null as null | (() => void),
        connect() {},
        disconnect() {},
        start() {},
        stop() {},
      }
    }
    createBuffer() {
      return {
        duration: 0.01,
        length: 8,
        sampleRate: 44100,
        numberOfChannels: 1,
        getChannelData: () => new Float32Array(8),
      }
    }
    decodeAudioData = vi.fn(async () => null)
  }

  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('AudioContext', FakeAudioContext)
  vi.stubGlobal('webkitAudioContext', FakeAudioContext)

  const ambientPlayer = {
    setPreferences: vi.fn(),
    start: vi.fn(async () => {}),
    skipTrack: vi.fn(async () => {}),
    noteTypingActivity: vi.fn(),
    setVisibilityPaused: vi.fn(),
    stop: vi.fn(),
  }
  const typewriterAudio = {
    play: vi.fn(),
    ensureReady: vi.fn(async () => {}),
    resume: vi.fn(async () => {}),
  }
  return { fetchMock, ambientPlayer, typewriterAudio }
})

vi.mock('../src/lib/ambient', () => ({ ambientPlayer: mocks.ambientPlayer }))
vi.mock('../src/lib/audio', () => ({ typewriterAudio: mocks.typewriterAudio }))

import { AmbientProvider, App, PreferencesProvider, useAmbient, usePreferences } from '@app'
import { ErrorBoundary } from '@app/components/ErrorBoundary'
import { Icon, type IconName } from '@app/components/Icon'

const USER_ID = 'u_pagesuite00000001'

let store = new Map<string, string>()
let prefersReducedMotion = false
const scrollIntoView = vi.fn()

function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    json: async () => body,
    arrayBuffer: async () => new ArrayBuffer(0),
  }
}

function defaultFetch(input: RequestInfo | URL) {
  const url = String(input)
  if (url.includes('.wav')) return Promise.resolve(jsonResponse(null, false))
  if (url.includes('manifest')) return Promise.resolve(jsonResponse({ version: 3, tracks: [RAIN_TRACK, OCEAN_TRACK] }))
  return Promise.resolve(jsonResponse(null, false))
}

function installMemoryStorage() {
  store = new Map<string, string>()
  const localStorage = {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => {
      store.clear()
    },
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size
    },
  }
  Object.defineProperty(globalThis, 'localStorage', { value: localStorage, configurable: true })
}

function setupUser() {
  return userEvent.setup({ delay: null, pointerEventsCheck: PointerEventsCheckLevel.Never })
}

function dateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function seedUser() {
  localStorage.setItem('lkt_user_id_v1', USER_ID)
}

function withPrefs(patch: Partial<Preferences>) {
  savePreferences({ ...loadPreferences(), ...patch })
}

function renderApp(entries: string[] = ['/'], index = 0) {
  return render(
    <MemoryRouter initialEntries={entries} initialIndex={index}>
      <PreferencesProvider>
        <AmbientProvider>
          <App />
        </AmbientProvider>
      </PreferencesProvider>
    </MemoryRouter>,
  )
}

function passageText() {
  const node = document.querySelector('.whitespace-pre-wrap')
  if (!node?.textContent) throw new Error('passage text was not on screen')
  return node.textContent
}

function typingExerciseId() {
  const describedBy = screen.getByRole('textbox', { name: 'Typing input' }).getAttribute('aria-describedby')
  if (!describedBy?.startsWith('typing-help-')) throw new Error('typing exercise id was not on the field')
  return describedBy.slice('typing-help-'.length)
}

function foldedExercise(id: string) {
  const exercise = findExercise(id)
  if (!exercise || exercise.type === 'template') throw new Error(`missing plain exercise ${id}`)
  return keyboardPassage(exercise.text_short ?? exercise.text ?? exercise.text_long ?? '')
}

function exerciseTitle(id: string) {
  const title = findExercise(id)?.title
  if (!title) throw new Error(`missing exercise ${id}`)
  return title
}

function classTokens(node: Element | null | undefined) {
  const raw = node instanceof Element ? node.className : ''
  const value = typeof raw === 'string' ? raw : ''
  return value.split(/\s+/).filter(Boolean)
}

function spyOnReload() {
  const reload = vi.fn()
  const descriptor = Object.getOwnPropertyDescriptor(window.location, 'reload')
  try {
    Object.defineProperty(window.location, 'reload', { configurable: true, writable: true, value: reload })
  } catch {
    const previous = Object.getOwnPropertyDescriptor(window, 'location')
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { reload, assign: vi.fn(), replace: vi.fn(), href: window.location.href },
    })
    return {
      reload,
      restore() {
        if (previous) Object.defineProperty(window, 'location', previous)
      },
    }
  }
  return {
    reload,
    restore() {
      if (descriptor) Object.defineProperty(window.location, 'reload', descriptor)
    },
  }
}

type DailyKind = 'confidence' | 'targeted' | 'challenge' | 'real_life' | 'mix'
type SessionType = 'reset' | 'mix' | 'deep'

function seedDailySet(
  sessionType: SessionType,
  items: { kind: DailyKind; mode: 'focus' | 'real_life' | 'competitive'; exerciseId: string }[],
  screenReader = false,
) {
  const key = `lkt_daily_set_v1|${USER_ID}|${dateKey()}|${sessionType}${screenReader ? '|sr' : ''}`
  localStorage.setItem(
    key,
    JSON.stringify({ dateKey: dateKey(), userId: USER_ID, sessionType, items }),
  )
}

function seedDailyProgress(
  sessionType: SessionType,
  completed: { wpm: number; accuracy: number; durationMs: number }[],
  screenReader = false,
) {
  const key = `lkt_daily_progress_v1|${USER_ID}|${dateKey()}|${sessionType}${screenReader ? '|sr' : ''}`
  localStorage.setItem(
    key,
    JSON.stringify({
      dateKey: dateKey(),
      userId: USER_ID,
      sessionType,
      completedItems: completed.map((item, i) => ({ ...item, completedAt: i + 1 })),
      startedAt: 1,
      finishedAt: completed.length > 0 ? 2 : undefined,
    }),
  )
}

function seedCompetitiveRun(wpm: number, sprint: 30000 | 60000 | 120000, timestamp: number) {
  appendRun({
    exercise_id: 'competitive_mixed_01_001',
    timestamp,
    mode: 'competitive',
    wpm,
    accuracy: 0.956,
    errors: 1,
    backspaces: 0,
    duration_ms: sprint,
    sprint_duration_ms: sprint,
  })
}

beforeEach(() => {
  installMemoryStorage()
  prefersReducedMotion = false
  document.documentElement.classList.remove('reduce-motion')
  mocks.fetchMock.mockReset()
  mocks.fetchMock.mockImplementation(defaultFetch)
  mocks.ambientPlayer.setPreferences.mockClear()
  mocks.ambientPlayer.start.mockClear()
  delete (mocks.ambientPlayer as { isStarted?: unknown }).isStarted
  mocks.ambientPlayer.skipTrack.mockClear()
  mocks.ambientPlayer.noteTypingActivity.mockClear()
  mocks.typewriterAudio.play.mockClear()
  mocks.typewriterAudio.ensureReady.mockClear()
  mocks.typewriterAudio.resume.mockClear()
  scrollIntoView.mockClear()
  Element.prototype.scrollIntoView = scrollIntoView
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes('prefers-reduced-motion') ? prefersReducedMotion : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  document.querySelectorAll('[data-test-outside]').forEach((node) => node.remove())
  document.documentElement.classList.remove('reduce-motion')
})

describe('routes and shell', () => {
  it('names the home link LoKey Typer and does not open settings on mount', () => {
    renderApp()
    const home = screen.getByRole('link', { name: (name) => name === 'LoKey Typer' })
    expect(home.getAttribute('aria-label')).toBe('LoKey Typer')
    expect(screen.getByRole('link', { name: 'Skip to content' }).getAttribute('href')).toBe('#main-content')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(document.body)
    expect(screen.getByRole('heading', { name: /LoKey Typer/ })).toBeTruthy()
    const emptyStats = screen.getByText(/Your stats will appear here after your first session/)
    expect(classTokens(emptyStats)).toContain('text-zinc-400')
    const nav = screen.getByRole('navigation', { name: 'Main navigation' })
    const settings = screen.getByRole('button', { name: 'Settings' })
    const shuffle = screen.getByRole('button', { name: 'Random ambient track' })
    const mute = screen.getByRole('button', { name: 'Mute ambient' })
    expect(nav.contains(settings)).toBe(false)
    expect(nav.contains(shuffle)).toBe(false)
    expect(nav.contains(mute)).toBe(false)
    expect(nav.parentElement?.contains(settings)).toBe(true)
    expect(nav.parentElement?.contains(shuffle)).toBe(true)
    expect(nav.parentElement?.contains(mute)).toBe(true)
    const cluster = settings.parentElement
    expect(cluster).toBe(shuffle.parentElement)
    expect(cluster).toBe(mute.parentElement)
    expect(cluster).not.toBe(nav)
    expect(classTokens(cluster)).toContain('shrink-0')
    expect(classTokens(nav)).toContain('min-w-0')
    expect(classTokens(nav)).toContain('overflow-x-auto')
    expect(classTokens(nav)).not.toContain('shrink-0')
    // Prefixed tokens count. max-sm:overflow-x-auto is still an overflow token. The nav keeps its own.
    expect(
      classTokens(nav.parentElement).some(
        (token) => token.includes('overflow-x-auto') || token.includes('overflow-x-scroll'),
      ),
    ).toBe(false)
    const tagline = screen.getByText('Speed • Accuracy • Consistency')
    expect(classTokens(tagline)).toContain('text-zinc-400')
    const dot = tagline.previousElementSibling
    expect(dot?.textContent).toBe('·')
    expect(classTokens(dot)).toContain('text-zinc-400')
    expect(classTokens(dot)).not.toContain('text-zinc-600')
    expect(screen.getByText(/Starting in/).className).toContain('text-zinc-400')
  })

  it('keeps each mode name on one line', () => {
    renderApp()
    const nav = screen.getByRole('navigation', { name: 'Main navigation' })
    for (const name of ['Home', 'Daily', 'Focus', 'Real-Life', 'Competitive']) {
      const tokens = classTokens(within(nav).getByRole('link', { name }))
      expect(tokens).toContain('whitespace-nowrap')
      expect(tokens).toContain('shrink-0')
    }
  })

  it('marks the scrolled mode names with a hint inside the nav', () => {
    renderApp()
    const nav = screen.getByRole('navigation', { name: 'Main navigation' })
    const more = nav.querySelector('[data-nav-more]')
    expect(more).toBe(nav.lastElementChild)
    const tokens = classTokens(more)
    expect(tokens).toContain('sticky')
    expect(tokens).toContain('right-0')
    expect(tokens).toContain('bg-gradient-to-l')
  })

  it('follows daily, mode, legacy, and unknown routes', async () => {
    const user = setupUser()
    renderApp()

    await user.click(screen.getByRole('link', { name: 'Daily' }))
    expect(screen.getByRole('heading', { name: /Today.s exercises/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Begin' })).toBeTruthy()
    expect(screen.getByText(/\d+ exercises •/).className).toContain('text-zinc-400')

    await user.click(screen.getByRole('link', { name: 'Focus' }))
    expect(screen.getByRole('link', { name: 'Focus' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByText(/\d+ of \d+ exercises left/).className).toContain('text-zinc-400')
    expect(screen.getByText(/\d+ of \d+ exercises left/).textContent).not.toMatch(/starting fresh/)

    await user.click(screen.getByRole('link', { name: 'Real-Life' }))
    expect(screen.getByRole('link', { name: 'Real-Life' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByText(/\d+ of \d+ exercises left/)).toBeTruthy()

    await user.click(screen.getByRole('link', { name: 'Competitive' }))
    expect(screen.getByText('Sprint duration')).toBeTruthy()
    expect(screen.getByText(/\d+ of \d+ exercises left/)).toBeTruthy()

    await user.click(screen.getByRole('link', { name: (name) => name === 'LoKey Typer' }))
    expect(screen.getByRole('link', { name: 'Home' }).getAttribute('aria-current')).toBe('page')
  })

  it('redirects practice and arcade and recovers from an unknown path', async () => {
    const user = setupUser()
    const practice = renderApp(['/practice'])
    expect(screen.getByRole('link', { name: 'Focus' }).getAttribute('aria-current')).toBe('page')
    expect(screen.queryByRole('heading', { name: 'Page not found' })).toBeNull()
    practice.unmount()

    const arcade = renderApp(['/arcade'])
    expect(screen.getByRole('link', { name: 'Competitive' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByText('Sprint duration')).toBeTruthy()
    arcade.unmount()

    renderApp(['/nowhere-at-all'])
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeTruthy()
    expect(screen.getByText(/Nothing here/)).toBeTruthy()
    await user.click(screen.getByRole('link', { name: 'Go home' }))
    expect(screen.getByRole('heading', { name: /LoKey Typer/ })).toBeTruthy()
  })

  it('toggles mute, skips a track, and keeps tab inside settings until escape', async () => {
    const user = setupUser()
    renderApp()

    await user.click(screen.getByRole('button', { name: 'Random ambient track' }))
    expect(mocks.ambientPlayer.skipTrack).toHaveBeenCalled()
    expect(mocks.ambientPlayer.start).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Random ambient track' }))
    expect(mocks.ambientPlayer.start).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Mute ambient' }))
    expect(screen.getByRole('button', { name: 'Unmute ambient' }).className).toContain('text-zinc-400')
    expect(loadPreferences().ambientEnabled).toBe(false)
    expect(mocks.ambientPlayer.setPreferences).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false, category: 'all' }),
    )

    const opener = screen.getByRole('button', { name: 'Settings' })
    opener.focus()
    await user.click(opener)
    const dialog = await screen.findByRole('dialog', { name: 'Settings' })
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))
    const outside = document.createElement('button')
    outside.textContent = 'Outside control'
    outside.setAttribute('data-test-outside', 'true')
    document.body.appendChild(outside)
    outside.focus()
    await user.tab()
    expect(dialog.contains(document.activeElement)).toBe(true)
    outside.focus()
    await user.tab({ shift: true })
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Close' }))

    const switches = within(dialog).getAllByRole('switch')
    switches[0]?.focus()
    await user.tab({ shift: true })
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Close' }))
    await user.tab()
    expect(dialog.contains(document.activeElement)).toBe(true)
    expect(document.activeElement).not.toBe(document.body)

    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(opener)
  })

  it('paints the missing-page sentence in quiet type', () => {
    renderApp(['/nowhere-at-all'])
    expect(classTokens(screen.getByText('Nothing here. It may have been moved or removed.'))).toContain('text-zinc-400')
  })
})

describe('audio settings', () => {
  it('changes the controls that are on the panel and saves them', async () => {
    const user = setupUser()
    renderApp()
    await user.click(screen.getByRole('button', { name: 'Settings' }))
    const dialog = await screen.findByRole('dialog', { name: 'Settings' })
    expect(await within(dialog).findByRole('option', { name: 'Rain' })).toBeTruthy()
    expect(within(dialog).getByRole('option', { name: 'Ocean' })).toBeTruthy()
    expect(within(dialog).queryByRole('option', { name: 'Campfire' })).toBeNull()
    expect(within(dialog).queryByRole('option', { name: 'Café' })).toBeNull()

    const keyVolume = within(dialog).getByRole('slider', { name: 'Keystroke volume' })
    await user.click(keyVolume)
    fireEvent.change(keyVolume, { target: { value: '25' } })
    const ambientVolume = within(dialog).getByRole('slider', { name: 'Ambient volume' })
    await user.click(ambientVolume)
    fireEvent.change(ambientVolume, { target: { value: '80' } })
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Ambient category' }), 'rain')
    await user.click(within(dialog).getByRole('switch', { name: 'Keystroke sounds' }))
    await user.click(within(dialog).getByRole('switch', { name: 'Completion bell' }))
    await user.click(within(dialog).getByRole('switch', { name: 'Pause while typing' }))
    await user.click(within(dialog).getByRole('button', { name: 'Larger' }))
    await user.click(within(dialog).getByRole('switch', { name: 'Reduced motion' }))
    expect(document.documentElement.classList.contains('reduce-motion')).toBe(true)
    await user.click(within(dialog).getByRole('switch', { name: 'Screen reader mode' }))

    expect(within(dialog).getByText(/Screen reader mode keeps the soundscape off/).className).toContain('text-zinc-400')
    for (const readout of within(dialog).getAllByText(/^\d+%$/)) {
      expect(readout.className).toContain('text-zinc-400')
    }
    expect((within(dialog).getByRole('switch', { name: 'Ambient sounds' }) as HTMLButtonElement).disabled).toBe(true)
    const saved = loadPreferences()
    expect(saved.volume).toBeCloseTo(0.25)
    expect(saved.ambientVolume).toBeCloseTo(0.8)
    expect(saved.ambientCategory).toBe('rain')
    expect(saved.soundEnabled).toBe(false)
    expect(saved.keyboardVoice).toBe('mechanical')
    expect(saved.bellOnCompletion).toBe(false)
    expect(saved.ambientPauseOnTyping).toBe(true)
    expect(saved.fontScale).toBe(1.1)
    expect(saved.reducedMotion).toBe(true)
    expect(saved.screenReaderMode).toBe(true)
    expect(saved.ambientEnabled).toBe(false)
    expect(within(dialog).getByRole('button', { name: 'Larger' }).getAttribute('aria-pressed')).toBe('true')

    const hidden = document.createElement('button')
    hidden.tabIndex = -1
    hidden.textContent = 'skip me'
    dialog.appendChild(hidden)
    await user.tab()
    expect(document.activeElement).not.toBe(hidden)

    await user.click(within(dialog).getByRole('button', { name: 'Smaller' }))
    expect(loadPreferences().fontScale).toBe(0.9)
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('keeps the chosen keyboard and previews that voice', async () => {
    const user = setupUser()
    renderApp()
    await user.click(screen.getByRole('button', { name: 'Settings' }))
    const dialog = await screen.findByRole('dialog', { name: 'Settings' })
    expect(within(dialog).getByRole('radio', { name: 'Mechanical. Rich, old switch' }).getAttribute('aria-checked')).toBe('true')
    expect(loadPreferences().keyboardVoice).toBe('mechanical')

    await user.click(within(dialog).getByRole('radio', { name: 'Clicky. Bright snap' }))
    expect(loadPreferences().keyboardVoice).toBe('clicky')
    await waitFor(() =>
      expect(mocks.typewriterAudio.play).toHaveBeenCalledWith(
        'key',
        expect.objectContaining({ keyboardVoice: 'clicky', enabled: true }),
      ),
    )
    expect(within(dialog).getByRole('radio', { name: 'Clicky. Bright snap' }).getAttribute('aria-checked')).toBe('true')

    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    await user.click(screen.getByRole('button', { name: 'Settings' }))
    const again = await screen.findByRole('dialog', { name: 'Settings' })
    expect(within(again).getByRole('radio', { name: 'Clicky. Bright snap' }).getAttribute('aria-checked')).toBe('true')
    await user.click(within(again).getByRole('radio', { name: 'Tick. Short click' }))
    expect(loadPreferences().keyboardVoice).toBe('tick')
    await user.click(within(again).getByRole('radio', { name: 'Muted. Quiet strike' }))
    expect(loadPreferences().keyboardVoice).toBe('muted')
    await user.click(within(again).getByRole('radio', { name: 'Mechanical. Rich, old switch' }))
    expect(loadPreferences().keyboardVoice).toBe('mechanical')
  })

  it('lists a category only after a track exists and closes from the backdrop', async () => {
    const user = setupUser()
    let resolveFetch: (value: unknown) => void = () => {}
    mocks.fetchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve
        }),
    )
    renderApp()
    await user.click(screen.getByRole('button', { name: 'Settings' }))
    const dialog = await screen.findByRole('dialog', { name: 'Settings' })
    const select = within(dialog).getByRole('combobox', { name: 'Ambient category' })
    expect(within(select).getAllByRole('option')).toHaveLength(1)
    expect(within(select).getByRole('option', { name: 'All categories' })).toBeTruthy()

    resolveFetch(jsonResponse({ version: 3, tracks: [RAIN_TRACK] }))
    expect(await within(select).findByRole('option', { name: 'Rain' })).toBeTruthy()
    expect(within(select).queryByRole('option', { name: 'Ocean' })).toBeNull()

    const backdrop = document.querySelector('div.fixed.inset-0')
    if (!backdrop) throw new Error('settings backdrop was not rendered')
    await user.click(backdrop)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('ignores a manifest that fails and a fetch cancelled by closing', async () => {
    const user = setupUser()
    mocks.fetchMock.mockImplementation(async () => jsonResponse(null, false))
    const failed = renderApp()
    await user.click(screen.getByRole('button', { name: 'Settings' }))
    const dialog = await screen.findByRole('dialog', { name: 'Settings' })
    await waitFor(() => expect(mocks.fetchMock).toHaveBeenCalled())
    expect(within(dialog).queryByRole('option', { name: 'Rain' })).toBeNull()
    failed.unmount()

    let resolveFetch: (value: unknown) => void = () => {}
    mocks.fetchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve
        }),
    )
    renderApp()
    await user.click(screen.getByRole('button', { name: 'Settings' }))
    await user.click(await screen.findByRole('button', { name: 'Close' }))
    resolveFetch(jsonResponse({ version: 3, tracks: [OCEAN_TRACK] }))
    await Promise.resolve()
    expect(screen.queryByRole('option', { name: 'Ocean' })).toBeNull()
  })

  it('shows all in the menu when the saved category has no track', async () => {
    const user = setupUser()
    let calls = 0
    mocks.fetchMock.mockImplementation(async () => {
      calls += 1
      if (calls === 1) return jsonResponse(null, false)
      return jsonResponse({ version: 3, tracks: [RAIN_TRACK] })
    })
    withPrefs({ ambientCategory: 'campfire' })
    renderApp()
    await Promise.resolve()
    expect(loadPreferences().ambientCategory).toBe('campfire')
    await user.click(screen.getByRole('button', { name: 'Settings' }))
    const select = await screen.findByRole('combobox', { name: 'Ambient category' })
    await waitFor(() => expect((select as HTMLSelectElement).value).toBe('all'))
    expect(loadPreferences().ambientCategory).toBe('campfire')
    await user.selectOptions(select, 'rain')
    expect(loadPreferences().ambientCategory).toBe('rain')
  })

  it('does not move focus when every control in the dialog is disabled', async () => {
    const user = setupUser()
    renderApp()
    await user.click(screen.getByRole('button', { name: 'Settings' }))
    const dialog = await screen.findByRole('dialog', { name: 'Settings' })
    dialog.tabIndex = 0
    dialog.focus()
    dialog.querySelectorAll('button, input, select, textarea').forEach((el) => {
      if ('disabled' in el) (el as HTMLButtonElement).disabled = true
    })
    await user.keyboard('{Tab}')
    expect(document.activeElement).toBe(dialog)
  })
})

describe('home', () => {
  it('cycles the quick start and opens that mode', async () => {
    const user = setupUser()
    renderApp()
    expect(document.body.textContent).toMatch(/Starting in\s+Focus/)
    await user.click(screen.getByRole('button', { name: 'change' }))
    expect(document.body.textContent).toMatch(/Starting in\s+Real-Life/)
    await user.click(screen.getByRole('button', { name: 'change' }))
    expect(document.body.textContent).toMatch(/Starting in\s+Competitive/)
    await user.click(screen.getByRole('button', { name: 'change' }))
    expect(document.body.textContent).toMatch(/Starting in\s+Focus/)
    await user.click(screen.getByRole('button', { name: 'change' }))
    await user.click(screen.getByRole('button', { name: 'Start typing' }))
    expect(await screen.findByRole('button', { name: 'Next exercise' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Real-Life' }).getAttribute('aria-current')).toBe('page')
    expect(screen.queryByText(/autostart/)).toBeNull()
  })

  it('starts from the last mode and shows stats after history exists', async () => {
    const user = setupUser()
    saveLastMode('competitive')
    const skill = loadSkillModel()
    skill.total_runs = 7
    skill.ema.wpm = 41.6
    skill.ema.accuracy = 0.994
    saveSkillModel(skill)
    const stamp = (iso: string) => Math.floor(Date.parse(iso) / 1000)
    for (const iso of ['2024-05-01T12:00:00Z', '2024-05-02T12:00:00Z', '2024-05-03T12:00:00Z', '2024-06-15T12:00:00Z']) {
      appendRun({
        exercise_id: 'focus_calm_01_001',
        timestamp: stamp(iso),
        mode: 'focus',
        wpm: 40,
        accuracy: 0.99,
        errors: 0,
        backspaces: 1,
        duration_ms: 10_000,
      })
    }
    renderApp()
    expect(document.body.textContent).toMatch(/Starting in\s+Competitive/)
    expect(screen.getByText('42')).toBeTruthy()
    expect(screen.getByText('99%')).toBeTruthy()
    expect(screen.getByText('7')).toBeTruthy()
    expect(screen.getByText('Avg WPM')).toBeTruthy()
    expect(screen.getByText('Days practiced')).toBeTruthy()
    expect(screen.getByText('4')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'change' }))
    expect(document.body.textContent).toMatch(/Starting in\s+Focus/)
  })

  it('paints the line under the empty home stats in quiet type', () => {
    renderApp()
    expect(classTokens(screen.getByText(/above to begin/))).toContain('text-zinc-400')
  })

  it('paints the home stat labels in quiet type', () => {
    const skill = loadSkillModel()
    skill.total_runs = 1
    skill.ema.wpm = 10
    skill.ema.accuracy = 1
    saveSkillModel(skill)
    appendRun({
      exercise_id: 'focus_calm_01_001',
      timestamp: 1_700_000_000,
      mode: 'focus',
      wpm: 10,
      accuracy: 1,
      errors: 0,
      backspaces: 0,
      duration_ms: 1000,
    })
    renderApp()
    for (const label of ['Avg WPM', 'Accuracy', 'Sessions', 'Days practiced']) {
      expect(classTokens(screen.getByText(label))).toContain('text-zinc-400')
    }
  })
})

describe('mode pages', () => {
  it('starts focus, real-life, and competitive without claiming the pool is finished', async () => {
    const user = setupUser()
    renderApp(['/focus'])
    expect(screen.getByText(/\d+ of \d+ exercises left/).textContent).not.toMatch(/starting fresh/)
    await user.click(screen.getByRole('button', { name: 'Start typing' }))
    expect(await screen.findByRole('button', { name: 'Next exercise' })).toBeTruthy()
    const title = screen.getByRole('heading', { level: 1 }).textContent
    const passage = passageText()
    const exerciseId = typingExerciseId()
    const input = screen.getByRole('textbox', { name: 'Typing input' })
    await user.type(input, 'ab')
    await user.click(screen.getByRole('button', { name: 'Restart' }))
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(title)
    expect(passageText()).toBe(passage)
    expect(typingExerciseId()).toBe(exerciseId)
    expect((screen.getByRole('textbox', { name: 'Typing input' }) as HTMLTextAreaElement).value).toBe('')
    expect(pushRecent('focus', exerciseId)).toBe(true)
    await user.type(screen.getByRole('textbox', { name: 'Typing input' }), 'z')
    await user.click(screen.getByRole('button', { name: 'Next exercise' }))
    expect(typingExerciseId()).not.toBe(exerciseId)
    await user.click(screen.getByRole('button', { name: 'Exit' }))
    expect(screen.getByText(/\d+ of \d+ exercises left/)).toBeTruthy()

    await user.click(screen.getByRole('link', { name: 'Real-Life' }))
    await user.click(screen.getByRole('button', { name: 'Start typing' }))
    expect(await screen.findByRole('button', { name: 'Next exercise' })).toBeTruthy()
    expect(screen.queryByText('Sprint duration')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Exit' }))
    await user.click(screen.getByRole('link', { name: 'Competitive' }))
    expect(screen.getByText('No 60s runs yet — finish a sprint to get on the board.')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: '30s' }))
    expect(loadPreferences().competitiveSprintDurationMs).toBe(30_000)
    expect(screen.getByText('No 30s runs yet — finish a sprint to get on the board.')).toBeTruthy()
    expect(screen.queryByText('No 60s runs yet — finish a sprint to get on the board.')).toBeNull()
    await user.click(screen.getByRole('button', { name: '120s' }))
    expect(loadPreferences().competitiveSprintDurationMs).toBe(120_000)
    expect(screen.getByText('No 120s runs yet — finish a sprint to get on the board.')).toBeTruthy()
    expect(screen.queryByText('No 60s runs yet — finish a sprint to get on the board.')).toBeNull()
    await user.click(screen.getByRole('button', { name: '60s' }))
    expect(loadPreferences().competitiveSprintDurationMs).toBe(60_000)
    const ghost = screen.getByRole('checkbox', { name: /Race your best/ }) as HTMLInputElement
    expect(ghost.checked).toBe(true)
    await user.click(ghost)
    expect(loadPreferences().competitiveGhostEnabled).toBe(false)
    await user.click(screen.getByRole('button', { name: 'Start typing' }))
    expect(await screen.findByText(/Personal bests require/)).toBeTruthy()
    expect(screen.getByText('Remaining')).toBeTruthy()
  })

  it('names the empty 60s board and keeps a 30s run off it', async () => {
    const user = setupUser()
    seedCompetitiveRun(44, 30_000, 1_700_000_099)
    renderApp(['/competitive'])
    expect(loadPreferences().competitiveSprintDurationMs).toBe(60_000)
    expect(screen.queryByText('44 WPM')).toBeNull()
    const emptyBoard = screen.getByText('No 60s runs yet — finish a sprint to get on the board.')
    expect(classTokens(emptyBoard)).toContain('text-zinc-400')
    expect(screen.getByText('30s has runs.')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: '30s' }))
    expect(screen.getByText('44 WPM')).toBeTruthy()
    expect(screen.queryByText(/No \d+s runs yet/)).toBeNull()
  })

  it('names both other lengths when the 60s board is empty', () => {
    seedCompetitiveRun(44, 30_000, 1_700_000_099)
    seedCompetitiveRun(55, 120_000, 1_700_000_100)
    renderApp(['/competitive'])
    expect(loadPreferences().competitiveSprintDurationMs).toBe(60_000)
    expect(screen.getByText('No 60s runs yet — finish a sprint to get on the board.')).toBeTruthy()
    expect(screen.getByText('30s and 120s have runs.')).toBeTruthy()
  })

  it('paints rank and accuracy on a competitive row in quiet type', () => {
    seedCompetitiveRun(81, 60_000, 1_700_000_001)
    renderApp(['/competitive'])
    expect(classTokens(screen.getByText('#1'))).toContain('text-zinc-400')
    expect(classTokens(screen.getByText('95.6%'))).toContain('text-zinc-400')
  })

  it('starts from an autostart link and says when every exercise is done', async () => {
    const user = setupUser()
    const started = renderApp(['/focus?autostart=1710000000000'])
    expect(await screen.findByRole('button', { name: 'Next exercise' })).toBeTruthy()
    expect(screen.queryByText(/exercises left/)).toBeNull()
    started.unmount()

    const ids = loadExercisesByMode('focus').map((exercise) => exercise.id)
    localStorage.setItem(
      'lkt_recents_v1',
      JSON.stringify({ byMode: { focus: ids, real_life: [], competitive: [] } }),
    )
    renderApp(['/focus'])
    expect(screen.getByText(/All \d+ exercises done/).textContent).toMatch(/starting fresh/)
    await user.click(screen.getByRole('button', { name: 'Start typing' }))
    expect(await screen.findByRole('button', { name: 'Next exercise' })).toBeTruthy()
  })

  it('shows the local board for the selected sprint and an error if picking fails', async () => {
    const user = setupUser()
    seedCompetitiveRun(81, 60_000, 1_700_000_001)
    seedCompetitiveRun(72, 60_000, 1_700_000_002)
    seedCompetitiveRun(63, 60_000, 1_700_000_003)
    seedCompetitiveRun(54, 60_000, 1_700_000_004)
    seedCompetitiveRun(99, 30_000, 1_700_000_005)
    const board = renderApp(['/competitive'])
    expect(screen.getByText('#1')).toBeTruthy()
    expect(screen.getByText('#2')).toBeTruthy()
    expect(screen.getByText('#3')).toBeTruthy()
    expect(screen.getByText('81 WPM')).toBeTruthy()
    expect(screen.getByText('72 WPM')).toBeTruthy()
    expect(screen.getByText('63 WPM')).toBeTruthy()
    expect(screen.queryByText('54 WPM')).toBeNull()
    expect(screen.queryByText('99 WPM')).toBeNull()
    expect(screen.getAllByText('95.6%').length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: '30s' }))
    expect(screen.getByText('99 WPM')).toBeTruthy()
    expect(screen.queryByText('81 WPM')).toBeNull()
    board.unmount()

    const lib = await import('@lib')
    const spy = vi.spyOn(lib, 'pickNextExercise').mockImplementation(() => {
      throw new Error('empty pool')
    })
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      renderApp(['/real-life'])
      await user.click(screen.getByRole('button', { name: 'Start typing' }))
      expect(screen.getByText(/load an exercise/)).toBeTruthy()
      expect(screen.queryByRole('button', { name: 'Next exercise' })).toBeNull()
    } finally {
      spy.mockRestore()
      error.mockRestore()
    }
  })
})

describe('run pages', () => {
  it('renders a real passage, remounts on restart, and leaves to that mode', async () => {
    const user = setupUser()
    const reloadSpy = spyOnReload()
    try {
      renderApp(['/focus/run/focus_calm_01_001'])
      const title = exerciseTitle('focus_calm_01_001')
      expect(screen.getByRole('heading', { name: title })).toBeTruthy()
      const passage = passageText()
      expect(passage).toContain('Slow is smooth')
      const input = screen.getByRole('textbox', { name: 'Typing input' })
      await user.type(input, 'S')
      await user.click(screen.getByRole('button', { name: 'Restart' }))
      expect(screen.getByRole('heading', { name: title })).toBeTruthy()
      expect(passageText()).toBe(passage)
      expect(typingExerciseId()).toBe('focus_calm_01_001')
      expect((screen.getByRole('textbox', { name: 'Typing input' }) as HTMLTextAreaElement).value).toBe('')
      expect(reloadSpy.reload).not.toHaveBeenCalled()
      expect(document.body.isConnected).toBe(true)
      await user.click(screen.getByRole('button', { name: 'Exit' }))
      expect(screen.getByRole('link', { name: 'Focus' }).getAttribute('aria-current')).toBe('page')
      expect(screen.getByRole('button', { name: 'Start typing' })).toBeTruthy()
    } finally {
      reloadSpy.restore()
    }
  })

  it('pads competitive text from the sprint length unless screen reader mode is on', () => {
    const id = 'competitive_mixed_01_001'
    const base = foldedExercise(id)
    const long = renderApp([`/competitive/run/${id}?duration=120000`])
    expect(screen.getByText('120s')).toBeTruthy()
    expect(screen.getByText(/Ghost comparison/)).toBeTruthy()
    expect(screen.getByText(/Leaderboard \(local\)/)).toBeTruthy()
    expect(screen.getByText(/No runs yet/)).toBeTruthy()
    const padded = passageText()
    expect(padded.length).toBeGreaterThanOrEqual(4000)
    expect(padded.length).toBe(repeatPassage(base, competitiveMinLength(120_000)).length)
    long.unmount()

    const half = renderApp([`/competitive/run/${id}?duration=60000&ghost=0`])
    expect(screen.getByText('60s')).toBeTruthy()
    expect(screen.queryByText(/Ghost comparison/)).toBeNull()
    const minute = passageText()
    expect(minute.length).toBeGreaterThanOrEqual(1800)
    expect(minute.length).toBeLessThan(4000)
    half.unmount()

    const sprint = renderApp([`/competitive/run/${id}?duration=30000`])
    expect(screen.getByText('30s')).toBeTruthy()
    expect(passageText().length).toBe(repeatPassage(base, competitiveMinLength(30_000)).length)
    sprint.unmount()

    withPrefs({ competitiveSprintDurationMs: 120_000, competitiveGhostEnabled: false })
    const fromPrefs = renderApp([`/competitive/run/${id}?duration=15`])
    expect(screen.getByText('120s')).toBeTruthy()
    expect(screen.queryByText(/Ghost comparison/)).toBeNull()
    expect(passageText().length).toBeGreaterThanOrEqual(4000)
    fromPrefs.unmount()

    withPrefs({ screenReaderMode: true, competitiveSprintDurationMs: 120_000 })
    renderApp([`/competitive/run/${id}?duration=120000`])
    expect(passageText().length).toBe(base.length)
    expect(passageText().length).toBeLessThan(1800)
  })

  it('renders template and long-variant passages and opens the daily board', async () => {
    const user = setupUser()
    seedCompetitiveRun(61, 60_000, 1_700_000_010)
    const competitive = renderApp(['/competitive/run/tpl_009?duration=60000'])
    expect(screen.getByRole('heading', { name: 'Targets Template' })).toBeTruthy()
    expect(passageText()).toMatch(/accuracy/)
    expect(screen.getByText('61 WPM')).toBeTruthy()
    expect(screen.queryByText(/No runs yet/)).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Daily' }))
    expect(screen.getByRole('heading', { name: /Today.s exercises/ })).toBeTruthy()
    competitive.unmount()

    const long = renderApp(['/real-life/run/real_life_email_01_001?variant=long'])
    expect(screen.getByRole('heading', { name: 'Scheduling' })).toBeTruthy()
    expect(passageText()).toContain('Hi Taylor')
    long.unmount()

    const short = renderApp(['/real-life/run/tpl_007'])
    expect(screen.getByRole('heading', { name: 'ETA Template' })).toBeTruthy()
    expect(passageText()).toMatch(/On my way/)
    expect(passageText()).toMatch(/minutes/)
    await user.click(screen.getByRole('button', { name: 'Exit' }))
    expect(screen.getByRole('link', { name: 'Real-Life' }).getAttribute('aria-current')).toBe('page')
    short.unmount()
  })

  it('sends an unknown exercise to that mode home instead of the previous page', async () => {
    const user = setupUser()
    const focus = renderApp(['/daily', '/focus/run/missing-id'], 1)
    expect(screen.getByRole('heading', { name: 'Exercise not found' })).toBeTruthy()
    expect(screen.getByText(/missing-id/)).toBeTruthy()
    const missing = screen.getByText(/doesn.t exist or was removed/)
    const missingTokens = classTokens(missing)
    await user.click(screen.getByRole('button', { name: 'Go back' }))
    expect(screen.getByRole('link', { name: 'Focus' }).getAttribute('aria-current')).toBe('page')
    expect(screen.queryByRole('heading', { name: /Today.s exercises/ })).toBeNull()
    expect(screen.getByText(/\d+ of \d+ exercises left/)).toBeTruthy()
    focus.unmount()

    const life = renderApp(['/daily', '/real-life/run/no-such-life'], 1)
    await user.click(screen.getByRole('button', { name: 'Go back' }))
    expect(screen.getByRole('link', { name: 'Real-Life' }).getAttribute('aria-current')).toBe('page')
    expect(screen.queryByRole('heading', { name: /Today.s exercises/ })).toBeNull()
    life.unmount()

    renderApp(['/daily', '/competitive/run/no-such-sprint'], 1)
    await user.click(screen.getByRole('button', { name: 'Go back' }))
    expect(screen.getByRole('link', { name: 'Competitive' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByText('Sprint duration')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: /Today.s exercises/ })).toBeNull()
    expect(missingTokens).toContain('text-zinc-400')
    expect(missingTokens).not.toContain('text-zinc-500')
  })

  it('paints the pack name on a typing surface in quiet type', () => {
    renderApp(['/focus/run/focus_calm_01_001'])
    const exercise = findExercise('focus_calm_01_001')
    expect(exercise?.pack).toBeTruthy()
    expect(classTokens(screen.getByText(exercise?.pack ?? ''))).toContain('text-zinc-400')
    const difficulty = screen.getByText(
      `Difficulty ${exercise?.difficulty} • Est. ${exercise?.estimated_seconds}s`,
    )
    expect(classTokens(difficulty)).toContain('text-zinc-400')
  })

  it('paints rank and accuracy on a direct-run row in quiet type', () => {
    seedCompetitiveRun(61, 60_000, 1_700_000_010)
    renderApp(['/competitive/run/competitive_mixed_01_001?duration=60000'])
    expect(classTokens(screen.getByText('#1'))).toContain('text-zinc-400')
    expect(classTokens(screen.getByText('95.6%'))).toContain('text-zinc-400')
  })

  it('puts a finished direct sprint on the board without restarting', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
    try {
      renderApp(['/competitive/run/competitive_mixed_01_001?duration=30000'])
      expect(screen.getByText('No runs yet — finish a sprint to get on the board.')).toBeTruthy()
      const input = screen.getByRole('textbox', { name: 'Typing input' }) as HTMLTextAreaElement
      const first = passageText()[0] ?? ''
      expect(first).not.toBe('')
      fireEvent.keyDown(input, { key: first })
      fireEvent.input(input, { target: { value: first }, isComposing: false })
      expect(input.value).toBe(first)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000)
      })
      expect(screen.getByText('Remaining').parentElement?.textContent).toContain('0:00')
      expect(input.value).toBe(first)
      expect(screen.getByRole('button', { name: 'Restart' })).toBeTruthy()
      expect(screen.getByText('0 WPM')).toBeTruthy()
      expect(screen.queryByText('No runs yet — finish a sprint to get on the board.')).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: 'Restart' }))
      expect((screen.getByRole('textbox', { name: 'Typing input' }) as HTMLTextAreaElement).value).toBe('')
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('daily set', () => {
  it('renders a set, keeps progress per session type, and passes screen reader mode', async () => {
    const user = setupUser()
    seedUser()
    seedDailySet('mix', [
      { kind: 'confidence', mode: 'focus', exerciseId: 'focus_calm_01_001' },
      { kind: 'targeted', mode: 'focus', exerciseId: 'focus_calm_01_002' },
      { kind: 'challenge', mode: 'competitive', exerciseId: 'competitive_mixed_01_001' },
      { kind: 'real_life', mode: 'real_life', exerciseId: 'real_life_email_01_001' },
      { kind: 'mix', mode: 'focus', exerciseId: 'focus_calm_01_003' },
      { kind: 'mix', mode: 'focus', exerciseId: 'not-a-real-exercise' },
    ])
    seedDailyProgress('mix', [{ wpm: 33.2, accuracy: 0.9, durationMs: 1000 }])
    seedDailySet('reset', [
      { kind: 'confidence', mode: 'focus', exerciseId: 'focus_calm_01_001' },
      { kind: 'mix', mode: 'focus', exerciseId: 'focus_calm_01_002' },
    ])
    seedDailyProgress('reset', [
      { wpm: 40, accuracy: 0.95, durationMs: 65_000 },
      { wpm: 50, accuracy: 1, durationMs: 5000 },
    ])
    const stamp = (iso: string) => Math.floor(Date.parse(iso) / 1000)
    for (const iso of ['2024-05-01T12:00:00Z', '2024-05-02T12:00:00Z', '2024-05-03T12:00:00Z', '2024-06-15T12:00:00Z']) {
      appendRun({
        exercise_id: 'focus_calm_01_001',
        timestamp: stamp(iso),
        mode: 'focus',
        wpm: 40,
        accuracy: 0.99,
        errors: 0,
        backspaces: 0,
        duration_ms: 1000,
      })
    }

    renderApp(['/daily'])
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy()
    expect(screen.getByText(/\d+ exercises • Standard set/)).toBeTruthy()
    expect(screen.getByText('Confidence win')).toBeTruthy()
    expect(screen.getByText('Targeted practice')).toBeTruthy()
    expect(screen.getByText('Challenge')).toBeTruthy()
    expect(screen.getByText('Real-life scenario')).toBeTruthy()
    expect(screen.getByText('Mix')).toBeTruthy()
    expect(screen.getAllByText(exerciseTitle('focus_calm_01_001')).length).toBeGreaterThan(0)
    expect(screen.getAllByText(exerciseTitle('focus_calm_01_002')).length).toBeGreaterThan(0)
    expect(screen.getAllByText(exerciseTitle('real_life_email_01_001')).length).toBeGreaterThan(0)
    expect(screen.getByText('33 wpm')).toBeTruthy()
    expect(screen.getByText('3/7 days')).toBeTruthy()
    expect(screen.getByText('Days practiced').parentElement?.textContent).toMatch(/4/)
    expect(screen.queryByText('not-a-real-exercise')).toBeNull()

    await user.click(screen.getByRole('link', { name: 'Short set' }))
    expect(await screen.findByRole('heading', { name: /Daily Set Complete/ })).toBeTruthy()
    expect(screen.getByText('1m 10s')).toBeTruthy()
    expect(screen.getByText('45')).toBeTruthy()
    expect(screen.getByText('97.5%')).toBeTruthy()
    expect(screen.getByText('Exercise breakdown')).toBeTruthy()
    expect(screen.getByText('40 wpm')).toBeTruthy()
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
    await user.click(screen.getByRole('button', { name: 'Back to Home' }))
    expect(screen.getByRole('heading', { name: /LoKey Typer/ })).toBeTruthy()
  })

  it('uses a separate screen-reader set and scrolls without animation when motion is reduced', async () => {
    seedUser()
    withPrefs({ screenReaderMode: true, reducedMotion: true })
    seedDailySet(
      'deep',
      [{ kind: 'confidence', mode: 'focus', exerciseId: 'focus_calm_01_001' }],
      true,
    )
    seedDailyProgress('deep', [{ wpm: 20, accuracy: 1, durationMs: 2000 }], true)
    const finished = renderApp(['/daily?type=deep'])
    expect(screen.getByText('2s')).toBeTruthy()
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' })
    finished.unmount()

    prefersReducedMotion = true
    scrollIntoView.mockClear()
    withPrefs({ screenReaderMode: true, reducedMotion: false })
    renderApp(['/daily?type=mix'])
    expect(screen.getByRole('button', { name: 'Begin' })).toBeTruthy()
    expect(screen.getByText(/\d+ exercises • Standard set/)).toBeTruthy()
    expect([...store.keys()].some((key) => key.startsWith('lkt_daily_set_v1|') && key.endsWith('|sr'))).toBe(true)
    expect(screen.queryByRole('heading', { name: /Daily Set Complete/ })).toBeNull()
  })

  it('advances a short item, restarts, and skips an exercise that will not load', async () => {
    const user = setupUser()
    seedUser()
    seedDailySet('reset', [
      { kind: 'confidence', mode: 'focus', exerciseId: 'focus_calm_01_001' },
      { kind: 'mix', mode: 'focus', exerciseId: 'focus_calm_01_002' },
    ])
    renderApp(['/daily?type=reset'])
    expect(screen.getByText('0/7 days')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Begin' }))
    const firstTitle = exerciseTitle('focus_calm_01_001')
    const secondTitle = exerciseTitle('focus_calm_01_002')
    expect(await screen.findByRole('heading', { name: firstTitle })).toBeTruthy()
    expect(screen.getAllByText(/Exercise 1 of 2/).length).toBeGreaterThan(0)
    const input = screen.getByRole('textbox', { name: 'Typing input' })
    await user.type(input, 'a')
    await user.click(screen.getByRole('button', { name: 'Restart' }))
    expect((screen.getByRole('textbox', { name: 'Typing input' }) as HTMLTextAreaElement).value).toBe('')
    const passage = passageText()
    expect(passage.length).toBeLessThan(400)
    await user.type(screen.getByRole('textbox', { name: 'Typing input' }), passage)
    expect(await screen.findByText('Nice!')).toBeTruthy()
    const nextUp = screen.getByText(/Next up:/)
    const kind = within(nextUp).getByText('Mix')
    expect(classTokens(kind)).toContain('text-zinc-300')
    const upcoming = within(nextUp).getByText(secondTitle)
    const dash = upcoming.previousElementSibling
    expect(dash?.textContent).toContain('\u2014')
    const dashTokens = classTokens(dash)
    const titleTokens = classTokens(upcoming)
    expect(screen.getByText(/Exercise complete/)).toBeTruthy()
    expect(await screen.findByRole('heading', { name: secondTitle }, { timeout: 4000 })).toBeTruthy()
    expect(screen.queryByText('Nice!')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Exit' }))
    expect(screen.getByRole('heading', { name: /LoKey Typer/ })).toBeTruthy()
    expect(dashTokens).toContain('text-zinc-400')
    expect(dashTokens).not.toContain('text-zinc-600')
    expect(titleTokens).toContain('text-zinc-400')
    expect(titleTokens).not.toContain('text-zinc-500')
  }, 20_000)

  it("stays on the exercise when today's progress cannot be stored", async () => {
    const user = setupUser()
    seedUser()
    seedDailySet('reset', [{ kind: 'mix', mode: 'focus', exerciseId: 'missing-daily-item' }])
    renderApp(['/daily?type=reset'])
    await user.click(screen.getByRole('button', { name: 'Begin' }))
    expect(await screen.findByText('Exercise unavailable')).toBeTruthy()

    const storage = globalThis.localStorage
    const write = storage.setItem.bind(storage)
    storage.setItem = (key: string, value: string) => {
      if (key.startsWith('lkt_daily_progress')) throw new Error('quota')
      write(key, value)
    }

    await user.click(screen.getByRole('button', { name: 'Skip to next' }))
    expect((await screen.findByRole('status')).textContent).toBe(
      "Today's set didn't keep this exercise. Try again.",
    )
    expect(screen.getByText('Exercise unavailable')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: /Daily Set Complete/ })).toBeNull()
    expect(screen.queryByText(/Exercise complete/)).toBeNull()
    expect([...store.keys()].some((key) => key.startsWith('lkt_daily_progress'))).toBe(false)
  })

  it('skips a missing exercise into the summary', async () => {
    const user = setupUser()
    seedUser()
    seedDailySet('reset', [{ kind: 'mix', mode: 'focus', exerciseId: 'missing-daily-item' }])
    renderApp(['/daily?type=reset'])
    await user.click(screen.getByRole('link', { name: 'Long set' }))
    expect(screen.getByText(/\d+ exercises • Long set/)).toBeTruthy()
    await user.click(screen.getByRole('link', { name: 'Short set' }))
    await user.click(screen.getByRole('button', { name: 'Begin' }))
    expect(await screen.findByText('Exercise unavailable')).toBeTruthy()
    expect(screen.getByText(/missing-daily-item/)).toBeTruthy()
    const loadTokens = classTokens(screen.getByText(/Couldn't load exercise/))
    await user.click(screen.getByRole('button', { name: 'Skip to next' }))
    expect(await screen.findByRole('heading', { name: /Daily Set Complete/ })).toBeTruthy()
    expect(screen.getByText('0s')).toBeTruthy()
    expect(screen.getByText('0.0%')).toBeTruthy()
    expect(screen.getByText(/Daily set complete/)).toBeTruthy()
    expect(loadTokens).toContain('text-zinc-400')
    expect(loadTokens).not.toContain('text-zinc-500')
  })

  it('formats a seconds-only summary', () => {
    seedUser()
    seedDailySet('deep', [
      { kind: 'confidence', mode: 'focus', exerciseId: 'focus_calm_01_001' },
      { kind: 'real_life', mode: 'real_life', exerciseId: 'real_life_email_01_001' },
    ])
    seedDailyProgress('deep', [
      { wpm: 10, accuracy: 0.5, durationMs: 2000 },
      { wpm: 12, accuracy: 0.5, durationMs: 3000 },
    ])
    renderApp(['/daily?type=deep'])
    expect(screen.getByText('5s')).toBeTruthy()
    expect(screen.getByText('11')).toBeTruthy()
    expect(screen.getAllByText('50.0%').length).toBeGreaterThan(0)
  })

  it('keeps Short and Long available after the standard set is finished', async () => {
    const user = setupUser()
    seedUser()
    seedDailySet('mix', [{ kind: 'confidence', mode: 'focus', exerciseId: 'focus_calm_01_001' }])
    seedDailyProgress('mix', [{ wpm: 40, accuracy: 1, durationMs: 1000 }])
    renderApp(['/daily'])
    expect(screen.getByRole('heading', { name: /Daily Set Complete/ })).toBeTruthy()
    expect(screen.getByRole('heading', { name: /Standard set/ })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Short set' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Standard set' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Long set' })).toBeTruthy()
    expect(classTokens(screen.getByText('Avg WPM'))).toContain('text-zinc-400')
    const backHome = screen.getByRole('button', { name: 'Back to Home' })
    const homeParent = backHome.parentElement
    const homeTokens = classTokens(homeParent)
    // Token, not a substring: sm:gap-4 does not count as gap-4.
    expect(homeTokens).toContain('flex')
    expect(homeTokens).toContain('flex-col')
    expect(homeTokens).toContain('gap-4')
    const lengthRow = screen.getByRole('link', { name: 'Short set' }).parentElement
    expect(lengthRow?.parentElement).toBe(homeParent)
    expect(lengthRow?.nextElementSibling).toBe(backHome)
    await user.click(screen.getByRole('link', { name: 'Long set' }))
    expect(await screen.findByRole('button', { name: 'Begin' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: /Daily Set Complete/ })).toBeNull()
  })

  it('paints the daily stat captions in quiet type', () => {
    seedUser()
    seedDailySet('mix', [{ kind: 'confidence', mode: 'focus', exerciseId: 'focus_calm_01_001' }])
    renderApp(['/daily'])
    expect(classTokens(screen.getByText('Days practiced'))).toContain('text-zinc-400')
    expect(classTokens(screen.getByText('Every day you show up counts.'))).toContain('text-zinc-400')
  })

  it('paints the best-week caption in quiet type', () => {
    seedUser()
    seedDailySet('mix', [{ kind: 'confidence', mode: 'focus', exerciseId: 'focus_calm_01_001' }])
    renderApp(['/daily'])
    expect(classTokens(screen.getByText('Most days typed in any 7-day window.'))).toContain('text-zinc-400')
  })

  it('paints the open daily exercise title in quiet type', async () => {
    const user = setupUser()
    seedUser()
    seedDailySet('mix', [{ kind: 'confidence', mode: 'focus', exerciseId: 'focus_calm_01_001' }])
    renderApp(['/daily'])
    await user.click(screen.getByRole('button', { name: 'Begin' }))
    const title = exerciseTitle('focus_calm_01_001')
    expect(await screen.findByRole('heading', { name: title })).toBeTruthy()
    const caption = screen.getAllByText(title).find((node) => node.tagName !== 'H1')
    expect(classTokens(caption)).toContain('text-zinc-400')
    const bullet = caption?.previousElementSibling
    expect(bullet?.textContent).toBe('•')
    expect(classTokens(bullet)).toContain('text-zinc-400')
    expect(classTokens(bullet)).not.toContain('text-zinc-600')
    expect(classTokens(bullet)).not.toContain('text-zinc-500')
  })
})

describe('providers, boundary, and bootstrap', () => {
  it('throws usePreferences outside the provider and no-ops useAmbient', async () => {
    const user = setupUser()
    function BarePrefs() {
      usePreferences()
      return <div>prefs</div>
    }
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(() => render(<BarePrefs />)).toThrow(/usePreferences must be used within PreferencesProvider/)
    } finally {
      error.mockRestore()
    }

    function BareAmbient() {
      const ambient = useAmbient()
      return (
        <button
          type="button"
          onClick={() => {
            ambient.noteTypingActivity()
            ambient.skipTrack()
          }}
        >
          Ambient probe
        </button>
      )
    }
    render(<BareAmbient />)
    await user.click(screen.getByRole('button', { name: 'Ambient probe' }))
    expect(mocks.ambientPlayer.skipTrack).not.toHaveBeenCalled()
    expect(mocks.ambientPlayer.noteTypingActivity).not.toHaveBeenCalled()
  })

  it('drops reduced motion on unmount and falls back when a saved category is not shipped', async () => {
    withPrefs({ reducedMotion: true, ambientCategory: 'campfire' })
    const view = renderApp()
    expect(document.documentElement.classList.contains('reduce-motion')).toBe(true)
    await waitFor(() => expect(loadPreferences().ambientCategory).toBe('all'))
    await waitFor(() =>
      expect(mocks.ambientPlayer.setPreferences).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'all', reducedMotion: true, enabled: true }),
      ),
    )
    view.unmount()
    expect(document.documentElement.classList.contains('reduce-motion')).toBe(false)
  })

  it('keeps a saved category that the manifest still offers', async () => {
    withPrefs({ ambientCategory: 'ocean' })
    renderApp()
    await waitFor(() =>
      expect(mocks.ambientPlayer.setPreferences).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'ocean', volume: 0.5, pauseOnTyping: false, screenReaderMode: false }),
      ),
    )
    expect(loadPreferences().ambientCategory).toBe('ocean')
  })

  it('unlocks ambient on a gesture and ignores a gesture after unmount', async () => {
    const first = renderApp()
    window.dispatchEvent(new Event('touchstart'))
    await waitFor(() => expect(mocks.ambientPlayer.start).toHaveBeenCalledTimes(1))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))
    await Promise.resolve()
    expect(mocks.ambientPlayer.start).toHaveBeenCalledTimes(1)
    first.unmount()

    mocks.ambientPlayer.start.mockClear()
    const second = renderApp()
    second.unmount()
    window.dispatchEvent(new Event('click'))
    await Promise.resolve()
    expect(mocks.ambientPlayer.start).not.toHaveBeenCalled()
  })

  it('keeps the sound retry when start does not begin a track', async () => {
    ;(mocks.ambientPlayer as { isStarted?: () => boolean }).isStarted = () => false
    renderApp()
    window.dispatchEvent(new Event('touchstart'))
    const status = await screen.findByText("Sound didn't start. Try again.")
    const retry = screen.getByRole('button', { name: "Sound couldn't start. Click to try again." })
    const nav = screen.getByRole('navigation', { name: 'Main navigation' })
    const settings = screen.getByRole('button', { name: 'Settings' })
    expect(nav.contains(status)).toBe(false)
    expect(nav.contains(retry)).toBe(false)
    expect(status.parentElement).toBe(settings.parentElement)
    expect(retry.parentElement).toBe(settings.parentElement)
    expect(status.parentElement).not.toBe(nav)
    expect(classTokens(settings.parentElement)).toContain('shrink-0')
    expect(screen.queryByRole('button', { name: 'Mute ambient' })).toBeNull()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))
    await waitFor(() => expect(mocks.ambientPlayer.start).toHaveBeenCalledTimes(2))
  })

  it('cancels a category lookup that finishes after unmount', async () => {
    let resolveFetch: (value: unknown) => void = () => {}
    mocks.fetchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve
        }),
    )
    withPrefs({ ambientCategory: 'night' })
    const view = renderApp()
    view.unmount()
    resolveFetch(jsonResponse({ version: 3, tracks: [RAIN_TRACK] }))
    await Promise.resolve()
    await Promise.resolve()
    expect(loadPreferences().ambientCategory).toBe('night')
  })

  it('shows the boundary when a child throws', async () => {
    const user = setupUser()
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const reloadSpy = spyOnReload()
    function Bomb(): ReactNode {
      throw new Error('boom')
    }
    try {
      const fine = render(
        <ErrorBoundary>
          <p>All good</p>
        </ErrorBoundary>,
      )
      expect(screen.getByText('All good')).toBeTruthy()
      fine.unmount()

      render(
        <ErrorBoundary>
          <Bomb />
        </ErrorBoundary>,
      )
      expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeTruthy()
      expect(screen.getByText(/A refresh should fix it/)).toBeTruthy()
      await user.click(screen.getByRole('button', { name: 'Refresh page' }))
      expect(reloadSpy.reload).toHaveBeenCalled()
    } finally {
      reloadSpy.restore()
      error.mockRestore()
    }
  })

  it('renders a missing icon as nothing', () => {
    const { container } = render(<Icon name={'not-real' as IconName} />)
    expect(container.querySelector('svg')).toBeNull()
    const shown = render(<Icon name="logo-mark" />)
    expect(shown.container.querySelector('svg')).toBeTruthy()
  })

  it('boots the createRoot app into #root', async () => {
    window.history.pushState({}, '', '/lokey-typer/')
    document.body.innerHTML = '<div id="root"></div>'
    await import('../src/main.tsx')
    expect(await screen.findByRole('link', { name: (name) => name === 'LoKey Typer' })).toBeTruthy()
    expect(document.getElementById('root')?.textContent).toMatch(/Start typing/)
  })
})
