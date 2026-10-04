// @vitest-environment jsdom
import { act, cleanup, createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Exercise, Mode } from '../src/content/types'
import type { Preferences, SprintDurationMs } from '../src/lib/storage'
import { loadSkillModel, sanitizePreferences } from '../src/lib/storage'
import { graphemesOf } from '../src/lib/typingEdit'

class FakeAudioParam {
  value = 0
  cancelScheduledValues() {}
  setValueAtTime() {}
  linearRampToValueAtTime() {}
  exponentialRampToValueAtTime() {}
  setTargetAtTime() {}
}

class FakeAudioNode {
  connect() {
    return this
  }
  disconnect() {}
}

class FakeGain extends FakeAudioNode {
  gain = new FakeAudioParam()
}

class FakeBufferSource extends FakeAudioNode {
  buffer: AudioBuffer | null = null
  playbackRate = new FakeAudioParam()
  onended: (() => void) | null = null
  start() {}
  stop() {}
}

class FakeAudioContext {
  state: AudioContextState = 'running'
  currentTime = 0
  sampleRate = 44100
  destination = new FakeAudioNode()
  resume() {
    this.state = 'running'
    return Promise.resolve()
  }
  suspend() {
    return Promise.resolve()
  }
  close() {
    return Promise.resolve()
  }
  createGain() {
    return new FakeGain()
  }
  createBufferSource() {
    return new FakeBufferSource()
  }
  createBuffer(channels: number, length: number, sampleRate: number): AudioBuffer {
    const data = Array.from({ length: channels }, () => new Float32Array(length))
    return {
      numberOfChannels: channels,
      length,
      sampleRate,
      duration: length / sampleRate,
      getChannelData: (channel: number) => data[channel] ?? data[0],
      copyFromChannel() {},
      copyToChannel() {},
    } as AudioBuffer
  }
  decodeAudioData() {
    return Promise.resolve(this.createBuffer(1, 8, this.sampleRate))
  }
}

function installAudioStubs() {
  const Ctx = FakeAudioContext as unknown as typeof AudioContext
  vi.stubGlobal('AudioContext', Ctx)
  vi.stubGlobal('webkitAudioContext', Ctx)
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => new ArrayBuffer(8),
      json: async () => ({ version: 1, tracks: [] }),
      text: async () => '',
    })),
  )
}

installAudioStubs()

const { typewriterAudio } = await import('../src/lib/audio')
const { TypingOverlay, TypingSession } = await import('../src/features/typing')

const originalLocalStorage = globalThis.localStorage

function installMemoryStorage() {
  const store = new Map<string, string>()
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
  return store
}

function makeExercise(overrides: Record<string, unknown> = {}): Exercise {
  return {
    id: 'ex-1',
    mode: 'focus',
    pack: 'Practice',
    title: 'Steady hands',
    difficulty: 2,
    estimated_seconds: 20,
    tags: ['numbers', 'made-up'],
    text: 'ab',
    ...overrides,
  } as Exercise
}

function seedPersonalBest(
  exerciseId: string,
  wpm: number,
  accuracy = 1,
  sprint?: SprintDurationMs,
) {
  const key = `${exerciseId}|${sprint ?? 0}`
  const row: Record<string, unknown> = {
    exercise_id: exerciseId,
    wpm,
    accuracy,
    timestamp: 1_700_000_000,
  }
  if (sprint) row.sprint_duration_ms = sprint
  localStorage.setItem('lkt_pbs_v1', JSON.stringify({ byKey: { [key]: row } }))
}

function seedRun(exerciseId: string, wpm: number, accuracy: number, sprint?: SprintDurationMs) {
  localStorage.setItem(
    'lkt_runs_v1',
    JSON.stringify([
      {
        v: 2,
        exercise_id: exerciseId,
        timestamp: 1_700_000_000,
        mode: 'focus',
        wpm,
        accuracy,
        errors: 0,
        backspaces: 0,
        duration_ms: 1000,
        ...(sprint ? { sprint_duration_ms: sprint } : {}),
      },
    ]),
  )
}

