# LoKey Typer — Sound Design Manifesto

**Version**: v1.0 — Ambient-first architecture

## 1. Purpose

Sound in LoKey Typer is not decoration, motivation, or entertainment. It is part of the interaction substrate.

The ambient system exists to:

- support sustained attention
- avoid attentional capture
- preserve motor–auditory feedback for typing
- remain safe and comfortable for long sessions
- adapt without becoming noticeable

If sound ever becomes the focus, it has failed.

## 2. Design Philosophy

### 2.1 Environment, not music

LoKey Typer does not play songs, tracks, or loops in the musical sense.

Instead, it renders a continuously evolving acoustic environment composed of layered, non-rhythmic textures.

There is no beginning, climax, or ending.

### 2.2 Non-intrusive by default

The system is designed so that:

- users often cannot tell when the sound changes
- but also never feel like they are listening to a repeating loop

Subtle change is preferred over novelty.

### 2.3 Typing comes first

Typing feedback (keystrokes, errors, confirmation sounds) is always:

- audible
- temporally precise
- perceptually distinct

Ambient sound must never mask or compete with typing feedback.

### 2.4 Accessibility is a hard constraint

Accessibility requirements override all aesthetic or experiential goals.

When required:

- ambient audio is disabled automatically
- dynamic behavior is reduced or removed
- no information is conveyed exclusively through sound

## 3. Psychoacoustic Principles

### 3.1 No rhythmic entrainment

The ambient system must not introduce rhythm, tempo, or periodic structure.

**Rationale**

Rhythmic audio entrains attention and motor timing, which interferes with reading and typing.

**Rules**

- No BPM-based content
- No repeating transient patterns
- No periodic modulation in the ~0.5–4 Hz range
- No tempo-synchronized changes
- All modulation must be aperiodic (noise-driven, random walk, or equivalent)

### 3.2 Spectral neutrality

The soundscape must avoid frequency ranges known to increase fatigue or alerting.

**Targets**

- Energy concentrated primarily between 150 Hz and 1.5 kHz
- Gentle roll-off above 4 kHz
- No sustained narrowband tones

### 3.3 Loudness stability

Perceived loudness stability is more important than peak loudness.

**Rules**

- Ambient audio is quiet by default
- Changes in loudness occur slowly
- Crossfades preserve total energy

## 4. Evolution Over Time

### 4.1 Continuous micro-variation

The soundscape is always alive through slow, subtle drift:

- gain
- filter cutoff
- stereo width

These changes are:

- smooth
- non-periodic
- spread over tens of seconds or minutes

### 4.2 Macro evolution (“chapters”)

During long sessions, the environment evolves by replacing one layer at a time.

**Constraints**

- Only one layer may change at once
- Changes are crossfaded slowly
- No changes near task boundaries (exercise end)
- Recently used material is avoided

The goal is freshness without attention capture.

## 5. Typing-Specific Constraints

### 5.1 No auditory masking

Ambient sound must not interfere with keystroke perception.

**Rules**

- Ambient RMS is capped relative to typing SFX RMS
- Ambient content contains no sharp transients
- Spectral overlap with keystroke frequencies is minimized

### 5.2 Temporal independence

Ambient sound must not react to typing cadence, speed, or accuracy.

No reactive audio. No feedback coupling.

## 6. Accessibility Guarantees

### Screen reader mode

- Ambient audio is disabled automatically
- All state changes have non-audio equivalents

### Reduced motion / sensory sensitivity

- Macro evolution is disabled
- Only static or minimally drifting ambience may be used

### Sound off

- The application remains fully usable
- No audio is required to understand state or progress

## 7. Fail-Safe Behavior

Sound is optional.

If audio assets are missing, invalid, or fail to load:

- the system must remain silent
- no errors propagate to the UI
- typing behavior is unaffected

Silence is always a valid outcome.

## 8. Non-Goals (Explicitly Out of Scope)

LoKey Typer does not claim to:

- improve intelligence
- optimize brainwaves
- increase productivity through neuroscience
- induce specific mental states

The goal is support, not optimization.

## Acceptance Tests (Enforceable, Numeric)

These are engineering gates, not suggestions.

### A. Loudness & Mixing

- **Integrated loudness per ambient stem**: –30 to –34 LUFS (±1 LUFS tolerance)
- **Ambient master RMS ≤ 70% of typing SFX RMS**
- **Gain drift per layer**: ≤ ±2 dB, time constant ≥ 30 seconds

### B. Modulation & Evolution

- No fixed-frequency LFOs
- All modulation sources must be aperiodic
- **Macro evolution interval**: ≥ 3 minutes, ≤ 6 minutes (randomized)
- **Crossfade duration for layer swaps**: 12–25 seconds
- **Max layers swapped simultaneously**: 1
- **No evolution within 20 seconds of exercise end**

### C. Novelty / Repetition

- **Per-layer “recent memory”**: K ≥ 5 (no reuse within session)
- **No identical full soundscape state repeated within 30 minutes**

### D. Accessibility

- `screenReaderMode = true` → ambient audio = OFF (hard enforced)
- `reducedMotion = true` → macro evolution = OFF

No exceptions.

### E. Stability & Safety

- Missing or invalid audio asset → silent fallback
- Manifest load failure → ambient disabled
- No audio errors may throw or block typing

## Marketing Copy (Science-Safe, Defensible)

You can use the following verbatim.

### Short description

LoKey Typer uses an evolving ambient soundscape designed to support focus without distraction. The audio environment changes gradually over time, avoids rhythm and repetition, and preserves clear keystroke feedback — making it comfortable for long typing sessions.

### Medium description

Unlike playlists or music loops, LoKey Typer’s ambience is engineered as a non-rhythmic environment. It evolves subtly over time, avoids attention-grabbing patterns, and is mixed to never mask typing feedback. Accessibility settings are enforced automatically, and sound is always optional.

### “Why our ambience is different”

LoKey Typer doesn’t play songs. It renders a quiet, evolving acoustic environment — designed to stay out of the way while you type.

### What we explicitly don’t claim

We don’t promise productivity boosts or neuroscience hacks. We design for comfort, focus, and long-session usability.

## Final note (for contributors)

Sound design decisions must be evaluated against this manifesto. If a change makes the sound more noticeable, more musical, or more reactive, it should be questioned.

The best compliment our audio can receive is that users forget it’s there — until they turn it off.
