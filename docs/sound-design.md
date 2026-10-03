# Ambient Sound Design & Audit Framework (Phase 3.4)

This document defines LoKey Typer’s **ambient audio quality bar** and the audit steps used to keep it:

- safe for long sessions (30–120+ minutes)
- focus-supporting (not stimulating, not sleep-inducing)
- low cognitive load (no attentional capture)
- accessibility-aware
- non-masking relative to typing feedback

It is written to serve two purposes:

1) **Internal guardrails** for adding or reviewing new ambient stems
2) **Publicly defensible claims** about what the ambient system is (and is not)

## Audit goals (must-haves)

The ambient system must:

- support sustained attention (no “music-like” hooks)
- avoid rhythmic entrainment (no audible BPM / pulse)
- avoid attentional capture (no “moments”)
- remain safe and non-fatiguing for long sessions
- stay subordinate to typing SFX (avoid auditory masking)
- fail safe (missing/invalid assets ⇒ silence, no crash)

## 1) Psychoacoustic design principles

These principles are “scientifically informed” in the practical sense: they align with established psychoacoustics and human attention constraints, and they are testable.

### 1.1 No rhythmic entrainment

**Why**

Rhythmic or periodic audio can entrain attention and motor timing. For a typing trainer, that’s undesirable: it competes with reading and keystroke cadence.

**Audit criteria**

- No audible BPM.
- No repeating transient patterns.
- No regular amplitude modulation in ~0.5–4 Hz (where entrainment is strongest).

**Implementation guardrails**

- Prefer aperiodic modulation (noise / random walk) over fixed-frequency LFOs.
- Macro evolution intervals are randomized (engine schedules ~3–6 minutes).

**Defensible claim**

> LoKey Typer avoids rhythmic or tempo-based ambient audio to reduce attentional entrainment.

### 1.2 Spectral balance tuned for focus

**Why**

Spectral balance impacts fatigue and alertness. Over-emphasizing upper mids (roughly 2–5 kHz) can feel “sharp” over time; excessive sub-bass can feel physiologically arousing.

**Practical targets (guidance)**

- Most energy concentrated roughly in **150 Hz – 1.5 kHz**.
- Gentle roll-off above ~4 kHz.
- Avoid dominant tones that persist > ~500 ms.

**Manifest metadata (optional but recommended)**

Each stem *may* include:

- `lufs_i`: integrated loudness estimate (LUFS-I)
- `features.brightness` (0–1): relative brightness
- `features.density` (0–1): textural density
- `features.movement` (0–1): perceived motion

These are not “scientific measurements” by themselves; they are internal descriptors to enforce consistency and enable future selection logic.

**Defensible claim**

> Ambient stems are mixed and selected to avoid harsh or fatiguing spectral emphasis.

### 1.3 Loudness safety for long sessions

**Why**

For sustained attention tasks, **loudness stability** matters as much as (or more than) loudness peaks. Distracting level variation can increase perceived fatigue.

**Audit rules**

- Target stem integrated loudness (guidance): **–30 to –34 LUFS-I**.
- Ambient master is capped and remains below typing SFX.
- Only slow drift (micro-variation) is permitted; avoid rapid gain motion.

**Implementation checks**

- Crossfades are long and smooth (no hard cuts).
- Macro swaps change one layer at a time.

**Defensible claim**

> Ambient audio is level-capped and designed for long sessions with stable loudness.

## 2) Cognitive load & attention audit

### 2.1 Event minimization

**Rule**

No sudden changes, sharp onsets, or identifiable “moments.”

**Audit checklist**

- Macro crossfades are long (engine uses multi-second fades; keep ≥ 12s for swaps).
- Never swap more than one layer at a time.
- Do not evolve near task boundaries (the engine avoids evolutions in the final ~20s of an exercise when remaining time is known).

**Defensible claim**

> The soundscape evolves gradually to avoid interrupting attention.

### 2.2 “Change blindness” alignment

This is a desired property: the environment should stay fresh without pulling focus.

**Test prompt (informal)**

After 20–30 minutes of use, ask:

- “Did the sound change?”

A good outcome is often: *“Not really.”* — while objective logs show that evolutions occurred.

**Defensible claim**

> The environment subtly evolves to reduce habituation without drawing attention.

## 3) Typing-specific motor–auditory interference audit

This is where LoKey Typer’s ambient system is intentionally different from a music playlist.

### 3.1 Auditory masking avoidance (typing SFX must stay clear)

**Why**

Masking typing sounds degrades timing feedback and can harm accuracy.

**Rules**

- Ambient stems must not contain percussive transients.
- Ambient energy should be kept lower in upper-mid regions where click/presence cues live.
- Ambient master should remain clearly below typing SFX.

**Defensible claim**

> Ambient audio is mixed to preserve clear keystroke feedback.

### 3.2 Temporal independence from keystrokes

**Rule**

Ambient must not react to typing rhythm.

**Implementation guardrails**

- No envelope followers tied to input.
- No reactive “beat matching” or cadence effects.

**Defensible claim**

> The soundscape remains independent of typing cadence.

## 4) Accessibility & neurodiversity audit

### 4.1 Screen reader compatibility

- Screen Reader Mode forces ambient off.
- No audio-only cues for state changes.

### 4.2 Reduced motion / sensory sensitivity

- Reduced Motion disables macro evolution (micro drift only).
- Ambient can still be used, but should remain conservative.

### 4.3 Cognitive predictability

- No surprise sounds.
- No notification-like cues embedded in ambience.

**Defensible claim**

> Accessibility modes enforce conservative audio behavior by default.

## 5) Long-session fatigue testing protocol (internal)

This is a lightweight protocol you can run and honestly say you ran.

**Suggested internal test**

- 3–5 users
- 45–90 minute typing sessions
- Compare:
  - silence
  - LoKey ambience
  - typical “lofi music”

**Metrics (simple + practical)**

- Self-report fatigue (end + mid-session)
- Desire to turn audio off
- Error rate drift over time
- Perceived distraction

You don’t need to publish numbers to describe the methodology.

## 6) Marketing-safe language (no pseudoscience)

### Safe, defensible phrases

- “Psychoacoustically tuned” (meaning: shaped to avoid distraction/fatigue)
- “Non-rhythmic, non-intrusive”
- “Designed to avoid attentional capture”
- “Designed for long focus sessions”
- “Evolving soundscape without repetition”

### Avoid (not defensible)

- “Scientifically proven to boost productivity”
- “Neuroscience-backed performance gains”
- “Brainwave / binaural claims”

### Example positioning blurb

LoKey Typer uses a non-rhythmic ambient soundscape designed to support sustained focus without distraction. It evolves gradually over time, avoids masking keystroke feedback, and fails safe to silence when audio assets are missing.

## 7) Operational checklist (for adding stems)

When adding a new stem to `public/audio/ambient/**` and `public/audio/ambient/manifest.json`:

- No obvious rhythmic pulse or repeating transients.
- No sharp attacks; use slow fades.
- Loudness is conservative (prefer –30 to –34 LUFS-I guidance).
- Tag/feature metadata is filled in when available (`lufs_i`, `features.*`).
- Validate file existence via `npm run qa:ambient:assets`.

Versioning note: treat changes to this doc as versioned product behavior. If the criteria change, explain why.