function savedRuns(): Array<{ tags_hit?: string[]; rendered_text_hash?: string; exercise_id?: string }> {
  return JSON.parse(localStorage.getItem('lkt_runs_v1') ?? '[]') as Array<{
    tags_hit?: string[]
    rendered_text_hash?: string
    exercise_id?: string
  }>
}

type CompleteFn = (result: { wpm: number; accuracy: number; durationMs: number }) => void

function renderSession(
  overrides: {
    mode?: Mode
    exercise?: Exercise
    targetText?: string
    prefs?: Partial<Preferences>
    sprintDurationMs?: SprintDurationMs
    showCompetitiveHud?: boolean
    ghostEnabled?: boolean
    onComplete?: CompleteFn | null
  } = {},
) {
  const onExit = vi.fn()
  const onRestart = vi.fn()
  const onComplete = overrides.onComplete === null ? undefined : (overrides.onComplete ?? vi.fn())
  const view = render(
    <TypingSession
      mode={overrides.mode ?? 'focus'}
      exercise={overrides.exercise ?? makeExercise()}
      targetText={overrides.targetText ?? 'ab'}
      prefs={sanitizePreferences(overrides.prefs)}
      sprintDurationMs={overrides.sprintDurationMs}
      showCompetitiveHud={overrides.showCompetitiveHud ?? false}
      ghostEnabled={overrides.ghostEnabled}
      onExit={onExit}
      onRestart={onRestart}
      onComplete={onComplete}
    />,
  )
  const input = screen.getByRole('textbox', { name: 'Typing input' }) as HTMLTextAreaElement
  return { ...view, input, onExit, onRestart, onComplete }
}

function typeAll(input: HTMLTextAreaElement, text: string) {
  let value = input.value
  for (const grapheme of graphemesOf(text)) {
    value += grapheme
    const key = grapheme === '\n' ? 'Enter' : grapheme === ' ' ? ' ' : grapheme.length === 1 ? grapheme : 'Unidentified'
    fireEvent.keyDown(input, { key })
    fireEvent.input(input, { target: { value }, isComposing: false })
  }
}

function statValue(label: string) {
  const labelNode = screen.getByText(label)
  const value = labelNode.parentElement?.querySelector('.tabular-nums')
  if (!value?.textContent) throw new Error(`missing stat ${label}`)
  return value.textContent
}

function passage() {
  const node = document.querySelector('.whitespace-pre-wrap')
  if (!node) throw new Error('missing passage')
  return node
}

describe('TypingSession', () => {
  let play: ReturnType<typeof vi.spyOn>
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    vi.useRealTimers()
    installAudioStubs()
    installMemoryStorage()
    play = vi.spyOn(typewriterAudio, 'play').mockImplementation(() => {})
    vi.spyOn(typewriterAudio, 'ensureReady').mockResolvedValue(undefined)
    vi.spyOn(typewriterAudio, 'resume').mockResolvedValue(undefined)
    user = userEvent.setup()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    Object.defineProperty(globalThis, 'localStorage', { value: originalLocalStorage, configurable: true })
  })

  it('accepts one typed character, rejects a pasted sentence, and blocks drop', async () => {
    const { input, onComplete } = renderSession({ targetText: 'ab' })

    expect(input.getAttribute('autocapitalize')).toBe('off')
    expect(input.getAttribute('autocorrect')).toBe('off')
    expect(input.getAttribute('autocomplete')).toBe('off')
    expect(input.getAttribute('spellcheck')).toBe('false')
    expect(screen.getByText('Progress')).toBeTruthy()
    expect(screen.queryByText('Remaining')).toBeNull()
    expect(passage().querySelector('.cursor-blink')).toBeTruthy()
    expect(passage().querySelector('.text-zinc-400').textContent).toBe('ab')

    await user.type(input, 'a')
    expect(input.value).toBe('a')
    expect(graphemesOf(input.value)).toHaveLength(1)
    expect(passage().querySelector('.text-zinc-50').textContent).toBe('a')
    expect(passage().querySelector('.text-zinc-400').textContent).toBe('b')

    const pasted = createEvent.paste(input)
    fireEvent(input, pasted)
    expect(pasted.defaultPrevented).toBe(true)
    await user.paste('Slow is smooth; smooth is fast.')
    fireEvent.input(input, { target: { value: `aSlow is smooth; smooth is fast.` } })
    expect(input.value).toBe('a')
    expect(graphemesOf(input.value).length).toBeLessThanOrEqual(1)

    const dropped = createEvent.drop(input)
    fireEvent(input, dropped)
    expect(dropped.defaultPrevented).toBe(true)
    expect(input.value).toBe('a')
    expect(onComplete).not.toHaveBeenCalled()

    fireEvent.input(input, { target: { value: 'z' } })
    expect(passage().querySelector('.text-rose-400').textContent).toBe('z')
    expect(passage().querySelector('.text-rose-400')?.className).toContain('underline')
    expect(passage().querySelector('.text-zinc-400').textContent).toBe('b')
  })

  it('accepts one emoji grapheme and rejects two emoji in one edit', () => {
    const { input } = renderSession({ targetText: '👍!' })

    fireEvent.input(input, { target: { value: '👍👍' } })
    expect(input.value).toBe('')

    fireEvent.input(input, { target: { value: '👍' } })
    expect(input.value).toBe('👍')
    expect(graphemesOf(input.value)).toHaveLength(1)

    fireEvent.input(input, { target: { value: '👍👍👍' } })
    expect(input.value).toBe('👍')
  })

  it('shows the preedit, then scores the commit from the composition start', async () => {
    const onComplete = vi.fn()
    const { input } = renderSession({ targetText: 'ab', onComplete })

    fireEvent.compositionStart(input)
    fireEvent.input(input, { target: { value: 'ab' }, isComposing: true })
    expect(input.value).toBe('ab')
    expect(screen.getByText(/All characters supported/)).toBeTruthy()
    expect(onComplete).not.toHaveBeenCalled()

    fireEvent.input(input, { target: { value: 'zz' }, isComposing: true })
    expect(input.value).toBe('zz')
    expect(onComplete).not.toHaveBeenCalled()

    fireEvent.compositionEnd(input, { target: { value: 'zab' } })
    expect(input.value).toBe('zab')
    expect(graphemesOf('zab').length).toBeGreaterThan(1)
    expect(onComplete).not.toHaveBeenCalled()

    fireEvent.input(input, { target: { value: '' }, isComposing: false })
    fireEvent.input(input, { target: { value: 'a' }, isComposing: false })
    fireEvent.input(input, { target: { value: 'ab' }, isComposing: false })

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
    const skill = loadSkillModel()
    expect(skill.errors_by_class.letters).toBeCloseTo(0.4)
    expect(skill.errors_by_class.overflow).toBeCloseTo(0.2)
  })

  it('follows a composing input that never received compositionstart', () => {
    const { input, onComplete } = renderSession({ targetText: 'ab' })

    fireEvent.input(input, { target: { value: 'qq' }, isComposing: true })
    expect(input.value).toBe('qq')
    expect(onComplete).not.toHaveBeenCalled()

    fireEvent.compositionEnd(input, { target: { value: 'qq' } })
    expect(input.value).toBe('qq')
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('counts backspace and leaves the field one grapheme shorter', async () => {
    const { input } = renderSession({
      mode: 'real_life',
      targetText: 'ab',
      prefs: { showLiveWpm: { focus: false, real_life: true, competitive: true } },
    })

    expect(statValue('WPM')).toBe('0')
    expect(screen.queryByText('Progress')).toBeNull()
    await user.type(input, 'a{Backspace}')
    expect(input.value).toBe('')
    expect(statValue('Backspaces')).toBe('1')
    expect(play).toHaveBeenCalledWith('backspace', expect.objectContaining({ modeGain: 0.85 }))

    typeAll(input, 'ab')
    await waitFor(() =>
      expect(play).toHaveBeenCalledWith('return_bell', expect.objectContaining({ modeGain: 0.85 })),
    )
  })

  it('plays key, error, space, and enter without playing for modifiers', () => {
    const fresh = renderSession({ targetText: 'ab' })
    fireEvent.keyDown(fresh.input, { key: 'Shift' })
    fireEvent.keyDown(fresh.input, { key: 'Enter' })
    fresh.unmount()

    const { input } = renderSession({ targetText: 'ab' })

    fireEvent.keyDown(input, { key: 'a' })
    fireEvent.keyDown(input, { key: 'z' })
    fireEvent.keyDown(input, { key: ' ' })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.keyDown(input, { key: 'Shift' })
    fireEvent.keyDown(input, { key: 'a', ctrlKey: true })
    fireEvent.keyDown(input, { key: 'a', metaKey: true })
    fireEvent.keyDown(input, { key: 'a', altKey: true })

    expect(play).toHaveBeenCalledWith('key', expect.objectContaining({ modeGain: 0.7, volume: 0.5 }))
    expect(play).toHaveBeenCalledWith('error', expect.objectContaining({ modeGain: 0.7, volume: 0.3 }))
    expect(play).toHaveBeenCalledWith('spacebar', expect.objectContaining({ modeGain: 0.7 }))
    expect(play).toHaveBeenCalledWith('key', expect.objectContaining({ modeGain: 0.7 }))
    expect(play).not.toHaveBeenCalledWith('key', expect.objectContaining({ enabled: false }))
    expect(input.value).toBe('')

    cleanup()
    const competitive = renderSession({ mode: 'competitive', targetText: 'ab', showCompetitiveHud: false })
    fireEvent.keyDown(competitive.input, { key: 'a' })
    expect(play).toHaveBeenCalledWith('key', expect.objectContaining({ modeGain: 1 }))
    expect(screen.getByText(/Personal bests require/)).toBeTruthy()
  })

  it('exits on Escape and restarts from the button without reloading', async () => {
    const { input, onExit, onRestart } = renderSession()

    await user.click(input)
    await user.keyboard('{Escape}')
    expect(onExit).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Exit' }))
    expect(onExit).toHaveBeenCalledTimes(2)

    await user.click(screen.getByRole('button', { name: 'Restart' }))
    expect(onRestart).toHaveBeenCalledTimes(1)
  })

  it('focuses from the button and resumes audio on focus', async () => {
    const { input } = renderSession({ prefs: { fontScale: 1.1 } })
    expect(input.style.fontSize).toContain('0.9625rem')

    fireEvent.focus(input)
    fireEvent.blur(input)
    await waitFor(() => expect(typewriterAudio.ensureReady).toHaveBeenCalled())
    expect(typewriterAudio.resume).toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Focus' }))
    expect(document.activeElement).toBe(input)
  })

  it('hides live WPM unless the mode asks for it, and shows the competitive clock', () => {
    const hidden = renderSession({
      mode: 'focus',
      showCompetitiveHud: false,
      prefs: { focusMinimalHud: false },
      targetText: 'ab',
    })
    expect(statValue('WPM')).toBe('Hidden')
    expect(statValue('Backspaces')).toBe('0')
    expect(statValue('Time')).toBe('0:00')
    expect(screen.queryByText('Remaining')).toBeNull()
    hidden.unmount()

    renderSession({
      mode: 'competitive',
      showCompetitiveHud: true,
      sprintDurationMs: 60_000,
      targetText: 'ab',
    })
    expect(screen.getByText('Remaining')).toBeTruthy()
    expect(statValue('Remaining')).toBe('1:00')
    expect(statValue('WPM')).toBe('0')
    expect(statValue('Accuracy')).toBe('100%')
    expect(statValue('Errors')).toBe('0')
    expect(screen.queryByText('Backspaces')).toBeNull()
  })

  it('shows a competitive dash when the sprint has no time limit', () => {
    renderSession({ mode: 'competitive', showCompetitiveHud: true, targetText: 'ab' })
    expect(statValue('Remaining')).toBe('—')
  })

  it('calls onComplete once when the passage matches and there is no time limit', async () => {
    seedRun('ex-1', 50, 1)
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
    const onComplete = vi.fn()
    const { input } = renderSession({
      targetText: 'ab',
      onComplete,
      prefs: { bellOnCompletion: false },
    })

    typeAll(input, 'ab')
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
    expect(onComplete).toHaveBeenCalledWith({ wpm: 0, accuracy: 1, durationMs: 0 })
    expect(screen.getByText('Strong accuracy. Nice, steady work.')).toBeTruthy()
    expect(screen.queryByText(/All characters supported/)).toBeNull()
    expect(passage().querySelector('.cursor-blink')).toBeNull()
    expect(play).not.toHaveBeenCalledWith('return_bell', expect.anything())

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 180))
    })
    expect(onComplete).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(input, { key: 'z' })
    fireEvent.input(input, { target: { value: 'abz' } })
    fireEvent.compositionStart(input)
    fireEvent.input(input, { target: { value: 'nope' }, isComposing: true })
    fireEvent.compositionEnd(input, { target: { value: 'nope' } })
    fireEvent.blur(input)
    expect(input.value).toBe('ab')
    expect(passage().textContent).toContain('ab')
    expect(onComplete).toHaveBeenCalledTimes(1)

    const runs = savedRuns()
    expect(runs.some((run) => run.exercise_id === 'ex-1' && run.rendered_text_hash)).toBe(true)
  })

  it('rings the bell and records a new personal best for a clean focus run', async () => {
    const onComplete = vi.fn()
    const { input } = renderSession({ targetText: 'ab', onComplete })

    typeAll(input, 'ab')
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
    expect(screen.getByText('New personal best, and you kept it clean.')).toBeTruthy()
    expect(play).toHaveBeenCalledWith(
      'return_bell',
      expect.objectContaining({ modeGain: 0.7, enabled: true }),
    )
  })

  it('keeps a same-length replacement and ignores an unchanged value', () => {
    const { input } = renderSession({ targetText: 'ab' })
    fireEvent.input(input, { target: { value: 'a' } })
    fireEvent.input(input, { target: { value: 'a' } })
    fireEvent.input(input, { target: { value: 'b' } })
    expect(input.value).toBe('b')
    expect(passage().querySelector('.text-rose-400').textContent).toBe('b')
  })

  it('records passage tags, including exercise tags, when the run ends', async () => {
    const rich = 'Go 1\n"Q" it\'s 2-a (b) [c] {d} <e> / \\ ?'
    const { input } = renderSession({
      exercise: makeExercise({ id: 'rich', tags: ['numbers', 'made-up'] }),
      targetText: rich,
    })

    typeAll(input, rich)
    await waitFor(() => expect(savedRuns().some((run) => run.exercise_id === 'rich')).toBe(true))
    const run = savedRuns().find((item) => item.exercise_id === 'rich')
    expect(run?.rendered_text_hash).toMatch(/^[0-9a-f]{8}$/)
    expect(run?.tags_hit).toEqual([
      'multiline',
      'numbers',
      'punctuation',
      'quotes',
      'apostrophe',
      'dashes',
      'brackets',
      'slashes',
    ])
  })

  it('completes when the exercise has no tags and when the target is empty', async () => {
    const bare = renderSession({
      exercise: makeExercise({ id: 'bare', tags: undefined }),
      targetText: 'ab',
    })
    typeAll(bare.input, 'ab')
    await waitFor(() => expect(savedRuns().some((run) => run.exercise_id === 'bare')).toBe(true))
    expect(savedRuns().find((run) => run.exercise_id === 'bare')?.tags_hit).toEqual([])
    bare.unmount()

    const empty = renderSession({
      exercise: makeExercise({ id: 'empty', tags: [] }),
      targetText: '',
      onComplete: null,
    })
    fireEvent.compositionStart(empty.input)
    fireEvent.compositionEnd(empty.input, { target: { value: '' } })
    await waitFor(() => expect(screen.queryByText(/All characters supported/)).toBeNull())
    expect(savedRuns().some((run) => run.exercise_id === 'empty')).toBe(true)
  })

  it('still finishes the run when the skill model update throws', async () => {
    const onComplete = vi.fn()
    const { input } = renderSession({
      exercise: makeExercise({ id: 'broken-template', type: 'template' }),
      targetText: 'ab',
      onComplete,
    })

    typeAll(input, 'ab')
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
    expect(loadSkillModel().total_runs).toBe(0)
  })

  it('draws the ghost only for a started competitive run that has a personal best', () => {
    seedPersonalBest('ex-1', 80, 1)
    const idle = renderSession({
      mode: 'competitive',
      showCompetitiveHud: true,
      ghostEnabled: true,
      targetText: 'hello',
    })
    expect(document.querySelector('[title="Ghost (PB pace)"]')).toBeNull()
    fireEvent.input(idle.input, { target: { value: 'h' } })
    const ghost = document.querySelector('[title="Ghost (PB pace)"]')
    expect(ghost).toBeTruthy()
    expect(ghost?.className).toContain('bg-zinc-400')
    expect(ghost?.className).not.toContain('bg-zinc-50')
    const caret = document.querySelector('.cursor-blink')
    expect(caret?.className).toContain('bg-zinc-300/70')
    idle.unmount()

    const focus = renderSession({ mode: 'focus', ghostEnabled: true, targetText: 'hello' })
    fireEvent.input(focus.input, { target: { value: 'h' } })
    expect(document.querySelector('[title="Ghost (PB pace)"]')).toBeNull()
    focus.unmount()

    installMemoryStorage()
    const noBest = renderSession({
      mode: 'competitive',
      ghostEnabled: true,
      showCompetitiveHud: false,
      targetText: 'hello',
    })
    fireEvent.input(noBest.input, { target: { value: 'h' } })
    expect(document.querySelector('[title="Ghost (PB pace)"]')).toBeNull()
    noBest.unmount()

    seedPersonalBest('ex-1', 80, 1)
    const off = renderSession({
      mode: 'competitive',
      ghostEnabled: false,
      showCompetitiveHud: false,
      targetText: 'hello',
    })
    fireEvent.input(off.input, { target: { value: 'h' } })
    expect(document.querySelector('[title="Ghost (PB pace)"]')).toBeNull()
  })

  it('ends a sprint when the clock passes the time limit', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
    seedPersonalBest('ex-1', 40, 1, 30_000)
    const onComplete = vi.fn()
    const { input } = renderSession({
      mode: 'competitive',
      showCompetitiveHud: true,
      ghostEnabled: true,
      sprintDurationMs: 30_000,
      targetText: 'ab',
      onComplete,
    })

    expect(statValue('Remaining')).toBe('0:30')
    typeAll(input, 'ab')
    fireEvent.keyDown(input, { key: 'z' })
    expect(onComplete).not.toHaveBeenCalled()
    expect(input.value).toBe('ab')
    expect(document.querySelector('[title="Ghost (PB pace)"]')).toBeTruthy()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })
    expect(onComplete).not.toHaveBeenCalled()
    expect(statValue('Remaining')).toBe('0:20')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000)
    })
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(statValue('Remaining')).toBe('0:00')
    expect(screen.getByText('New PB accuracy. Clean run.')).toBeTruthy()
    expect(screen.getByText(/Down vs best/)).toBeTruthy()
    expect(screen.getByText(/ΔWPM/)).toBeTruthy()
    expect(screen.getByText(/PB:/)).toBeTruthy()
    expect(document.querySelector('[title="Ghost (PB pace)"]')).toBeNull()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000)
    })
    expect(onComplete).toHaveBeenCalledTimes(1)
    const result = onComplete.mock.calls[0]?.[0] as { accuracy: number; durationMs: number }
    expect(result.accuracy).toBe(1)
    expect(result.durationMs).toBe(30_000)
  })

  it('ends a sprint with low accuracy and does not show the WPM delta', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
    seedPersonalBest('sprint-low', 40, 1, 30_000)
    seedRun('sprint-low', 10, 0.99, 30_000)
    const onComplete = vi.fn()
    const target = 'abcdefghij'
    const { input } = renderSession({
      mode: 'competitive',
      exercise: makeExercise({ id: 'sprint-low' }),
      showCompetitiveHud: true,
      sprintDurationMs: 30_000,
      targetText: target,
      onComplete,
      prefs: { bellOnCompletion: true, soundEnabled: false },
    })

    typeAll(input, 'x'.repeat(10))
    expect(onComplete).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Accuracy dipped. A cleaner run is available.')).toBeTruthy()
    expect(screen.getByText(/Down vs best/)).toBeTruthy()
    expect(screen.getByText(/PB:/)).toBeTruthy()
    expect(screen.queryByText(/ΔWPM/)).toBeNull()
    expect(screen.getByText(/Errors: 10/)).toBeTruthy()
    expect(play).toHaveBeenCalledWith('return_bell', expect.objectContaining({ enabled: false, modeGain: 1 }))
  })

  it('treats a faster run as a WPM personal best', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
    seedRun('faster', 1, 0.5)
    const { input } = renderSession({
      exercise: makeExercise({ id: 'faster' }),
      targetText: 'ab',
      prefs: {
        focusMinimalHud: false,
        bellOnCompletion: false,
        showLiveWpm: { focus: true, real_life: false, competitive: true },
      },
    })

    fireEvent.input(input, { target: { value: 'a' }, isComposing: false })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000)
    })
    fireEvent.input(input, { target: { value: 'ab' }, isComposing: false })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(screen.getByText('New personal best, and you kept it clean.')).toBeTruthy()
    expect(statValue('WPM')).not.toBe('0')
    expect(statValue('WPM')).not.toBe('Hidden')
  })

  it('does not treat a blocked run write as a saved finish', async () => {
    const onComplete = vi.fn()
    const { input } = renderSession({
      targetText: 'ab',
      onComplete,
      prefs: { bellOnCompletion: true, soundEnabled: true },
    })
    const storage = globalThis.localStorage
    const write = storage.setItem.bind(storage)
    storage.setItem = (key: string, value: string) => {
      if (key === 'lkt_runs_v1') throw new Error('quota')
      write(key, value)
    }

    typeAll(input, 'ab')
    await waitFor(() => {
      expect(screen.getByText("This finish didn't save. Restart to try again.")).toBeTruthy()
    })
    expect(onComplete).not.toHaveBeenCalled()
    expect(play).not.toHaveBeenCalledWith('return_bell', expect.anything())
    expect(screen.queryByText('Strong accuracy. Nice, steady work.')).toBeNull()
    expect(localStorage.getItem('lkt_runs_v1')).toBeNull()

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 180))
    })
    expect(onComplete).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Restart' })).toBeTruthy()
  })

  it('mentions frequent corrections after many backspaces', async () => {
    const { input } = renderSession({
      targetText: 'ab',
      prefs: { focusMinimalHud: false, bellOnCompletion: false },
    })
    fireEvent.input(input, { target: { value: 'a' } })
    for (let i = 0; i < 15; i++) fireEvent.keyDown(input, { key: 'Backspace' })
    fireEvent.input(input, { target: { value: 'ab' } })
    await waitFor(() => expect(screen.getByText('Corrections were frequent.')).toBeTruthy())
    expect(statValue('Backspaces')).toBe('15')
  })

  it('reads the passage from the field and speaks a miss or a beat in screen reader mode', async () => {
    vi.useFakeTimers()
    const quiet = renderSession({ targetText: 'ab' })
    const quietBy = quiet.input.getAttribute('aria-describedby') ?? ''
    expect(quietBy.startsWith('typing-help-')).toBe(true)
    expect(quietBy.includes(' ')).toBe(false)
    expect(document.getElementById(quietBy)?.textContent).toContain('ab')
    expect(document.getElementById(quietBy)?.textContent).toContain('All characters supported')
    fireEvent.input(quiet.input, { target: { value: 'z' } })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400)
    })
    expect(screen.queryByText('Expected a.')).toBeNull()
    quiet.unmount()

    const missed = renderSession({ targetText: 'ab', prefs: { screenReaderMode: true } })
    expect(passage().getAttribute('aria-hidden')).toBe('true')
    const describedBy = missed.input.getAttribute('aria-describedby') ?? ''
    expect(describedBy.startsWith('typing-help-')).toBe(true)
    expect(document.getElementById(describedBy)?.textContent).toContain('ab')
    fireEvent.input(missed.input, { target: { value: 'z' } })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400)
    })
    expect(screen.getByText('Expected a.')).toBeTruthy()
    missed.unmount()

    const beat = renderSession({ targetText: 'a'.repeat(20), prefs: { screenReaderMode: true } })
    typeAll(beat.input, 'a'.repeat(20))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400)
    })
    expect(screen.getByText('20 of 20.')).toBeTruthy()
  })
})

describe('TypingOverlay', () => {
  function view(
    props: Partial<{
      target: string
      typed: string
      showCursor: boolean
      ghostIndex: number | null
      fontScale: number
    }> = {},
  ) {
    const { container } = render(
      <TypingOverlay
        target={props.target ?? 'hello'}
        typed={props.typed ?? ''}
        showCursor={props.showCursor ?? true}
        ghostIndex={props.ghostIndex}
        fontScale={props.fontScale ?? 1}
      />,
    )
    const root = container.firstElementChild as HTMLElement
    return root
  }

  it('marks correct, incorrect, pending, and the caret', () => {
    const partial = view({ target: 'hello', typed: 'he' })
    expect(partial.style.fontSize).toBe('calc(0.875rem)')
    expect(partial.querySelector('.text-zinc-50').textContent).toBe('he')
    expect(partial.querySelector('.text-zinc-400').textContent).toBe('llo')
    expect(partial.querySelector('.text-rose-400')).toBeNull()
    expect(partial.querySelectorAll('.cursor-blink')).toHaveLength(1)
    partial.remove()

    const wrong = view({ target: 'hello', typed: 'hx' })
    expect(wrong.querySelector('.text-zinc-50').textContent).toBe('h')
    const marked = wrong.querySelector('.text-rose-400')
    expect(marked.textContent).toBe('x')
    expect(marked?.className).toContain('underline')
    expect(wrong.querySelector('.text-zinc-400').textContent).toBe('llo')
    const kids = [...wrong.childNodes].map((node) => (node as HTMLElement).className)
    expect(kids.some((cls) => cls.includes('cursor-blink'))).toBe(true)
    wrong.remove()

    const extra = view({ target: 'hi', typed: 'hide', showCursor: true })
    expect(extra.querySelector('.text-zinc-50').textContent).toBe('hi')
    expect(extra.querySelector('.text-rose-400').textContent).toBe('de')
    expect(extra.querySelector('.text-zinc-400')).toBeNull()
    expect(extra.querySelector('.cursor-blink')).toBeTruthy()
    extra.remove()

    const quiet = view({ target: 'hi', typed: 'h', showCursor: false })
    expect(quiet.querySelector('.cursor-blink')).toBeNull()
    expect(quiet.querySelector('.text-zinc-400').textContent).toBe('i')
  })

  it('draws a ghost in the passage and past the end', () => {
    const middle = view({ target: 'abcd', typed: '', ghostIndex: 1, fontScale: 1.1 })
    expect(middle.style.fontSize).toBe('calc(0.9625rem)')
    expect(middle.querySelector('[title="Ghost (PB pace)"]')).toBeTruthy()
    const pending = [...middle.querySelectorAll('.text-zinc-400')].map((node) => node.textContent)
    expect(pending).toEqual(['a', 'bcd'])
    middle.remove()

    const done = view({ target: 'ab', typed: 'ab', ghostIndex: 10, showCursor: true })
    expect(done.querySelector('.text-zinc-50').textContent).toBe('ab')
    const tail = [...done.children].map((node) => node.getAttribute('title') ?? node.className)
    expect(tail.at(-2)).toContain('Ghost')
    expect(tail.at(-1)).toContain('cursor-blink')
    done.remove()

    const blank = view({ target: '', typed: '', showCursor: true, ghostIndex: 0 })
    expect(blank.querySelector('.cursor-blink')).toBeTruthy()
    expect(blank.querySelector('[title="Ghost (PB pace)"]')).toBeTruthy()
    expect(blank.textContent).toBe('')
  })
})
